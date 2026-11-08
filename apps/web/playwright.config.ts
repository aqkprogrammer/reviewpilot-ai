import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. Prerequisites (see docs/DEVELOPMENT.md):
 *   - API on :8000 with DEMO_MODE=true and OAUTH_MOCK_ENABLED=true, demo seed loaded
 *   - web on :3000 (`pnpm dev`) — or uncomment `webServer` below
 * Run: pnpm --filter @reviewpilot/web test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /marketing|feedback/ },
  ],
  // webServer: [
  //   { command: "cd ../api && uv run uvicorn app.main:app --port 8000", url: "http://localhost:8000/healthz", reuseExistingServer: true },
  //   { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true },
  // ],
});
