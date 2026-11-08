import { NextResponse, type NextRequest } from "next/server";

/**
 * Host-based surface routing + coarse auth gate (Next.js 16 `proxy`).
 *
 *   reviewpilot.ai        → marketing + auth pages
 *   app.reviewpilot.ai    → /app/*  (business application)
 *   admin.reviewpilot.ai  → /admin/* (Super Admin console)
 *
 * In local dev everything is served from one host by path. The cookie check here only
 * avoids rendering protected shells for signed-out visitors; real authorization is
 * enforced by the API on every request.
 */
const PROTECTED = ["/app", "/admin", "/onboarding"];
const PASSTHROUGH = ["/api", "/_next", "/r/", "/q/", "/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/invite", "/icon", "/favicon", "/robots", "/sitemap", "/opengraph-image"];

export function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const host = (req.headers.get("host") ?? "").toLowerCase();
  const path = url.pathname;

  const surface = host.startsWith("admin.") ? "/admin" : host.startsWith("app.") ? "/app" : null;
  if (surface && !PASSTHROUGH.some((p) => path.startsWith(p)) && !path.startsWith(surface) && !path.startsWith("/onboarding")) {
    const rewritten = url.clone();
    rewritten.pathname = `${surface}${path === "/" ? "" : path}`;
    return NextResponse.rewrite(rewritten);
  }

  if (PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const hasSession = req.cookies.has("rp_access") || req.cookies.has("rp_csrf");
    if (!hasSession) {
      const login = url.clone();
      login.pathname = "/login";
      login.search = `?next=${encodeURIComponent(path + url.search)}`;
      return NextResponse.redirect(login);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt|xml)$).*)"],
};
