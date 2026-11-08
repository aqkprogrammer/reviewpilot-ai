import { expect, test } from "@playwright/test";
import { DEMO, completeOnboardingAPI, loginUI, signupAPI } from "./helpers";

test.describe("business workflows", () => {
  test("create organization flow: add a location", async ({ page }) => {
    const { me } = await signupAPI(page.request);
    const orgId = me.memberships[0].organization.id;
    await page.goto("/login");
    await completeOnboardingAPI(page, orgId);
    await page.goto("/app/locations");
    await page.getByRole("button", { name: /add location|new location/i }).first().click();
    await page.getByLabel(/^name|location name/i).fill("Bandra Outlet");
    await page.getByLabel(/city/i).fill("Mumbai");
    await page.getByRole("button", { name: /save|create|add location/i }).last().click();
    await expect(page.getByRole("heading", { name: "Bandra Outlet" })).toBeVisible();
  });

  test("generate and download a QR code", async ({ page }) => {
    await loginUI(page, DEMO.owner.email, DEMO.owner.password);
    await page.waitForURL(/\/app/);
    await page.goto("/app/qr-codes");
    await page.getByRole("button", { name: /new qr code|create qr code/i }).first().click();
    const name = `Counter card ${Date.now()}`;
    await page.getByLabel(/^name/i).fill(name);
    await page.getByRole("dialog").getByRole("button", { name: "Create QR code" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    const card = page.getByRole("button", { name: `More actions for ${name}` }).locator("xpath=ancestor::*[.//button[normalize-space()='Download']][1]");
    await card.getByRole("button", { name: "Download" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: /png/i }).click();
    expect((await download).suggestedFilename()).toMatch(/\.png$/);
  });

  test("create a campaign with the wizard", async ({ page }) => {
    await loginUI(page, DEMO.owner.email, DEMO.owner.password);
    await page.waitForURL(/\/app/);
    await page.goto("/app/campaigns");
    await page.getByRole("link", { name: /new campaign/i }).first().click();
    const name = `E2E email ${Date.now()}`;
    await page.getByLabel(/campaign name/i).fill(name);
    const next = () => page.getByRole("button", { name: /^continue/i }).click();
    await next(); // → location (pre-selected)
    await next(); // → channel
    await page.getByRole("radiogroup", { name: "Channel" }).getByRole("radio", { name: /email/i }).click();
    await next(); // → message
    await page.getByLabel(/email subject/i).fill("How was your visit?");
    await page.getByLabel(/^message/i).fill("Hi {{name}}, we'd value your honest feedback: {{link}}");
    for (let i = 0; i < 3; i++) await next(); // schedule → preview → launch
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("analytics shows metrics with definitions and demo label", async ({ page }) => {
    await loginUI(page, DEMO.owner.email, DEMO.owner.password);
    await page.waitForURL(/\/app/);
    await page.goto("/app/analytics");
    await expect(page.getByText(/average rating/i).first()).toBeVisible();
    await expect(page.getByText(/demo/i).first()).toBeVisible();
    const csv = page.waitForEvent("download");
    await page.getByRole("button", { name: /csv/i }).first().click();
    expect((await csv).suggestedFilename()).toMatch(/\.csv$/);
  });
});

test.describe("public feedback page", () => {
  test("feedback page always offers Google, independent of rating", async ({ page }) => {
    await page.goto("/r/spice-route-kitchen-bandra-west");
    await expect(page.getByRole("link", { name: /google/i }).or(page.getByRole("button", { name: /google/i })).first()).toBeVisible();
    await page.getByRole("radio", { name: /^1 —/ }).click();
    await expect(page.getByRole("link", { name: /google/i }).or(page.getByRole("button", { name: /google/i })).first()).toBeVisible();
  });
});
