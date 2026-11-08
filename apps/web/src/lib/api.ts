/**
 * Typed fetch wrapper for the ReviewPilot API.
 *
 * - Always same-origin (`/api/v1/*` is rewritten to FastAPI by next.config.ts),
 *   so HTTP-only auth cookies are first-party.
 * - Sends the double-submit CSRF token on unsafe methods.
 * - Sends the active organization via `X-Organization-Id`; the server verifies membership.
 * - Transparently rotates the refresh token once on `token_expired`.
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

let refreshing: Promise<boolean> | null = null;

async function refreshSession() {
  refreshing ??= fetch("/api/v1/auth/refresh", {
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

  const res = await fetch(buildUrl(path, opts.query), {
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
    throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? `Request failed (${res.status})`, err?.details);
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
