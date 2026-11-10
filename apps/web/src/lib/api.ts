/**
 * Typed fetch wrapper for the ReviewPilot API.
 *
 * - Always same-origin (`/api/v1/*` is rewritten to FastAPI by next.config.ts),
 *   so HTTP-only auth cookies are first-party.
 * - Sends the double-submit CSRF token on unsafe methods.
 * - Sends the active organization via `X-Organization-Id`; the server verifies membership.
 * - Transparently rotates the refresh token once on `token_expired`.
 * - Rides out a cold start: when the hosting edge answers 502/503/504 (not our JSON error
 *   envelope, so the request never reached the API) or the network drops, it retries with
 *   backoff for up to ~2 minutes and tells subscribers the server is waking up.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const ORG_KEY = "rp_org";
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function getActiveOrgId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ORG_KEY);
  } catch {
    return null;
  }
}

export function setActiveOrgId(id: string | null) {
  try {
    if (id) localStorage.setItem(ORG_KEY, id);
    else localStorage.removeItem(ORG_KEY);
  } catch {}
}

function readCookie(name: string) {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.split("=")[1];
}

export type Query = Record<string, string | number | boolean | null | undefined | string[]>;

function buildUrl(path: string, query?: Query) {
  const url = `/api/v1${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
    else params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Query;
  orgId?: string | null;
  signal?: AbortSignal;
  /** Raw response (for file downloads). */
  raw?: boolean;
}

// ------------------------------------------------------------------ cold-start handling

const WAKE_STATUSES = new Set([502, 503, 504]);
const WAKE_BUDGET_MS = 120_000;
const WAKE_DELAYS_MS = [1500, 3000, 5000, 8000];

type WakeListener = (waking: boolean) => void;
const wakeListeners = new Set<WakeListener>();
let wakingCount = 0;

/** Subscribe to "the API is starting up" — returns an unsubscribe function. */
export function subscribeServerWaking(fn: WakeListener) {
  wakeListeners.add(fn);
  return () => void wakeListeners.delete(fn);
}

function setWaking(delta: 1 | -1) {
  const before = wakingCount > 0;
  wakingCount = Math.max(0, wakingCount + delta);
  const after = wakingCount > 0;
  if (before !== after) wakeListeners.forEach((fn) => fn(after));
}

/** True when the response came from the hosting edge rather than the API (no JSON error envelope). */
async function isEdgeFailure(res: Response) {
  if (!WAKE_STATUSES.has(res.status)) return false;
  if (!(res.headers.get("content-type") ?? "").includes("application/json")) return true;
  const body = await res.clone().json().catch(() => null);
  return !body?.error;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

/** fetch() that waits out a sleeping backend instead of surfacing a 502. */
export async function fetchWithWake(input: string, init: RequestInit = {}): Promise<Response> {
  const started = Date.now();
  let attempt = 0;
  let waking = false;
  try {
    for (;;) {
      let res: Response | null = null;
      let netErr: unknown = null;
      try {
        res = await fetch(input, init);
      } catch (e) {
        if (init.signal?.aborted) throw e;
        netErr = e;
      }
      const retryable = res ? await isEdgeFailure(res) : true;
      if (!retryable || Date.now() - started > WAKE_BUDGET_MS) {
        if (res) return res;
        throw netErr;
      }
      if (!waking) {
        waking = true;
        setWaking(1);
      }
      await sleep(WAKE_DELAYS_MS[Math.min(attempt++, WAKE_DELAYS_MS.length - 1)], init.signal ?? undefined);
    }
  } finally {
    if (waking) setWaking(-1);
  }
}

/** Fire-and-forget ping so the API starts booting while the user is still typing. */
export function warmUpApi() {
  if (typeof window === "undefined") return;
  fetchWithWake("/api/v1/health", { cache: "no-store" }).catch(() => {});
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession() {
  refreshing ??= fetchWithWake("/api/v1/auth/refresh", {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": decodeURIComponent(readCookie("rp_csrf") ?? "") },
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

async function request<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const method = (opts.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { Accept: "application/json" };
  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  if (opts.body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (UNSAFE.has(method)) headers["X-CSRF-Token"] = decodeURIComponent(readCookie("rp_csrf") ?? "");
  const orgId = opts.orgId === undefined ? getActiveOrgId() : opts.orgId;
  if (orgId) headers["X-Organization-Id"] = orgId;

  const res = await fetchWithWake(buildUrl(path, opts.query), {
    method,
    headers,
    credentials: "include",
    signal: opts.signal,
    body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
  });

  if (res.status === 401 && !retried && !path.startsWith("/auth/refresh") && !path.startsWith("/auth/login")) {
    const body = await res.clone().json().catch(() => null);
    if (body?.error?.code === "token_expired" || body?.error?.code === "not_authenticated") {
      if (await refreshSession()) return request<T>(path, opts, true);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = body?.error;
    const fallback = WAKE_STATUSES.has(res.status)
      ? "The server is still starting up. Please try again in a moment."
      : `Request failed (${res.status})`;
    throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? fallback, err?.details);
  }
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query, opts?: Omit<RequestOptions, "query" | "method">) => request<T>(path, { ...opts, query }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body" | "method">) => request<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body" | "method">) => request<T>(path, { ...opts, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body" | "method">) => request<T>(path, { ...opts, method: "PUT", body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, "method">) => request<T>(path, { ...opts, method: "DELETE" }),
  raw: (path: string, opts?: RequestOptions) => request<Response>(path, { ...opts, raw: true }),
};

/** Trigger a browser download for an authenticated API file endpoint. */
export async function downloadFile(path: string, query?: Query, fallbackName = "download") {
  const res = await api.raw(path, { query });
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = match?.[1] ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}
