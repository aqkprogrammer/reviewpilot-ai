/**
 * Self-hosted client error reporting.
 *
 * Sends uncaught browser errors to `POST /api/v1/public/client-errors`, which stores them as
 * `error_events` (Super Admin → System health). Best-effort and fire-and-forget: it never throws,
 * dedupes identical errors and sends at most MAX_REPORTS per page load.
 */

export const CLIENT_ERRORS_ENDPOINT = "/api/v1/public/client-errors";
export const MAX_REPORTS = 5;
const MAX_STACK = 4000;
const MAX_MESSAGE = 1000;

export type ClientErrorPayload = {
  message: string;
  name?: string;
  stack?: string;
  digest?: string;
  path?: string;
  user_agent?: string;
};

const seen = new Set<string>();
let sent = 0;

/** Test hook: forget dedupe state and the per-page budget. */
export function resetErrorReporting() {
  seen.clear();
  sent = 0;
}

function describe(error: unknown): { name?: string; message: string; stack?: string; digest?: string } {
  if (error instanceof Error) {
    const digest = (error as Error & { digest?: unknown }).digest;
    return { name: error.name, message: error.message || error.name || "Error", stack: error.stack, digest: typeof digest === "string" ? digest : undefined };
  }
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { message: String(error) };
  }
}

export function buildPayload(error: unknown, extra?: { digest?: string }): ClientErrorPayload {
  const d = describe(error);
  const payload: ClientErrorPayload = { message: (d.message || "Unknown error").slice(0, MAX_MESSAGE) };
  if (d.name) payload.name = d.name.slice(0, 128);
  if (d.stack) payload.stack = d.stack.slice(0, MAX_STACK);
  const digest = extra?.digest ?? d.digest;
  if (digest) payload.digest = digest.slice(0, 64);
  if (typeof window !== "undefined") payload.path = window.location.pathname.slice(0, 512);
  if (typeof navigator !== "undefined" && navigator.userAgent) payload.user_agent = navigator.userAgent.slice(0, 400);
  return payload;
}

/** Report an error once. Returns true when a report was dispatched. */
export function reportError(error: unknown, extra?: { digest?: string }): boolean {
  if (typeof window === "undefined") return false;
  try {
    const payload = buildPayload(error, extra);
    const key = `${payload.name ?? ""}|${payload.message}|${payload.digest ?? ""}|${payload.path ?? ""}`;
    if (seen.has(key) || sent >= MAX_REPORTS) return false;
    seen.add(key);
    sent += 1;
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon(CLIENT_ERRORS_ENDPOINT, new Blob([body], { type: "application/json" }))) return true;
    }
    void fetch(CLIENT_ERRORS_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "omit" }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

let listening = false;

/** Register window `error` / `unhandledrejection` listeners once. Returns a cleanup function. */
export function installGlobalErrorListeners(): () => void {
  if (typeof window === "undefined" || listening) return () => {};
  listening = true;
  const onError = (e: ErrorEvent) => {
    // Resource load errors (img/script 404s) have no `error` and are not app crashes.
    if (!e.error && !e.message) return;
    reportError(e.error ?? e.message);
  };
  const onRejection = (e: PromiseRejectionEvent) => reportError(e.reason ?? "Unhandled promise rejection");
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    listening = false;
  };
}
