import { expect, test } from "@playwright/test";
import { fillBookingForm, freshBookingDate, uniqueEmail } from "./helpers";

// Stripe deposit feature. Opt-in (E2E_STRIPE=1) because it goes through
// Stripe's hosted Checkout in test mode, which is slow and external.
test.skip(!process.env.E2E_STRIPE, "Set E2E_STRIPE=1 to run the Stripe test-mode payment");

test("a patient pays the $25 deposit with Stripe's test card", async ({ page }) => {
  test.setTimeout(150_000);
  await fillBookingForm(page, {
    email: uniqueEmail("e2e.deposit"),
    date: freshBookingDate(),
    doctor: "Dr. Brown",
    service: "Teeth Whitening",
  });
  await page.locator("form button[type=submit]").click();
  await page.getByRole("button", { name: "Pay $25 deposit" }).click();

  await page.waitForURL(/checkout\.stripe\.com/, { waitUntil: "commit", timeout: 30_000 });
  // Stripe only issues cs_test_ sessions in test mode; never type a card otherwise
  expect(page.url()).toMatch(/\/cs_test_/);

  const form = page.frameLocator('iframe[src*="elements-inner-habanero"]').first();
  await form.getByText("Card", { exact: true }).first().click({ timeout: 30_000 });
  await form.locator("#payment-numberInput").fill("4242424242424242");
  await form.locator("#payment-expiryInput").fill("12 / 34");
  await form.locator("#payment-cvcInput").fill("123");
  await form.locator("#payment-nameInput").fill("E2E Test");
  const zip = form.locator("#payment-postalCodeInput");
  if (await zip.isVisible().catch(() => false)) await zip.fill("10001");
  await form.getByRole("button", { name: "Pay", exact: true }).click();

  await page.waitForURL(/deposit=success/, { waitUntil: "commit", timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Deposit received" })).toBeVisible({ timeout: 20_000 });
});
