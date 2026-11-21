import { expect, type Page } from "@playwright/test";

export const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example and .env.test.local)`);
  return value;
};

export type TestRole = "ADMIN" | "STAFF" | "DOCTOR" | "PATIENT";

export const login = (role: TestRole) => ({
  email: env(`E2E_${role}_EMAIL`),
  password: env(`E2E_${role}_PASSWORD`),
});

// A weekday 7–150 days ahead that changes every run, so repeated runs
// against the same database don't fill up the same day
export const freshBookingDate = () => {
  const day = new Date(Date.now() + (7 + (Date.now() % 144)) * 86_400_000);
  if (day.getDay() === 0) day.setDate(day.getDate() + 1);
  return day.toISOString().slice(0, 10);
};

export const uniqueEmail = (prefix: string) => `${prefix}.${Date.now()}@example.com`;

type BookingDetails = { email: string; date: string; doctor: string; service: string; time?: string };

// Fills the public booking form; returns the time label that was chosen
export const fillBookingForm = async (page: Page, booking: BookingDetails) => {
  await page.goto("/booking");
  await page.locator("#firstName").fill("Test");
  await page.locator("#lastName").fill("Visitor");
  await page.locator("#email").fill(booking.email);
  await page.locator("#phone").fill("5550100000");
  await page.locator("#date").fill(booking.date);
  await expect(page.locator("#doctor")).toBeEnabled();
  await expect(page.locator("#service")).toBeEnabled();
  await page.locator("#doctor").click();
  await page.getByRole("option", { name: booking.doctor }).click();
  await page.locator("#time").click();
  const timeOption = booking.time
    ? page.getByRole("option", { name: booking.time, exact: true })
    : page.getByRole("option", { name: /^\d{1,2}:\d{2} (AM|PM)$/ }).first();
  const timeLabel = (await timeOption.innerText()).trim();
  await timeOption.click();
  await page.locator("#service").click();
  await page.getByRole("option", { name: booking.service }).click();
  return timeLabel;
};

export const signInToAdmin = async (page: Page, role: TestRole) => {
  const { email, password } = login(role);
  await page.goto("/admin");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("form button[type=submit]").click();
};

// Talks to Supabase's REST API directly, the way any visitor could
export const supabaseRest = async (path: string, init: RequestInit & { token?: string } = {}) => {
  const key = env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const response = await fetch(`${env("VITE_SUPABASE_URL")}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${init.token ?? key}`,
      "Content-Type": "application/json",
      // Lets the same tests run against the untouched "before" schema
      ...(process.env.E2E_DB_SCHEMA ? { "Accept-Profile": process.env.E2E_DB_SCHEMA, "Content-Profile": process.env.E2E_DB_SCHEMA } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
};

export const accessToken = async (role: TestRole) => {
  const { body } = await supabaseRest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify(login(role)),
  });
  if (!body?.access_token) throw new Error(`Sign-in failed for ${role}`);
  return body.access_token as string;
};
