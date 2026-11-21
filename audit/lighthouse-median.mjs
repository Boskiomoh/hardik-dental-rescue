// Runs Lighthouse (mobile, default throttling) 3 times per page and keeps
// the median performance run, so one noisy run can't skew the comparison.
// Usage: node audit/lighthouse-median.mjs <baseUrl> <label>
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const [baseUrl, label] = process.argv.slice(2);
const outDir = `audit/results/${label}/lighthouse`;
mkdirSync(outDir, { recursive: true });
const summary = {};

for (const [name, path] of [["home", "/"], ["booking", "/booking"]]) {
  const runs = [];
  for (let i = 1; i <= 3; i++) {
    const file = `${outDir}/mobile-${name}-run${i}.json`;
    execFileSync("npx", ["-y", "lighthouse@12.8.2", baseUrl + path, "--quiet", "--chrome-flags=--headless=new",
      "--output=json", `--output-path=${file}`, "--only-categories=performance,accessibility,best-practices,seo"],
      { stdio: "ignore", shell: true });
    const r = JSON.parse(readFileSync(file, "utf8"));
    runs.push({
      file,
      performance: Math.round(r.categories.performance.score * 100),
      accessibility: Math.round(r.categories.accessibility.score * 100),
      bestPractices: Math.round(r.categories["best-practices"].score * 100),
      seo: Math.round(r.categories.seo.score * 100),
      fcpMs: Math.round(r.audits["first-contentful-paint"].numericValue),
      lcpMs: Math.round(r.audits["largest-contentful-paint"].numericValue),
      tbtMs: Math.round(r.audits["total-blocking-time"].numericValue),
      cls: Number(r.audits["cumulative-layout-shift"].numericValue.toFixed(3)),
      bytesKiB: Math.round(r.audits["total-byte-weight"].numericValue / 1024),
    });
  }
  runs.sort((a, b) => a.performance - b.performance);
  summary[name] = { median: runs[1], allPerformance: runs.map((r) => r.performance) };
  console.log(label, name, JSON.stringify(summary[name]));
}
writeFileSync(`${outDir}/summary.json`, JSON.stringify({ baseUrl, measuredAt: new Date().toISOString(), ...summary }, null, 2));
