import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 6_000 },
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python3 -m http.server 4173 --directory dist",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: false,
    timeout: 15_000,
  },
  reporter: [["list"]],
});
