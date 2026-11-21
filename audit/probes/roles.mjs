// Signs in to /admin as each test role and lists the tabs it sees.
// Logins come from .env.test.local (never printed).
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.test.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const base = process.argv[2] ?? "http://localhost:8081";
const out = process.argv[3] ?? "audit/results/after/roles";
const browser = await chromium.launch();
for (const role of ["ADMIN", "STAFF", "DOCTOR", "PATIENT"]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(base + "/admin", { waitUntil: "networkidle" });
  await page.fill("#email", env[`E2E_${role}_EMAIL`]);
  await page.fill("#password", env[`E2E_${role}_PASSWORD`]);
  await page.locator("form button[type=submit]").click();
  await page.waitForTimeout(4000);
  const tabs = await page.locator("nav.space-y-2 button").allInnerTexts().catch(() => []);
  const header = await page.locator("text=/Role:/").first().innerText().catch(() => "");
  const alerts = await page.locator("[role=alert], ol li").allInnerTexts();
  console.log(role.padEnd(8), "tabs:", JSON.stringify(tabs), "|", header.replace(/\s+/g, " "), "|", JSON.stringify(alerts.filter(Boolean).slice(0, 1)));
  await page.screenshot({ path: `${out}-${role.toLowerCase()}.png` });
  await page.close();
}
await browser.close();
