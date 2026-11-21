// Full deposit flow in Stripe TEST mode: book -> Pay $25 deposit -> Stripe
// Checkout with Stripe's published test card 4242 4242 4242 4242 -> back to
// the site -> the server confirms with Stripe. Refuses to type a card unless
// the Checkout page says it is a test/sandbox account.
// Usage: node audit/probes/deposit-pay.mjs <baseUrl> <outPrefix>
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:8081";
const out = process.argv[3] ?? "audit/results/after/deposit";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(base + "/booking", { waitUntil: "load" });
  await page.locator("#firstName").waitFor();
  // A different day each run (7 to 60 days ahead) so earlier runs don't fill it
  const day = new Date(Date.now() + (7 + (Date.now() % 54)) * 86400000);
  if (day.getDay() === 0) day.setDate(day.getDate() + 1);
  await page.fill("#firstName", "Demo");
  await page.fill("#lastName", "Payer");
  await page.fill("#email", `demo.payer${Date.now() % 10000}@example.com`);
  await page.fill("#phone", "5550105555");
  await page.fill("#date", day.toISOString().slice(0, 10));
  await page.locator("#doctor:not([disabled])").waitFor();
  await page.locator("#service:not([disabled])").waitFor();
  await page.locator("#doctor").click();
  await page.getByRole("option", { name: "Dr. Brown" }).click();
  await page.locator("#time").click();
  await page.getByRole("option", { name: /^\d+:\d+ (AM|PM)$/ }).first().click();
  await page.locator("#service").click();
  await page.getByRole("option", { name: "Teeth Whitening" }).click();
  await page.locator("form button[type=submit]").click();
  await page.getByRole("button", { name: "Pay $25 deposit" }).click({ timeout: 20000 });

  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000, waitUntil: "commit" });
  // Stripe only issues cs_test_ sessions in test mode
  if (!/\/cs_test_/.test(page.url())) throw new Error("Not a Stripe test-mode session; stopping.");
  await page.locator('iframe[src*="elements-inner-habanero"]').first().waitFor({ timeout: 30000 });
  console.log("on Stripe Checkout (test-mode session)");
  await page.screenshot({ path: `${out}-stripe.png`, timeout: 10000 }).catch(() => {});

  // Checkout's payment form lives in a Stripe Elements iframe; the card
  // fields appear after choosing Card
  const form = page.frameLocator('iframe[src*="elements-inner-habanero"]').first();
  await form.getByText("Card", { exact: true }).first().click({ timeout: 30000 });
  await form.locator("#payment-numberInput").fill("4242424242424242");
  await form.locator("#payment-expiryInput").fill("12 / 34");
  await form.locator("#payment-cvcInput").fill("123");
  await form.locator("#payment-nameInput").fill("Demo Payer");
  const zip = form.locator("#payment-postalCodeInput");
  if (await zip.isVisible().catch(() => false)) await zip.fill("10001");
  await form.getByRole("button", { name: "Pay", exact: true }).click();

  // Stripe may show a bot-check challenge to automated browsers. Never touch
  // it: stop and leave the test payment to a person.
  const challenge = page.frameLocator('iframe[src*="hcaptcha"]').locator("text=/Verify|challenge/i");
  const outcome = await Promise.race([
    page.waitForURL(/deposit=success/, { timeout: 60000, waitUntil: "commit" }).then(() => "returned"),
    challenge.first().waitFor({ state: "visible", timeout: 60000 }).then(() => "challenge"),
  ]);
  if (outcome === "challenge") {
    await page.screenshot({ path: `${out}-challenge.png` });
    throw new Error("Stripe showed a CAPTCHA challenge; stopping. Complete this test payment by hand.");
  }
  await page.waitForURL(/deposit=success/, { timeout: 60000, waitUntil: "commit" });
  await page.getByText(/Deposit received|Payment not completed|Couldn't check/).waitFor({ timeout: 20000 });
  console.log("back on site:", await page.locator("h3").first().innerText());
  await page.screenshot({ path: `${out}-paid.png` });
} catch (err) {
  await page.screenshot({ path: `${out}-failed.png`, fullPage: true }).catch(() => {});
  const messages = await page.locator("ol li, [role=alert]").allInnerTexts().catch(() => []);
  console.log("FAILED at", page.url().slice(0, 60), "| messages:", JSON.stringify(messages.filter(Boolean).slice(0, 3)));
  console.log(String(err.message).split("\n")[0]);
  process.exitCode = 1;
}

await browser.close();
