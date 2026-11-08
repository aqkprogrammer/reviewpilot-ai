import { expect, test } from "@playwright/test";

test("homepage renders hero and primary CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/reputation/i);
  await expect(page.getByRole("link", { name: /start free/i }).first()).toHaveAttribute("href", /\/signup/);
});

test("pricing lists plans in rupees", async ({ page }) => {
  await page.goto("/pricing");
  for (const plan of ["Starter", "Growth", "Agency", "Enterprise"]) {
    await expect(page.getByText(plan, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText(/₹\s?1,999/).first()).toBeVisible();
});
