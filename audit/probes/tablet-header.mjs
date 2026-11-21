// Screenshots the header at tablet / small-laptop widths.
import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://localhost:8080";
const out = process.argv[3] ?? "audit/results/before";
const browser = await chromium.launch();
for (const width of [800, 1024, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 700 } });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  const cta = page.locator("nav a, nav button").filter({ hasText: "Book Appointment" }).first();
  const box = await cta.boundingBox().catch(() => null);
  console.log(width, "Book Appointment box:", JSON.stringify(box), "visible:", await cta.isVisible().catch(() => false));
  await page.screenshot({ path: `${out}/header-${width}.png`, clip: { x: 0, y: 0, width, height: 90 } });
  await page.close();
}
await browser.close();
