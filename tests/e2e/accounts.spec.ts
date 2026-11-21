import { expect, test } from "@playwright/test";
import { login, signInToAdmin } from "./helpers";

// BUGS.md B06, plus the role-based access feature

test("a patient signs in and sees only their own appointments", async ({ page }) => {
  const { email, password } = login("PATIENT");
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("form button[type=submit]").first().click();

  await expect(page).toHaveURL(/\/patient-dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Demo Patient");
  await expect(page.getByRole("heading", { name: "Regular Cleaning", level: 4 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cavity Filling", level: 5 })).toBeVisible();
  // Other patients' bookings (seeded demo data) must not appear
  await expect(page.getByText("Teeth Whitening")).toHaveCount(0);
  await expect(page.getByText("Dr. Dr.")).toHaveCount(0);
});

const tabsByRole = {
  ADMIN: ["Dashboard", "Patient Management", "Appointments", "Contact Messages", "Feedback", "Reports & Analytics", "Team & Roles"],
  STAFF: ["Dashboard", "Patient Management", "Appointments", "Contact Messages"],
  DOCTOR: ["Dashboard", "Patient Management", "Appointments"],
} as const;

for (const [role, tabs] of Object.entries(tabsByRole)) {
  test(`${role.toLowerCase()} sees only their tabs`, async ({ page }) => {
    await signInToAdmin(page, role as keyof typeof tabsByRole);
    const sidebar = page.locator("nav.space-y-2");
    await expect(sidebar.getByRole("button").first()).toBeVisible();
    await expect(sidebar.getByRole("button")).toHaveText([...tabs]);
  });
}

test("a doctor doesn't see billing or delete buttons", async ({ page }) => {
  await signInToAdmin(page, "DOCTOR");
  await page.locator("nav.space-y-2").getByRole("button", { name: "Appointments" }).click();
  await expect(page.getByRole("heading", { name: /appointment/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
});

test("a patient account can't open the admin panel", async ({ page }) => {
  await signInToAdmin(page, "PATIENT");
  await expect(page.getByText("This account doesn't have clinic staff access.").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("nav.space-y-2")).toHaveCount(0);
});

test("the admin can see the team on the Team & Roles tab", async ({ page }) => {
  await signInToAdmin(page, "ADMIN");
  await page.locator("nav.space-y-2").getByRole("button", { name: "Team & Roles" }).click();
  await expect(page.getByText(login("STAFF").email)).toBeVisible();
  await expect(page.getByText(login("DOCTOR").email)).toBeVisible();
});
