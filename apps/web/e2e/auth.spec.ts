import { expect, test } from "@playwright/test";
import { DEMO, PASSWORD, loginUI, uniqueEmail } from "./helpers";

test.describe("authentication", () => {
  test("signup creates an account and starts onboarding", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel(/full name/i).fill("Asha Verma");
    await page.getByLabel(/business email|^email/i).fill(uniqueEmail("signup"));
    await page.getByLabel(/^password/i).fill(PASSWORD);
    await page.getByLabel(/confirm password/i).fill(PASSWORD);
    await page.getByLabel(/business name/i).fill("Asha's Kitchen");
    await page.getByRole("combobox", { name: /business category/i }).click();
    await page.getByRole("option", { name: /restaurant/i }).click();
    await page.getByLabel(/phone/i).fill("+919876543210");
    await page.getByRole("checkbox", { name: /terms/i }).check();
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("signup validates the form", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByText(/required|at least|enter|valid/i).first()).toBeVisible();
  });

  test("login with demo owner reaches the dashboard", async ({ page }) => {
    await loginUI(page, DEMO.owner.email, DEMO.owner.password);
    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByRole("heading", { name: /overview|dashboard|good (morning|afternoon|evening)/i }).first()).toBeVisible();
  });

  test("wrong password shows an error", async ({ page }) => {
    await loginUI(page, DEMO.owner.email, "WrongPass123");
    await expect(page.getByText(/incorrect email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("Google sign-in via the mock provider", async ({ page }) => {
    // Requires OAUTH_MOCK_ENABLED=true on the API (development/E2E only).
    test.skip(!process.env.E2E_GOOGLE_MOCK, "Set E2E_GOOGLE_MOCK=1 and run the API with OAUTH_MOCK_ENABLED=true");
    await page.goto("/login");
    await page.getByRole("link", { name: /google/i }).or(page.getByRole("button", { name: /google/i })).first().click();
    await expect(page.getByText(/development mock/i)).toBeVisible();
    await page.getByLabel(/email/i).fill(uniqueEmail("google"));
    await page.getByLabel(/name/i).fill("Google E2E");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("protected routes redirect to login", async ({ page }) => {
    await page.goto("/app/reviews");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
