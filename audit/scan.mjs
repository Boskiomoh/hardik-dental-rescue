// QA scan: visits every route at desktop and phone width and records
// console errors, uncaught page errors, failed requests, axe violations,
// horizontal overflow and a screenshot. Run against "before" and "after".
//
// Usage: node audit/scan.mjs <baseUrl> <label>
//   e.g. node audit/scan.mjs http://localhost:8080 before

import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const [baseUrl = "http://localhost:8080", label = "scan"] = process.argv.slice(2);

const ROUTES = [
  "/",
  "/services",
  "/about",
  "/booking",
  "/contact",
  "/feedback",
  "/login",
  "/signup",
  "/admin",
  "/patient-dashboard",
  "/this-page-does-not-exist",
];

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 375, height: 812 },
};

const outDir = `audit/results/${label}`;
mkdirSync(`${outDir}/screens`, { recursive: true });

const browser = await chromium.launch();
const results = [];

for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
  for (const route of ROUTES) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
    });
    page.on("pageerror", (err) => pageErrors.push(String(err.message).slice(0, 300)));
    page.on("response", (res) => {
      if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url().slice(0, 160)}`);
    });
    page.on("requestfailed", (req) => {
      failedRequests.push(`FAILED ${req.url().slice(0, 160)} ${req.failure()?.errorText ?? ""}`);
    });

    const started = Date.now();
    let loadError = null;
    try {
      await page.goto(baseUrl + route, { waitUntil: "networkidle", timeout: 45000 });
    } catch (err) {
      loadError = String(err.message).split("\n")[0];
    }
    const loadMs = Date.now() - started;
    await page.waitForTimeout(1500);

    const overflowPx = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );

    let axe = { violations: [] };
    try {
      axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    } catch (err) {
      loadError = loadError ?? `axe: ${String(err.message).split("\n")[0]}`;
    }

    const slug = route === "/" ? "home" : route.slice(1).replace(/\W+/g, "-");
    await page.screenshot({ path: `${outDir}/screens/${viewportName}-${slug}.png`, fullPage: false });

    results.push({
      viewport: viewportName,
      route,
      loadMs,
      loadError,
      overflowPx,
      consoleErrors,
      pageErrors,
      failedRequests,
      axe: axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
        help: v.help,
      })),
    });
    console.log(
      `${viewportName.padEnd(7)} ${route.padEnd(28)} axe=${axe.violations.length} console=${consoleErrors.length} pageErr=${pageErrors.length} overflow=${overflowPx}px ${loadError ?? ""}`
    );
    await context.close();
  }
}

await browser.close();

const summary = {
  label,
  baseUrl,
  scannedAt: new Date().toISOString(),
  pages: results.length,
  axeViolationTypes: results.reduce((n, r) => n + r.axe.length, 0),
  axeViolationNodes: results.reduce((n, r) => n + r.axe.reduce((m, v) => m + v.nodes, 0), 0),
  consoleErrors: results.reduce((n, r) => n + r.consoleErrors.length, 0),
  pageErrors: results.reduce((n, r) => n + r.pageErrors.length, 0),
  pagesWithOverflow: results.filter((r) => r.overflowPx > 0).length,
};
writeFileSync(`${outDir}/scan.json`, JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
