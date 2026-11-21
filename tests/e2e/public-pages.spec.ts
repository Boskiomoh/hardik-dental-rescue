import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = ["/", "/services", "/about", "/booking", "/contact", "/feedback", "/login", "/signup", "/admin"];

// BUGS.md B10, B11: no WCAG 2.1 AA violations, on desktop and phone widths
for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test.describe(`accessibility at ${viewport.width}px`, () => {
    test.use({ viewport });
    for (const route of routes) {
      test(`${route} has no axe violations`, async ({ page }) => {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(results.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
      });
    }
  });
}

// BUGS.md B12
for (const width of [800, 1024, 1280]) {
  test(`"Book Appointment" is reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/");
    if (width < 1024) {
      await page.getByRole("button", { name: "Open menu" }).click();
    }
    const cta = page.getByRole("navigation").getByRole("link", { name: "Book Appointment" }).first();
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  });
}

// BUGS.md B17
test("every page shows the same phone number and email", async ({ page }) => {
  for (const route of ["/", "/contact", "/booking"]) {
    await page.goto(route);
    // Pages load lazily; wait for the real content, not the loading screen
    await expect(page.locator("body")).toContainText("(555) 123-4567");
    await expect(page.locator("body")).toContainText("hello@hardikdental.example");
    expect(await page.locator("body").innerText()).not.toMatch(/808\)? ?095|smilecare|DentalCare Pro/i);
  }
});

// BUGS.md B04, B14
test("the contact form sends a message", async ({ page }) => {
  await page.goto("/contact");
  await page.locator("#contactFirstName").fill("Test");
  await page.locator("#contactLastName").fill("Visitor");
  await page.locator("#contactEmail").fill(`e2e.contact.${Date.now()}@example.com`);
  await page.locator("#contactSubject").fill("Playwright test");
  await page.locator("#contactMessage").fill("Automated test message, please ignore.");
  await page.locator("form button[type=submit]").click();
  await expect(page.getByText("Message Sent Successfully!").first()).toBeVisible();
});

// BUGS.md B09: phones don't run the decorative three.js scene
test("phones never start the 3D scene", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  // The 3D scene renders into a WebGL <canvas>; nothing else on the page does
  await expect(page.locator("canvas")).toHaveCount(0);
});
