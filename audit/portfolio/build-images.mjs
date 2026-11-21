// Builds the Upwork portfolio images (1600x1200) from real screenshots and
// the measured numbers in audit/results. Nothing here is mocked: every
// screenshot comes from the live before/after sites or the test runs.
// Usage: node audit/portfolio/build-images.mjs <outDir>
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";

const outDir = process.argv[2] ?? "audit/portfolio/out";
mkdirSync(outDir, { recursive: true });
// Embedded as data URIs: pages rendered with setContent can't load local files
const img = (p) => `data:image/png;base64,${readFileSync(p).toString("base64")}`;
const R = "audit/results";

const base = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { width: 1600px; height: 1200px; font-family: Inter, system-ui, sans-serif; color: #0f172a;
      background: #f8fafc; padding: 64px 72px; display: flex; flex-direction: column; gap: 32px; overflow: hidden; }
    .eyebrow { font-size: 22px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #0b5fe0; }
    h1 { font-size: 56px; line-height: 1.08; font-weight: 800; letter-spacing: -0.02em; }
    h2 { font-size: 26px; font-weight: 700; }
    .sub { font-size: 24px; color: #475569; line-height: 1.4; }
    .row { display: flex; gap: 32px; }
    .panel { flex: 1; background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .tag { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; font-size: 20px; padding: 8px 16px; border-radius: 999px; width: fit-content; }
    .bad { background: #fee2e2; color: #991b1b; } .good { background: #dcfce7; color: #166534; }
    .shot { width: 100%; border-radius: 12px; border: 1px solid #e2e8f0; display: block; object-fit: cover; object-position: top; }
    .caption { font-size: 19px; color: #475569; line-height: 1.4; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
    .stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 22px 24px; }
    .stat .label { font-size: 18px; color: #475569; font-weight: 500; }
    .stat .val { font-size: 40px; font-weight: 800; margin-top: 6px; letter-spacing: -0.01em; }
    .stat .from { color: #94a3b8; text-decoration: line-through; font-weight: 700; font-size: 26px; margin-right: 10px; }
    .footer { margin-top: auto; font-size: 17px; color: #64748b; }
    pre { font-family: "JetBrains Mono", monospace; font-size: 17px; line-height: 1.55; background: #0f172a; color: #e2e8f0; border-radius: 14px; padding: 20px 22px; white-space: pre-wrap; }
    .k { color: #93c5fd; } .r { color: #fca5a5; } .g { color: #86efac; } .m { color: #94a3b8; }
  </style>`;

const pages = {
  "01-cover": `
    <div class="eyebrow">AI-built app rescue · Lovable · React + Supabase</div>
    <h1>Dental clinic booking app: audited, fixed and extended</h1>
    <div class="sub">An open-source app generated with Lovable. Online booking failed for every visitor and patient billing records were open to anyone. I found 21 bugs, fixed 20, and added staff roles and a Stripe deposit.</div>
    <div class="row" style="height: 520px">
      <div class="panel"><span class="tag bad">Before: booking fails</span><img class="shot" style="height:440px" src="${img(`${R}/live/before-booking-result.png`)}"></div>
      <div class="panel"><span class="tag good">After: booking works</span><img class="shot" style="height:440px" src="${img(`${R}/live/after-booking-success.png`)}"></div>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">Playwright tests passing</div><div class="val"><span class="from">11/49</span>49/49</div></div>
      <div class="stat"><div class="label">Accessibility issues (axe)</div><div class="val"><span class="from">182</span>0</div></div>
      <div class="stat"><div class="label">Lighthouse mobile, home</div><div class="val"><span class="from">38</span>78</div></div>
      <div class="stat"><div class="label">Main JavaScript file</div><div class="val"><span class="from">2.4 MB</span>345 kB</div></div>
    </div>`,

  "02-booking": `
    <div class="eyebrow">The main business flow</div>
    <h1>Every online booking failed. Now it works, without double bookings</h1>
    <div class="row" style="flex:1">
      <div class="panel"><span class="tag bad">Before</span><img class="shot" style="height:600px" src="${img(`${R}/live/before-booking-result.png`)}">
        <div class="caption">Visitors got a raw database error ("row-level security policy") and no booking was saved. Taken times were never shown, so slots could be double-booked.</div></div>
      <div class="panel"><span class="tag good">After</span><img class="shot" style="height:600px" src="${img(`${R}/live/after-booking-slots.png`)}">
        <div class="caption">Bookings go through one validated database function. Taken times are greyed out, and the database rejects a second booking for the same doctor and time.</div></div>
    </div>`,

  "03-security": `
    <div class="eyebrow">Security audit</div>
    <h1>Anyone could read, change and delete patient billing records</h1>
    <div class="sub">Tested with only the public key that ships in the browser, the way an attacker would. Fictional demo data.</div>
    <div class="row">
      <div class="panel"><span class="tag bad">Before</span>
<pre><span class="m"># anonymous visitor, no login</span>
<span class="k">GET</span> /patient_financials
<span class="r">[{"total_treatment_cost":2000,"remaining":1500},
 {"total_treatment_cost":150,"remaining":0}]</span>

<span class="k">PATCH</span> /patient_financials?patient_id=eq.…
<span class="r">→ saved: "amount_paid_by_patient": 0</span>

<span class="k">DELETE</span> /patient_financials?patient_id=eq.…
<span class="r">→ 204, record gone</span></pre>
        <div class="caption">Also found: a live Clerk secret key, the database password and a Gemini API key committed to the repo.</div></div>
      <div class="panel"><span class="tag good">After</span>
<pre><span class="m"># same requests</span>
<span class="k">GET</span> /patient_financials     <span class="g">→ []</span>
<span class="k">PATCH</span> /patient_financials   <span class="g">→ [] (nothing changed)</span>
<span class="k">DELETE</span> /patient_financials  <span class="g">→ [] (nothing deleted)</span>

<span class="m"># signed in</span>
doctor     → billing <span class="g">[]</span>
front desk → billing <span class="g">2 rows</span>
patient    → own record only</pre>
        <div class="caption">Rewrote the Supabase row-level security policies by role. 14 Playwright tests now call the API directly to keep these holes closed.</div></div>
    </div>`,

  "04-roles": `
    <div class="eyebrow">New feature · role-based access</div>
    <h1>Admin, front desk and doctor each see only what they need</h1>
    <div class="row" style="flex:1">
      <div class="panel"><h2>Admin: Team & Roles tab</h2><img class="shot" style="height:620px" src="${img(`${R}/live/after-admin-team.png`)}">
        <div class="caption">The admin grants or removes roles by email. Admins can't remove their own admin role.</div></div>
      <div class="panel"><h2>Doctor: patients and appointments only</h2><img class="shot" style="height:620px" src="${img(`${R}/live/after-doctor-view.png`)}">
        <div class="caption">No billing, feedback or delete buttons, and the database refuses them too.</div></div>
    </div>`,

  "05-stripe": `
    <div class="eyebrow">New feature · Stripe Checkout</div>
    <h1>An optional $25 deposit to secure the booking</h1>
    <div class="row" style="flex:1">
      <div class="panel"><h2>Stripe Checkout (test mode)</h2><img class="shot" style="height:560px" src="${img(`${R}/after/deposit-stripe.png`)}"></div>
      <div class="panel"><h2>Confirmed by the server</h2><img class="shot" style="height:270px" src="${img(`${R}/after/deposit-paid.png`)}"><img class="shot" style="height:270px" src="${img(`${R}/live/after-admin-appointments.png`)}"></div>
    </div>
    <div class="caption">Supabase Edge Functions create the Checkout session and ask Stripe whether it was paid, so the browser can never mark itself paid. A webhook function is included for patients who close the tab early. Tested end to end with Stripe's 4242 test card.</div>`,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
for (const [name, body] of Object.entries(pages)) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${base}</head><body>${body}<div class="footer">Fork of github.com/HardikQuantumCybernetic/hardik-dental (MIT). Live before/after: hardik-dental-before.vercel.app · hardik-dental-after.vercel.app</div></body></html>`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log("built", name);
}
await browser.close();
