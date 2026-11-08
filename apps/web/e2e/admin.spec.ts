import { expect, test } from "@playwright/test";
import { DEMO, loginUI } from "./helpers";

test.describe("super admin access", () => {
  test("business owner cannot open the admin console", async ({ page }) => {
    await loginUI(page, DEMO.owner.email, DEMO.owner.password);
    await page.waitForURL(/\/app/);
    await page.goto("/admin");
    // The console renders a 403 screen and fetches no admin data; the API rejects the call.
    await expect(page.getByRole("heading", { name: /restricted/i })).toBeVisible();
    const api = await page.request.get("/api/v1/admin/overview");
    expect(api.status()).toBe(403);
  });

  test("staff cannot call admin APIs", async ({ page }) => {
    await loginUI(page, DEMO.staff.email, DEMO.staff.password);
    await page.waitForURL(/\/app/);
    expect((await page.request.get("/api/v1/admin/organizations")).status()).toBe(403);
  });

  test("super admin sees the platform overview", async ({ page }) => {
    await loginUI(page, DEMO.superAdmin.email, DEMO.superAdmin.password);
    await page.waitForURL(/\/admin/);
    await expect(page.getByText(/organizations/i).first()).toBeVisible();
    await expect(page.getByText(/MRR|monthly recurring revenue/i).first()).toBeVisible();
  });
});
