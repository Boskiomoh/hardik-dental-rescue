// Screenshots of the live fixed site for the report and portfolio.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.test.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const base = process.argv[2] ?? "https://hardik-dental-after.vercel.app";
const out = "audit/results/live";
const browser = await chromium.launch();

const shot = async (name, fn, viewport = { width: 1280, height: 800 }) => {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  try {
    await fn(page);
    // Hide toast pop-ups so they don't cover the content
    await page.addStyleTag({ content: "ol.fixed, [data-sonner-toaster] { display: none !important; }" });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${name}.png` });
    console.log("saved", name);
  }
  catch (e) { console.log("FAILED", name, String(e.message).split("\n")[0]); }
  await page.close();
};

const adminLogin = async (page, role) => {
  await page.goto(base + "/admin");
  await page.fill("#email", env[`E2E_${role}_EMAIL`]);
  await page.fill("#password", env[`E2E_${role}_PASSWORD`]);
  await page.locator("form button[type=submit]").click();
  await page.locator("nav.space-y-2").waitFor({ timeout: 20000 });
};

await shot("after-booking-success", async (page) => {
  await page.goto(base + "/booking");
  const day = new Date(Date.now() + 12 * 86400000); if (day.getDay() === 0) day.setDate(day.getDate() + 1);
  await page.fill("#firstName", "Ada"); await page.fill("#lastName", "Lovelace");
  await page.fill("#email", `ada.demo.${Date.now() % 10000}@example.com`); await page.fill("#phone", "(555) 010-2233");
  await page.fill("#date", day.toISOString().slice(0, 10));
  await page.locator("#doctor:not([disabled])").waitFor(); await page.locator("#doctor").click();
  await page.getByRole("option", { name: "Dr. Smith" }).click();
  await page.locator("#time").click(); await page.getByRole("option", { name: /^\d+:\d+ (AM|PM)$/ }).first().click();
  await page.locator("#service").click(); await page.getByRole("option", { name: "Regular Cleaning" }).click();
  await page.locator("form button[type=submit]").click();
  await page.getByRole("button", { name: "Pay $25 deposit" }).waitFor();
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(800);
});

await shot("after-booking-slots", async (page) => {
  await page.goto(base + "/booking");
  const d = new Date(Date.now() + 2 * 86400000); if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  await page.fill("#date", d.toISOString().slice(0, 10));
  await page.locator("#doctor:not([disabled])").waitFor(); await page.locator("#doctor").click();
  await page.getByRole("option", { name: "Dr. Smith" }).click();
  await page.locator("#time").click(); await page.waitForTimeout(800);
  await page.locator("#time").scrollIntoViewIfNeeded();
});

await shot("after-admin-team", async (page) => {
  await adminLogin(page, "ADMIN");
  await page.locator("nav.space-y-2").getByRole("button", { name: "Team & Roles" }).click();
  await page.getByText(env.E2E_DOCTOR_EMAIL).waitFor(); await page.waitForTimeout(800);
  await page.getByText("Team & Roles").first().scrollIntoViewIfNeeded();
});

await shot("after-admin-appointments", async (page) => {
  await adminLogin(page, "ADMIN");
  await page.locator("nav.space-y-2").getByRole("button", { name: "Appointments" }).click();
  await page.getByText("Deposit paid").first().waitFor({ timeout: 20000 });
  await page.getByText("Deposit paid").first().evaluate((el) => el.closest(".rounded-lg, [class*=card]")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(800);
});

await shot("after-doctor-view", async (page) => {
  await adminLogin(page, "DOCTOR");
  await page.waitForTimeout(1500);
});

await shot("after-patient-portal", async (page) => {
  await page.goto(base + "/login");
  await page.fill("#email", env.E2E_PATIENT_EMAIL); await page.fill("#password", env.E2E_PATIENT_PASSWORD);
  await page.locator("form button[type=submit]").first().click();
  await page.waitForURL("**/patient-dashboard"); await page.getByText("Cavity Filling").waitFor(); await page.waitForTimeout(1000);
});

await shot("after-home", async (page) => { await page.goto(base + "/", { waitUntil: "networkidle" }); await page.waitForTimeout(2500); });
await shot("before-home", async (page) => { await page.goto("https://hardik-dental-before.vercel.app/", { waitUntil: "networkidle" }); await page.waitForTimeout(2500); });
await shot("after-home-phone", async (page) => { await page.goto(base + "/", { waitUntil: "networkidle" }); await page.waitForTimeout(1500); }, { width: 390, height: 844 });
await shot("before-header-800", async (page) => { await page.goto("https://hardik-dental-before.vercel.app/", { waitUntil: "networkidle" }); await page.waitForTimeout(1000); }, { width: 800, height: 450 });
await shot("after-header-800", async (page) => { await page.goto(base + "/", { waitUntil: "networkidle" }); await page.waitForTimeout(1000); }, { width: 800, height: 450 });
await browser.close();
