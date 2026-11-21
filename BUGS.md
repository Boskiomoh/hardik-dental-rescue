# QA audit: Hardik Dental (Lovable-generated clinic app)

Audited by Daniel Omoyibo, 21 November 2026.

**What was tested:** the original code from
[HardikQuantumCybernetic/hardik-dental](https://github.com/HardikQuantumCybernetic/hardik-dental)
(MIT licence, upstream commit `8cf9b70`), running from a production build. Its own database was
rebuilt from the repo's migrations into a separate `before` schema of a fresh Supabase project
(`audit/build-before-schema.mjs`), loaded with fictional demo data (`audit/seed-demo-data.mjs`).
The only change to the original code is that the Supabase URL/key come from env vars instead of being
hard-coded to the author's project.

**How:** manual testing in Chromium, scripted visitor flows with Playwright (`audit/probes/`),
an automated scan of 11 routes at 1280 px and 375 px with axe-core (`audit/scan.mjs`),
direct database calls with the public key that ships in the browser bundle, Lighthouse (mobile),
`vite build`, ESLint and a code review.

**Severity:** Critical = patient data exposed or the main business flow is dead.
High = a core feature is broken or unsafe. Medium = real users are affected, but there is a workaround.
Low = polish, content or developer-only.

Secret values are redacted everywhere in this report and its screenshots.

## Summary

| # | Severity | Area | Bug | Status (commit) |
|---|---|---|---|---|
| B01 | Critical | Security | Live secrets committed to the repo (Clerk secret key, database password, Gemini API key) | Fixed `b10c3eb` (keys out of our repo; the owner must still rotate them) |
| B02 | Critical | Security / privacy | Anyone can read, change and delete patient financial records and treatment plans | Fixed `0602e93` |
| B03 | Critical | Booking | Every online booking fails and shows the visitor a raw database error | Fixed `0602e93`, `62a099a` |
| B04 | High | Contact | The contact form always fails, so visitor messages never reach the clinic | Fixed `0bb764e` |
| B05 | High | Booking | Taken time slots are never shown, so a slot that is already booked is offered again | Fixed `0602e93`, `62a099a` |
| B06 | High | Auth | The patient portal can't load a patient's own data (Clerk login, Supabase database) | Fixed `0602e93`, `f075ff5` |
| B07 | High | Database | A fresh database can't be built from the migrations (base tables are never created) | Fixed `ff2fa08` |
| B08 | Medium | Security | Anyone can edit feedback records (e.g. mark complaints as "reviewed") | Fixed `0602e93` |
| B09 | Medium | Performance | The whole app ships as one 2.4 MB JavaScript file, 3D scene included | Fixed `830bf33` |
| B10 | Medium | Accessibility | 55 icon-only buttons have no accessible name (axe `button-name`, critical) | Fixed `e277a5b`, `ce8aceb` |
| B11 | Medium | Accessibility | 127 text elements fail colour contrast (axe `color-contrast`, serious) | Fixed `e277a5b` |
| B12 | Medium | Layout | The header's "Book Appointment" button is off-screen between 768 px and ~1170 px | Fixed `ce8aceb` |
| B13 | Medium | Booking | The doctor list in the booking form doesn't match the clinic's doctors in the database | Fixed `62a099a` |
| B14 | Low | Data | Contact messages are stored as 5-star review rows | Fixed `0602e93`, `0bb764e` |
| B15 | Medium | Developer | `npm run dev` shows a blank page | Fixed `f075ff5` |
| B16 | Low | Content | Admin dashboard shows invented numbers ("+12% from last month", "Last login: Today, 9:30 AM") | Fixed `58e1a32` |
| B17 | Low | Content | Three different clinic names, two phone numbers and an Indian (+91) phone prefix | Fixed `c1c8978`, `62a099a` |
| B18 | Low | Booking | The form promises email and SMS confirmations that don't exist; date of birth is saved as 1990-01-01 | Fixed `62a099a`, `0602e93` |
| B19 | Low | Privacy | Patient and feedback data is printed to the browser console | Fixed `bce02b0`, `0bb764e` |
| B20 | Low | Security | The public AI chatbot endpoint has no real rate limit (per-instance memory only) | Not fixed: needs a shared rate-limit store and the clinic's Gemini key (chatbot not deployed in this demo) |
| B21 | Low | Content | Doctors appear as "Dr. Dr. Smith" in the patient portal, admin lists and WhatsApp messages | Fixed `f075ff5` (portal), `5cc5e7f` (admin) |

## Details

### B01 · Critical · Live secrets committed to the repo

**Where:** `.gitignore` lines 31–43 and `supabase/.env`, present since the first commit (`32fb313`).
The author seems to have pasted the contents of `.env` into `.gitignore` instead of the word `.env`.

**Steps:** open `.gitignore` on GitHub, or run `git log -p -- .gitignore supabase/.env`.

**Found:** `CLERK_SECRET_KEY` (`sk_test_…`), `DATABASE_URL` with the Postgres password, `GEMINI_API_KEY`
(`AIza…`), plus the Supabase project keys. Anyone can use the database password to bypass every access rule.

**Expected:** secrets only in the hosting provider's env settings; `.env*` ignored; the leaked keys rotated.

**Note:** none of these keys were used during the audit. The audit's own repo starts from a cleaned snapshot.

### B02 · Critical · Anyone can read, change and delete patient financial records and treatment plans

**Cause:** migration `20251004012947` ("Relax RLS policies … (dev/demo)") adds
`FOR ALL USING (true)` policies to `patient_financials` and `patient_services`, plus
"anyone can insert/update" on `patients` and `appointments`.

**Steps** (public key from the browser bundle, no login):
1. `GET /rest/v1/patient_financials?select=*` → every patient's treatment cost and balance.
2. `GET /rest/v1/patient_services?select=*` → every treatment plan with notes.
3. `PATCH /rest/v1/patient_financials?patient_id=eq.<id>` with `{"amount_paid_by_patient":0}` → saved.
4. `DELETE /rest/v1/patient_financials?patient_id=eq.<id>` → `204`, record gone.

**Expected:** only clinic staff can read or change financial and treatment data; patients see only their own.

### B03 · Critical · Every online booking fails

**Steps:** `/booking` → fill in name, email, phone, a date, Dr. Smith, 10:00 AM, Teeth Cleaning →
**Request Appointment**.

**Actual:** red toast "Booking Failed — new row violates row-level security policy for table "patients"".
No appointment is saved. Screenshot: `audit/results/before/booking-result.png`.

**Cause:** the form inserts the patient with `.insert(...).select().single()`. Returning the new row needs
read access to `patients`, which visitors (correctly) don't have, so the whole insert is rejected.
The form also looks the patient up by email first, which visitors can't do either.

**Expected:** the booking is saved and the visitor sees a confirmation, without being given read access to patient records.
Database error text should never be shown to visitors.

### B04 · High · The contact form always fails

**Steps:** `/contact` → fill in every field → **Send Message**.

**Actual:** toast "Failed to send message". Console: `new row violates row-level security policy for table "feedback"`.
Same cause as B03 (`feedbackService.create` uses `.insert().select()`). Screenshot: `audit/results/before/contact-result.png`.

**Expected:** the message is saved and appears in the admin "Contact Messages" tab.

### B05 · High · Taken time slots are offered again (double booking)

**Steps:** demo data has Demo Patient One booked with Dr. Smith at 10:00 two days from today.
Open `/booking`, choose that date and Dr. Smith, open the time list.

**Actual:** 10:00 AM is listed as available. The slot check queries `appointments`, which visitors can't read,
so it always gets an empty list and never disables anything.

**Expected:** taken slots are disabled for visitors, without exposing who booked them; the database rejects a second booking for the same doctor, date and time.

### B06 · High · The patient portal can't load the patient's own data

**Cause:** patients sign in with Clerk (`/login`, `/patient-dashboard`), but the database only knows Supabase
logins. The dashboard queries `patients` by email as an anonymous visitor.

**Steps:** run the dashboard's own query with the public key: `GET /rest/v1/patients?email=eq.<email>` → `[]`.
The dashboard then tries to create the patient with `.insert().select()`, which fails as in B03.

**Expected:** one login system, and the database knows who the patient is, so each patient sees only their own appointments.
(The "dev" policies in B02 were most likely added to work around this.)

### B07 · High · A fresh database can't be built from the migrations

**Steps:** `supabase db reset` (or apply `supabase/migrations/*` in order to an empty project).

**Actual:** `20250927091322` fails on `REFERENCES public.patients(id)`: no migration creates `patients`,
`appointments`, `treatments` or `practice_settings`. They only exist in the author's live database.

**Expected:** the migrations alone recreate the database, so a new developer or a staging environment can start from them.

### B08 · Medium · Anyone can edit feedback records

**Steps:** `PATCH /rest/v1/feedback?category=eq.service` with `{"status":"reviewed"}` using the public key → `204`.

**Cause:** policy "Anyone can update feedback (dev)". Complaints can be hidden or changed by anyone.

**Expected:** visitors can submit feedback; only admins can change it.

### B09 · Medium · One 2.4 MB JavaScript file for every page

**Steps:** `npm run build`.

**Actual:** `assets/index-*.js` is 2,408 kB (601 kB gzipped) and loads on every page: three.js and the 3D tooth,
the admin panel, recharts, jsPDF and html2canvas. Vite warns about it.
Lighthouse (mobile): Performance 35 on `/` (FCP 5.7 s, LCP 6.9 s, total blocking time 1,820 ms) and
43 on `/booking` (LCP 7.5 s).

**Expected:** pages and heavy libraries load on demand, so the home page only downloads what it shows.

### B10 · Medium · 55 icon-only buttons with no accessible name

**Steps:** `node audit/scan.mjs` → axe rule `button-name` (critical) on 11 of 22 page/viewport checks.

**Examples:** the feedback form's rating radio buttons (20 on `/feedback`), the mobile menu toggle, and the
password show/hide toggle on `/admin`. A screen reader announces them as just "button" or "radio button".

**Expected:** every button has a name (`aria-label` or visible text).

### B11 · Medium · 127 text elements fail colour contrast

**Steps:** `node audit/scan.mjs` → axe rule `color-contrast` (serious) on 12 of 22 checks.

**Examples:** the brand blue `#3c83f6` on white (3.63:1) used for the "Patient Login" button and
testimonial names; slate grey `#65758b` on `#f1f5f9` (4.28:1) for the feedback tab labels.

**Expected:** at least 4.5:1 for body text (WCAG 2.1 AA).

### B12 · Medium · Header "Book Appointment" button off-screen on tablets and small laptops

**Steps:** open `/` at 800 px wide → the button's left edge is at x=931, past the right edge of the screen.
At 1024 px it's cut off. Screenshots: `audit/results/before/header-800.png`, `header-1024.png`.

**Cause:** the full desktop nav (links, phone number, two buttons) switches on at the `md` breakpoint (768 px).

**Expected:** the main call to action is always visible.

### B13 · Medium · Booking doctors don't match the clinic's doctors

**Actual:** the form hard-codes six doctors (Smith, Johnson, Williams, Brown, Davis, Miller) and "Other";
the `doctors` table has three (Smith, Johnson, Brown). Bookings for the other three go to doctors who don't exist.

**Expected:** the list comes from the `doctors` table.

### B14 · Low · Contact messages are stored as 5-star review rows

**Cause:** `ContactForm.tsx` saves each message into `feedback` with `rating: 5`; the seed migration uses 3 and 5.
The admin Feedback tab filters `category = 'contact'` out, so its on-screen average is right, but any other
report or SQL query on `feedback` counts every contact message as a review.

**Expected:** contact messages carry no rating, enforced by the database.

### B15 · Medium · `npm run dev` shows a blank page

**Steps:** `npm ci && npm run dev` → open `http://localhost:8080`.

**Actual:** white page. Console: `The requested module '…/use-sync-external-store/shim/index.js' does not provide an export named 'useSyncExternalStore'`.

**Cause:** `vite.config.ts` excludes `@clerk/clerk-react` from dependency pre-bundling, so one of its CommonJS
dependencies is served raw. Production builds work, so the live site hides it from the author.

**Expected:** the dev server works after a clean install.

### B16 · Low · Admin dashboard shows invented numbers

**Actual:** "+12% from last month", "+5%", "+8%" are hard-coded under the stat cards. The header says
"Welcome back, Dr. Admin · Last login: Today, 9:30 AM" for every user.

Found while fixing this: the "Recent Notifications" panel is invented too ("Payment received from John Smith,
4 hours ago", "Appointment reminder sent to 12 patients"), and the four Quick Action buttons only show a toast
saying the feature "is ready to use!". "Today's appointments" compares against the UTC date, so it is wrong
in the evening for clinics west of UTC.

**Expected:** show real figures or nothing; buttons do what they say.

### B17 · Low · Inconsistent clinic identity

**Actual:** the browser tab says "DentalCare Pro", the logo says "Hardik Dental", and the footer email is
`info@smilecare.com`. The header phone is (808) 095-0921, but the contact cards and footer say (555) 123-4567.
The booking form's phone field has a fixed +91 (India) prefix.

Found while fixing this: the footer's "Main: (555) 123-4567" and "Emergency: (555) 123-4568" links both
dial (808) 095-0921, and the site gives five different sets of opening hours (footer, contact page, booking
card and two in the chatbot).

**Expected:** one name, one phone number and one email, all from a single config; links dial the number they show.

### B18 · Low · False promises and fake data in the booking form

**Actual:** the sidebar says "Confirmation will be sent via email and SMS"; nothing sends either.
New patients are saved with `date_of_birth = 1990-01-01`, and the visitor's note goes into `medical_history`.

**Expected:** promise only what happens; never write invented medical data.

### B19 · Low · Patient data printed to the browser console

**Actual:** 65 `console.log`/`console.error` calls; `feedbackService.getAll` logs every feedback row
(names, emails, messages) to the console in production.

**Expected:** no personal data in production logs.

### B20 · Low · Public AI chatbot endpoint without a real rate limit

**Cause:** `supabase/config.toml` sets `verify_jwt = false` for `chat-with-gemini`. Its rate limit is a
`Map` in memory, so it resets whenever a new instance starts. Anyone can script requests and spend the
clinic's Gemini quota.

**Expected:** a shared rate limit (database or KV) and a per-day cap.

### B21 · Low · "Dr. Dr. Smith"

Found while fixing B06. Doctor names in the database already start with "Dr.", but the patient portal, the admin
Appointments and Patient lists, and the WhatsApp reminder text all add another "Dr." in front. The admin lists
and WhatsApp text also show raw times such as `09:00:00`.

**Expected:** "Dr. Smith", "9:00".

## Also noted (not counted as bugs)

- ESLint reports 82 problems (63 errors) on the original code.
- `caniuse-lite` / Browserslist data is 25 months old.
