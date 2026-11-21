# Hardik Dental: QA audit, fixes and new features

A fork of [HardikQuantumCybernetic/hardik-dental](https://github.com/HardikQuantumCybernetic/hardik-dental)
(MIT licence, © 2025 Hardik Dental), a dental clinic site and admin panel generated with Lovable
(Vite, React, TypeScript, shadcn/ui, Tailwind, Supabase, Clerk). Audit, fixes and features by
Daniel Omoyibo, November 2026.

| | Link |
|---|---|
| Before (original code, untouched database rules) | https://hardik-dental-before.vercel.app |
| After (fixed and extended) | https://hardik-dental-after.vercel.app |
| Full bug log with steps to reproduce | [BUGS.md](BUGS.md) |
| Source code | https://github.com/Boskiomoh/hardik-dental-rescue |

Both sites use fictional demo data. The "before" site is left broken on purpose.

## The short version

- **Online booking failed for every visitor.** The form showed a raw database error and saved nothing.
- **Anyone could read, change and delete patient billing records** with the public key in the browser.
- **Live secrets were committed to the repo**: a Clerk secret key, the database password and a Gemini API key.
- The patient portal couldn't load a patient's own data, the contact form never delivered a message, and a
  fresh database couldn't be built from the migrations.

21 bugs logged, 20 fixed (one documented as out of scope), and two features added: **role-based staff
access** and an **optional $25 deposit through Stripe Checkout**.

## Before and after

Measured on the two live sites on 21 November 2026, same machine and settings.

| Measure | Before | After |
|---|---|---|
| Playwright tests passing (same 49 tests) | 11 | **49** |
| Accessibility violations (axe, 11 routes × 2 widths) | 182 elements | **0** |
| Lighthouse mobile performance, home (median of 3) | 38 | **78** |
| Lighthouse mobile performance, booking (median of 3) | 52 | **77** |
| Lighthouse best practices, home | 79 | **100** |
| Largest Contentful Paint, mobile home | 6.3 s | **4.0 s** |
| Total blocking time, mobile home | 1,235 ms | **5 ms** |
| Page weight, home | 1,066 KiB | **258 KiB** |
| Main JavaScript file | 2,408 kB (601 kB gzip) | **345 kB (97 kB gzip)** |
| Anonymous access to patient billing | read, change, delete | **none** |

Raw results: `audit/results/live-before`, `audit/results/live-after`, `audit/results/before/playwright-results.txt`.

## What I fixed

| Bug | Fix |
|---|---|
| B01 Secrets in the repo | New repo history from a cleaned snapshot; env vars only. (The original owner still needs to rotate the keys.) |
| B02, B08 Patient data open to anyone | Removed the "(dev)" policies; row-level security by role; role helpers no longer callable by visitors |
| B03, B05 Booking fails / double booking | One validated `book_appointment()` database function; unique slot index; `get_booked_slots()` returns times only |
| B04, B14 Contact form fails | Insert without reading back; contact messages carry no rating (enforced by a check constraint) |
| B06, B15 Patient portal / blank dev server | One login system (Supabase Auth); patients linked by confirmed email; Clerk removed |
| B07 Database can't be rebuilt | Migration recreating the four missing base tables |
| B09 2.4 MB bundle | Lazy-loaded routes; the three.js scene loads only on wide screens, after page load |
| B10, B11 Accessibility | Labels for icon buttons and rating stars; brand colours darkened to WCAG AA contrast |
| B12 Header button off-screen | Desktop nav from 1024 px; measured at 800, 1024, 1280 and 1440 px |
| B13, B18 Fake doctors / false promises | Doctors and services from the database; removed invented date of birth and email/SMS claims |
| B16 Invented admin numbers | Real upcoming appointments; working quick actions; real signed-in user |
| B17 Three clinic names, wrong phone links | One config file; links dial the number shown |
| B19 Patient data in the console | Removed |
| B21 "Dr. Dr. Smith" | Removed the extra prefix in the portal, admin lists and WhatsApp text |

**Not fixed: B20.** The AI chatbot's Edge Function has only a per-instance rate limit. Fixing it needs a shared
store and the clinic's Gemini key, so the chatbot isn't deployed in this demo.

## New features

**Role-based access.** Admin sees everything plus a Team & Roles tab for granting and removing roles by email.
Front desk sees patients, appointments, billing and contact messages. Doctors see patients and appointments,
with no billing and no deleting. The database enforces the same rules: hiding a button is never the only protection.

**Stripe deposit.** After booking, a patient can pay a $25 deposit in Stripe Checkout. Supabase Edge Functions
create the session and ask Stripe whether it was paid, so the browser can never mark itself paid. A Stripe webhook
also marks the deposit paid if the patient closes the tab before returning. Tested by blocking the site's own
confirmation call (`audit/probes/deposit-webhook.mjs`).

## Tests

`npm run test:e2e` runs 49 Playwright tests: booking, double booking, contact form, patient portal, each staff
role, anonymous and per-role database access through the REST API, layout checks, and axe accessibility on
9 routes at 1280 px and 375 px. `E2E_STRIPE=1` adds a full Stripe test-mode payment. The same suite run against
the original passes 11 of 49.

## How it was measured

- **Accessibility and console errors:** `audit/scan.mjs` (Playwright and axe-core, WCAG 2.1 AA).
- **Performance:** `audit/lighthouse-median.mjs` (Lighthouse 12.8.2, mobile, median of 3 runs).
- **User flows:** `audit/probes/*.mjs` replay them. `audit/build-before-schema.mjs` rebuilds the original
  database from the upstream migrations into a separate `before` schema.
