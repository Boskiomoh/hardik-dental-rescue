import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

// Load .env.local (Supabase URL/key) and .env.test.local (test logins) without
// adding a dotenv dependency. Values already set in the shell win.
for (const file of [".env.local", ".env.test.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:8081";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Starts the dev server unless E2E_BASE_URL points somewhere else (e.g. a deploy)
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npx vite --port 8081 --strictPort", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
