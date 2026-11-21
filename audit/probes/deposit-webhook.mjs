// Proves the Stripe webhook on its own: pays a deposit in Stripe test mode
// while blocking the site's own confirm-deposit call, so only the webhook can
// mark the booking paid.
// Usage: node audit/probes/deposit-webhook.mjs <baseUrl>
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "https://hardik-dental-after.vercel.app";
const email = `webhook.check.${Date.now()}@example.com`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// As if the patient closed the tab: the site's own confirmation call never
// reaches the server (Playwright can't intercept Stripe's cross-site redirect,
// so block the confirm-deposit request itself)
let blockedConfirm = false;
await page.route(/\/functions\/v1\/confirm-deposit/, (route) => { blockedConfirm = true; return route.abort(); });
let returned = false;
page.on("framenavigated", (frame) => { if (frame === page.mainFrame() && frame.url().includes("deposit=success")) returned = true; });

await page.goto(base + "/booking");
const day = new Date(Date.now() + (20 + (Date.now() % 100)) * 86_400_000);
if (day.getDay() === 0) day.setDate(day.getDate() + 1);
await page.fill("#firstName", "Webhook");
await page.fill("#lastName", "Check");
await page.fill("#email", email);
await page.fill("#phone", "5550107777");
await page.fill("#date", day.toISOString().slice(0, 10));
await page.locator("#doctor:not([disabled])").waitFor();
await page.locator("#doctor").click();
await page.getByRole("option", { name: "Dr. Johnson" }).click();
await page.locator("#time").click();
await page.getByRole("option", { name: /^\d+:\d+ (AM|PM)$/ }).first().click();
await page.locator("#service").click();
await page.getByRole("option", { name: "Regular Cleaning" }).click();
await page.locator("form button[type=submit]").click();
await page.getByRole("button", { name: "Pay $25 deposit" }).click({ timeout: 20_000 });

await page.waitForURL(/checkout\.stripe\.com/, { waitUntil: "commit", timeout: 30_000 });
if (!/\/cs_test_/.test(page.url())) throw new Error("Not a Stripe test-mode session; stopping.");
const form = page.frameLocator('iframe[src*="elements-inner-habanero"]').first();
await form.getByText("Card", { exact: true }).first().click({ timeout: 60_000 });
await form.locator("#payment-numberInput").fill("4242424242424242");
await form.locator("#payment-expiryInput").fill("12 / 34");
await form.locator("#payment-cvcInput").fill("123");
await form.locator("#payment-nameInput").fill("Webhook Check");
const zip = form.locator("#payment-postalCodeInput");
if (await zip.isVisible().catch(() => false)) await zip.fill("10001");
await form.getByRole("button", { name: "Pay", exact: true }).click();

for (let i = 0; i < 60 && !(returned && blockedConfirm); i++) await page.waitForTimeout(1000);
await browser.close();
console.log("payment submitted; back on site:", returned, "| confirm-deposit blocked:", blockedConfirm);

// Visitors can't read appointments, so check the result with the Supabase CLI:
//   npx supabase db query --remote=<ref> --read-only "select a.deposit_status from public.appointments a
//     join public.patients p on p.id = a.patient_id where p.email = '<CHECK_EMAIL>'"
// Only the webhook can have marked it paid. (Verified 21 Nov 2026: paid within 5 s.)
console.log("CHECK_EMAIL", email);
