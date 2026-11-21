// Fills the public booking form like a visitor and screenshots the result.
// Usage: node audit/probes/booking-before.mjs <baseUrl> <outPrefix>
import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://localhost:8080";
const out = process.argv[3] ?? "audit/results/before/booking";
const service = process.argv[4] ?? "Teeth Cleaning";
const time = process.argv[5] ?? "10:00 AM";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
await page.goto(base + "/booking", { waitUntil: "networkidle" });

const day = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
await page.fill("#firstName", "Demo");
await page.fill("#lastName", "Visitor");
await page.fill("#email", "demo.visitor@example.com");
await page.fill("#phone", "5550101234");
await page.fill("#date", day);
const combos = page.locator("button[role=combobox]");
// doctor (3rd), then time (1st, enabled once date+doctor set), then service (2nd)
await combos.nth(2).click();
await page.getByRole("option", { name: "Dr. Smith" }).click();
await combos.nth(0).click();
const timeOptions = await page.getByRole("option").evaluateAll((els) =>
  els.map((e) => `${e.textContent.trim()}${e.getAttribute("data-disabled") !== null ? " (disabled)" : ""}`)
);
console.log("time options for", day, "Dr. Smith:", timeOptions.slice(0, 6).join(", "));
await page.getByRole("option", { name: time, exact: true }).click();
await combos.nth(1).click();
await page.getByRole("option", { name: service }).click();
await page.screenshot({ path: `${out}-filled.png`, fullPage: false });
await page.locator("form button[type=submit]").click();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}-result.png`, fullPage: false });
const toasts = await page.locator("[role=status], li[data-sonner-toast], ol li").allInnerTexts();
console.log("toasts:", JSON.stringify(toasts.filter(Boolean).slice(0, 3)));
console.log("console errors:", JSON.stringify(errors.slice(0, 3)));
await browser.close();
