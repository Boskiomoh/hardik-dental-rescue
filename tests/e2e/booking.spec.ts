import { expect, test } from "@playwright/test";
import { fillBookingForm, freshBookingDate, uniqueEmail } from "./helpers";

// BUGS.md B03, B05, B13
test.describe("public booking", () => {
  test("a visitor can book an appointment", async ({ page }) => {
    await fillBookingForm(page, {
      email: uniqueEmail("e2e.booking"),
      date: freshBookingDate(),
      doctor: "Dr. Smith",
      service: "Regular Cleaning",
    });
    await page.locator("form button[type=submit]").click();

    await expect(page.getByRole("heading", { name: "Appointment Request Received!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay $25 deposit" })).toBeVisible();
    // Database errors must never reach the visitor
    await expect(page.getByText(/row-level security/i)).toHaveCount(0);
  });

  test("a slot that was just booked is greyed out for the next visitor", async ({ page }) => {
    const date = freshBookingDate();
    const time = await fillBookingForm(page, {
      email: uniqueEmail("e2e.first"),
      date,
      doctor: "Dr. Johnson",
      service: "Cavity Filling",
    });
    await page.locator("form button[type=submit]").click();
    await expect(page.getByRole("heading", { name: "Appointment Request Received!" })).toBeVisible();

    // Second visitor, same doctor and day
    await page.goto("/booking");
    await page.locator("#date").fill(date);
    await expect(page.locator("#doctor")).toBeEnabled();
    await page.locator("#doctor").click();
    await page.getByRole("option", { name: "Dr. Johnson" }).click();
    await page.locator("#time").click();
    const taken = page.getByRole("option", { name: `${time} (Booked)` });
    await expect(taken).toBeVisible();
    await expect(taken).toHaveAttribute("data-disabled", "");
  });

  test("the doctor list comes from the database", async ({ page }) => {
    await page.goto("/booking");
    await expect(page.locator("#doctor")).toBeEnabled();
    await page.locator("#doctor").click();
    await expect(page.getByRole("option")).toHaveText(["Dr. Brown", "Dr. Johnson", "Dr. Smith"]);
  });

  test("past dates can't be picked", async ({ page }) => {
    await page.goto("/booking");
    const min = await page.locator("#date").getAttribute("min");
    const today = new Date();
    const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    expect(min).toBe(localToday);
  });
});
