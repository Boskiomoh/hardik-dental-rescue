// Submits the contact form and the feedback form like a visitor.
import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://localhost:8080";
const out = process.argv[3] ?? "audit/results/before";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));

await page.goto(base + "/contact", { waitUntil: "networkidle" });
const fields = await page.locator("form input, form textarea, form button").evaluateAll((els) =>
  els.map((e) => `${e.tagName}#${e.id}[${e.getAttribute("type")}] ${e.getAttribute("placeholder") ?? e.textContent.trim().slice(0, 30)}`)
);
console.log("contact fields:\n" + fields.join("\n"));
await page.goto(base + "/feedback", { waitUntil: "networkidle" });
const ffields = await page.locator("input, textarea, button").evaluateAll((els) =>
  els.map((e) => `${e.tagName}#${e.id}[${e.getAttribute("type")}] ${e.getAttribute("placeholder") ?? e.getAttribute("aria-label") ?? e.textContent.trim().slice(0, 30)}`)
);
console.log("feedback fields:\n" + ffields.slice(0, 40).join("\n"));
await browser.close();
