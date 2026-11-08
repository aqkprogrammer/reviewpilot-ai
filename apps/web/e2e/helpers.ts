import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const PASSWORD = "Passw0rd!long";
export const DEMO = {
  owner: { email: "owner@reviewpilot.dev", password: "Owner@12345" },
  staff: { email: "staff@reviewpilot.dev", password: "Staff@12345" },
  superAdmin: { email: "superadmin@reviewpilot.dev", password: "SuperAdmin@12345" },
};

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

/** Sign in through the real login form. */
export async function loginUI(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
}

/** Fast path for tests that aren't about signup: create an account via the API (cookies land in the page context). */
export async function signupAPI(request: APIRequestContext, email = uniqueEmail()) {
  const res = await request.post("/api/v1/auth/signup", {
    data: { full_name: "E2E Owner", email, password: PASSWORD, business_name: "E2E Bistro", industry: "restaurant", country: "IN", accept_terms: true },
  });
  expect(res.status()).toBe(201);
  return { email, me: await res.json() };
}

/** Mark onboarding finished so tests land on the dashboard. */
export async function completeOnboardingAPI(page: Page, orgId: string) {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === "rp_csrf")?.value ?? "";
  const res = await page.request.post("/api/v1/onboarding/complete", { headers: { "X-CSRF-Token": csrf, "X-Organization-Id": orgId } });
  expect(res.ok()).toBeTruthy();
  await page.evaluate((id) => localStorage.setItem("rp_org", id), orgId);
}
