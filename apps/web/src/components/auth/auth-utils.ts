import type { Me } from "@/lib/types";

/** Only allow same-origin relative redirects. */
export function safeNext(value: string | null | undefined, fallback = "/app") {
  if (value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return value;
  return fallback;
}

/** Where to send a user right after authenticating. */
export function postAuthRoute(me: Me, next?: string | null) {
  if (me.user.platform_role === "platform_super_admin" && me.memberships.length === 0) return safeNext(next, "/admin");
  if (me.memberships.length === 0) return "/onboarding";
  const first = me.memberships[0];
  if (!first.organization.onboarding_completed && first.role === "owner") return "/onboarding";
  return safeNext(next, "/app");
}

export const OAUTH_ERRORS: Record<string, { title: string; body: string }> = {
  google_not_configured: { title: "Google Sign-In isn't set up yet", body: "This server doesn't have Google OAuth credentials configured. Sign in with your email and password instead." },
  oauth_state_invalid: { title: "That sign-in link expired", body: "For your security the Google sign-in session timed out. Please try again." },
  google_cancelled: { title: "Google sign-in was cancelled", body: "No problem — choose an account to continue, or use your email and password." },
  oauth_failed: { title: "We couldn't complete Google sign-in", body: "Google didn't return a valid response. Please try again in a moment." },
  oauth_unverified_email: { title: "Your Google email isn't verified", body: "Verify the email on your Google account, or sign up with email and password." },
  account_disabled: { title: "This account is disabled", body: "Contact support@reviewpilot.ai if you think this is a mistake." },
  session_invalid: { title: "Your session ended", body: "Please sign in again to continue." },
};

export const COUNTRIES = [
  { code: "IN", name: "India", dial: "+91", hint: "10-digit mobile, e.g. 98765 43210" },
  { code: "AE", name: "United Arab Emirates", dial: "+971", hint: "e.g. 50 123 4567" },
  { code: "US", name: "United States", dial: "+1", hint: "e.g. (415) 555-0132" },
  { code: "GB", name: "United Kingdom", dial: "+44", hint: "e.g. 7700 900123" },
  { code: "SG", name: "Singapore", dial: "+65", hint: "e.g. 8123 4567" },
  { code: "AU", name: "Australia", dial: "+61", hint: "e.g. 412 345 678" },
  { code: "CA", name: "Canada", dial: "+1", hint: "e.g. (604) 555-0199" },
  { code: "DE", name: "Germany", dial: "+49", hint: "e.g. 1512 3456789" },
  { code: "FR", name: "France", dial: "+33", hint: "e.g. 6 12 34 56 78" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", hint: "e.g. 50 123 4567" },
  { code: "NP", name: "Nepal", dial: "+977", hint: "e.g. 984 1234567" },
  { code: "LK", name: "Sri Lanka", dial: "+94", hint: "e.g. 71 234 5678" },
] as const;

export function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
