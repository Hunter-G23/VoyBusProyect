import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:8082",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : {}),
  },
  projects: [
    {
      name: "mobile-web",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    { name: "desktop-web", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: "node scripts/e2e-api.cjs",
      url: "http://127.0.0.1:3001/api/health",
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: "npm --prefix front run web -- --port 8082 --max-workers 2",
      url: "http://localhost:8082",
      env: { EXPO_PUBLIC_API_URL: "http://localhost:3001/api", CI: "1" },
      reuseExistingServer: false,
      timeout: 180000,
    },
  ],
});
