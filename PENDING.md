# Forge OS — Pending Work Tracker

Living checklist. Updated at the end of every work session, before the final
push. `[x]` only when verified, not merely written.

**Last updated:** 26 Sep 2026 (session 13) — PATCH_47: real push for salary/new-hire approvals

**PATCH_47 (26 Sep 2026, session 13):** Closes the notification gap PATCH_46 left open. All four functions (`add_employee`, `request_salary_change`, `approve_salary_change_request`, `reject_salary_change_request`) now call a new `notify_via_push()` helper instead of inserting into `notifications` directly. That helper calls `send-push-notification` via `net.http_post` — same pattern every pg_cron job already uses, confirmed safe by checking `verify_jwt=false` directly rather than assuming it. **Tested for real**: added a test employee as Pallavi, confirmed `net._http_response` shows `{"success":true,"notified":1,"pushed":1}`, and Yash's registered Android device received the actual push — not just an in-app bell entry. Test employee removed immediately after.

**PATCH_46 (26 Sep 2026, session 13):** Owner-approved salary + new-hire onboarding

**PATCH_46 (26 Sep 2026, session 13):** Owner-approved salary changes + new-hire onboarding — corrects PATCH_45's `add_employee` per Yash's direction: HR must never be able to set salary or activate a login unilaterally.

- **`reset_employee_pin` narrowed** from `is_management()` to `hr_admin` only — "PIN reset for anyone can be done only by HR, we don't give this feature to anyone else," including manager/plant_head/owner.
- **New table `salary_change_requests`** — one shared approval queue for two cases: a brand-new hire's initial CTC breakup, or an existing employee's revision. Both follow the same shape: HR submits (hr_admin only) → owner approves/rejects (owner only) → only approval writes `employee_salary_structure`.
- **`add_employee` rewritten.** No longer activates a login or takes a single salary number. Now: creates the `employees` row `is_active=false` with no `auth_user_id` (nothing to log into yet), takes a full CTC breakup (`ctc_annual/basic/hra/conveyance` required, `washing/education/heat_allow/vda/production_allow/medical/professional_development/communication/uniform` optional) as a `jsonb` payload, and inserts a pending `is_new_hire=true` request. Notifies the owner (in-app `notifications` row — a real device push isn't wired for this specific event yet, would need one more edge-function call).
- **New `request_salary_change(employee_id, breakup)`** — hr_admin only, same shape for an existing employee's revision. Also usable to fill the still-open `employee_salary_structure` gap for the 38 employees flagged missing since PATCH_29.
- **New `approve_salary_change_request` / `reject_salary_change_request`** — owner only. Approving a new-hire request is the moment the auth login actually gets provisioned and `is_active` flips true (same synthetic-email/PIN-as-password provisioning PATCH_10 established); approving a revision writes `employee_salary_structure` (superseding the previous active row, not deleting it). Rejecting either just marks the request rejected and notifies HR back — no employee/salary state changes.
- **New screens**: `app/(hr-admin)/add-employee.tsx` (rewritten — full breakup form, "submitted for approval" messaging instead of an instant PIN), `app/(hr-admin)/salary-request.tsx` (new — search an existing employee by emp_code, submit a revision). Both linked from the HR-Admin dashboard.
- **`app/(owner)/approvals.tsx` extended** — now also lists pending `salary_change_requests` alongside the existing leave/advance escalations, tagged "New Hire" or "Salary Revision" with the CTC/Basic/HRA/Conveyance shown before approving.
- **Full flow tested** inside a transaction impersonating both Pallavi (hr_admin) and Yash (owner) via `set local request.jwt.claims`, committed, verified, then fully cleaned up (test employee + auth user + salary rows + notifications all deleted) before this was called done.
- Superseded PATCH_45's `add_employee` signature — old one dropped explicitly so it doesn't linger as a second overload.

**PATCH_45 (26 Sep 2026, session 13):** GPS radius, HR self-service RPCs, VFL5464 onboarded (see below, unchanged from this session's earlier commit).

**PATCH_45 (26 Sep 2026, session 13):** GPS geofence tightening + HR self-service.

- **GPS radius 100m → 15m** on all 12 real campus points in `plant_locations`
  (Yash's decision, after confirming the whole campus spans only 134.7m end
  to end — the old 100m radius reached a public street corner). `plant_config`'s
  legacy single-point fallback also updated to 15 for consistency. "Pune
  Office" (200m, an undocumented 13th point not part of the original
  12-location seed) deliberately left untouched — different kind of location,
  not what was reported.
  ⚠ **Watch for `worker.outsidePlant` complaints the first few days** — 15m is
  tight relative to normal phone GPS accuracy (±5–20m outdoors, worse indoors
  near steel structures), and Machine shop sits 68.6m from its nearest
  neighbouring point, so there's a real uncovered gap between them at this
  radius. If specific shops turn out too tight, loosen per-point rather than
  globally.
- **`reset_employee_pin(employee_id)` RPC** — same logic as `HR_reset_pin.sql`,
  now a button on `missing-data.tsx` ("Reset Forgotten PIN" — enter emp_code,
  get the reset PIN back in an alert). Replaces the manual SQL Editor step for
  the everyday "forgot PIN" case.
- **`add_employee(...)` RPC** — the single-employee version of PATCH_10's
  provisioning loop (insert `employees` row + synthetic-email/PIN-as-password
  `auth.users` row, atomically). New screen `app/(hr-admin)/add-employee.tsx`,
  linked from the HR-Admin dashboard. HR can now onboard someone without a
  Claude/SQL-Editor session.
  - Real bug found while testing: both new functions called `crypt()`/
    `gen_salt()` unqualified, which fails once wrapped in a function with a
    narrowed `search_path` — pgcrypto lives in the `extensions` schema on
    this project, not `public`. Fixed by schema-qualifying both calls.
  - Also found: this project's default privileges silently re-grant `anon`
    EXECUTE on any `CREATE OR REPLACE FUNCTION`, even after an explicit
    `revoke ... from public`. Both RPCs now `revoke ... from public, anon`
    explicitly and were re-verified authenticated-only afterward.
  - Tested inside a transaction impersonating a real hr_admin (Pallavi,
    VFL5440) via `set local request.jwt.claims`, then rolled back, before
    either was wired to a button.
- **VFL5464 (Nidhi Kumari, Quality, staff) added for real** via `add_employee()`
  — flagged missing since PATCH_29's `employee_salary_structure` seed. Gender
  `female` (already confirmed by Yash in PATCH_33's data-gathering, just never
  had a row to apply it to). Salary left NULL — not in the phone list Yash
  sent, not guessed. Starting PIN 005464, `must_change_pin=true`.
  **VFL5465 / VFL5466 deliberately NOT added** — PATCH_29 already found and
  excluded these two as placeholder/test rows (email "aaaaa"/"aaaaaa", IFSC
  "000000", PAN "asdfgh"); the phone list just sent carries the same
  placeholder emails for them, so treating that finding as still current
  rather than re-litigating it. Flag to Yash if these should be revisited.
- **Dashboard "Never signed in" list — no longer truncated.** `dashboard/index.html`'s
  data-quality section already computed this list (from `must_change_pin`)
  but capped it at 12 names; HR needs the complete list to work through daily.
  Now shows every never-logged-in employee, grouped by department, with a
  per-department count — this **is** the "daily list to HR" ask, no new cron
  or edge function needed since HR already opens this dashboard.
- **Still open, needs Yash:**
  - VFL4057 (Devendrakumar Singh, Maintenance) reported "not able to check
    in." Traced as far as data allows: his device lock was already reset
    today (device_registrations row from 05:26 UTC this morning) and his
    auth account works, but he has zero `attendance_records` rows ever — a
    rejected check-in (outside geofence, or fraud-detector's mock-location
    check) never writes a row, so the DB can't say which is still blocking
    him. Needs a screenshot of what his check-in screen actually says.
  - Whether "Pune Office"'s 200m radius was deliberate (not part of the
    documented 12-point seed).

**Payroll Engine (24 Sep 2026, session 12):** `scripts/VFPL_Payroll_Engine_24Sep2026.gs` — paste into the `VFL HR OS 2026 27` spreadsheet's Apps Script editor.
- Applies all FORMULA_AUDIT corrections: VDA = physical days × ₹103, heat allow = ₹5.78/day, no intermediate rounding for staff, efficiency slab 81–85%, ESIC exempt above ₹21,000, PF capped at ₹1,800.
- Writes PAYROLL_DRAFT; promotePayrollDraft() moves approved rows to PAYROLL_STAFF / PAYROLL_WORKER.
- **Before first run, fill these tabs in the spreadsheet:**
  - `PAYROLL_PERIOD` row 2: Month, Year, Working Days, Period Start, Period End
  - `STATUTORY_CONFIG`: PF_WAGE_CEILING=15000, PF_EMPLOYEE_RATE=0.12, PF_MAX_EMPLOYEE=1800, ESI_EMPLOYEE_RATE=0.0075, ESI_EXEMPT_ABOVE=21000, WORKER_VDA_RATE=103, WORKER_HEAT_RATE=5.78, PT_SLABS=\<JSON from HR once Maharashtra slabs confirmed\>
  - `INPUT_ATTENDANCE`, `INPUT_OT`, `INPUT_EFFICIENCY` — sourced per the INPUT sheet design in the spreadsheet
- PT returns ₹0 until Yash/HR confirm Maharashtra slabs and enters them as PT_SLABS JSON in STATUTORY_CONFIG.
- Staff incentive is ₹0 placeholder — deferred until ~3 months real app usage.
- Supabase export: NOT part of this engine. Run `syncOpsDashboardToSupabase()` separately after HR+Finance approve the draft.

**PATCH_43 (24 Sep 2026, session 12):** Real Google Form URLs for all 6 is_common forms. Applied.
**PATCH_44 (24 Sep 2026, session 12):** OT form for manager/plant_head/owner via MANAGEMENT virtual dept. Applied.

**PATCH_42 (24 Sep 2026, session 11):** Leave Application + Advance Application switched to Google Forms.
- In-app leave/advance screens removed from My Requests banner in FormsScreen — the approval chain (supervisor → manager → HR → accounts) isn't built yet.
- Both now appear as `is_common=true` rows in `form_links` alongside Gate Pass, Cash Expenses, Hospital Form.
- `scripts/PATCH_42_leave_advance_as_forms.sql` — 2 rows inserted (DB already applied).
- **Yash must update the 2 placeholder URLs with real Google Form links** (Leave Application, Advance Application). In-app leave/advance screens remain as hidden routes for when the approval flow is built later.

**PATCH_41 (24 Sep 2026, session 11):** Forms tab reorganization across all 7 roles.
- `components/FormsScreen.tsx` — completely rewritten with three conditional sections: "My Requests" (all roles: Leave + Advance + common Google Forms from DB), "HR Operations" (hr_admin only: Shift Planning), "Department Forms" (supervisor/manager/security: deadline strip + dept form_links).
- `components/LeaveScreen.tsx` + `components/AdvanceScreen.tsx` — new shared components; each role's leave.tsx/advance.tsx is now a one-line wrapper around these.
- Worker: Leave tab replaced with Forms tab. Leave + Advance are now hidden routes navigated from the My Requests banner.
- HR Admin: Shift Planning tab replaced with Forms tab. Shifts accessible as hidden route from Forms → HR Operations banner.
- Plant Head + Owner: Forms tab added (now 6 tabs each).
- Security: Vehicle Log removed from tab bar (hidden route); Forms tab kept.
- Supervisor + Manager: Forms tab already existed; leave + advance added as hidden routes.
- `scripts/PATCH_41_common_forms_banner.sql` — `is_common` column on `form_links`; 3 placeholder rows for Gate Pass, Cash Expenses, Hospital Form. **Yash must update the 3 placeholder URLs with real Google Form links.**
- DB change already applied via Supabase MCP.

**PATCH_40 (25 Oct 2026, session 10):** Permissions onboarding + update check already built.
- `lib/permissions.ts` — `requestAllPermissions()` requests location, camera, notifications in sequence upfront, so employees never see a surprise system dialog mid-flow.
- `app/(auth)/permissions-onboarding.tsx` — one-time screen shown after first PIN change (via `change-pin.tsx` redirect) and for returning users who haven't done it yet (gated in `app/index.tsx` via AsyncStorage key `app.permissionsRequested`). Dismissible with "Skip" — individual flows keep their own lazy permission requests as a safety net.
- `UpdateBanner` + `useAppVersion` were already fully built and wired in `_layout.tsx` — CI stamps `versionCode` with the run number, and the banner compares against the GitHub Releases API. No code change needed for update notifications.
- `scripts/FRESH_INSTALL_25Oct2026.sql` — run in Supabase SQL Editor on 25 Oct before distributing the APK. Clears `device_registrations`, resets `must_change_pin = true` for all 138 active employees, and resets all auth user passwords to starting PINs (VFL employees: `lpad(digits,6,'0')`; CON employees: `'20'||lpad(digits,4,'0')`).

**25 Oct 2026 fresh install procedure:**
1. Run `scripts/FRESH_INSTALL_25Oct2026.sql` in Supabase SQL Editor.
2. Share APK download link via WhatsApp: `https://github.com/erpvarsha-star/forge-os-trial/releases/latest/download/app-release.apk`
3. Every employee installs → logs in with starting PIN → forced PIN change → permissions screen → normal use.
4. Device locks are fresh — no one is blocked from registering their device.

**Consultant logins**: Added 9 confirmed-active consultants (CON01, CON05,
CON09, CON12, CON16, CON18, CON20, CON21 with departments; CON13 no
department on file). Applied **PATCH_35** directly via MCP — employees
inserted, Supabase auth users provisioned, `must_change_pin = true`.
PIN formula: `'20' || lpad(digits, 4, '0')` — CON01 = 200001. All use
`role='member'`, `category='consultant'` so they see the worker UI (GPS
check-in + QR). Deliberately excluded pending Yash confirmation: CON19
(Bunglow Maid — needs factory GPS?), CON22 (name matches VFL4004 Digambar
Todekar), CON23 (name matches VFL4030 Suresh Gawali). Total employees now
138 (129 original + 9 consultants). See "🟡 Consultant logins" below.

**Monthly attendance count**: Every non-worker role now sees a "Present
this month: N days" stat at the bottom of their `CheckInCard`. Uses the
`records` the hook already fetches — no extra query. Counts `status='P'`
rows for the current month. Shows for all 7 roles (workers via
`worker/attendance.tsx` calendar already had this; now non-workers have it
too via CheckInCard).

**Security forms tab**: Added `app/(security)/forms.tsx` (wraps the shared
`FormsScreen` component) and wired it into `(security)/_layout.tsx`.
Security guards now have 6 tabs: gate-qr, vehicle log, checkpoint2,
eod-lock, **forms**, more. The tab shows form links from `form_links` scoped
to the security guard's department. Currently no rows exist for security in
`form_links` — Yash needs to provide the 4 URLs (57 AT, 57 F4, Out
Material In, Dispatch) so HR can add them to the table.

**PATCH_37 (25 Sep 2026, session 7):** QR time-bucket security + exemptions.
- `requires_qr boolean NOT NULL DEFAULT true` added to `employees`; VFL1001
  (Yash, owner) and VFL1567 (Kajal Sutar, Pune office) set to `false`.
- QR formula changed from daily (`plant_id-date-salt`) to 30-minute buckets
  (`plant_id-date-bucket-salt`, bucket 0–47 in IST). A WhatsApp photo of the
  gate QR is worthless after the current 30-min window ends.
- `gate-qr.tsx`: shows remaining minutes in current bucket; refresh interval
  detects bucket rollover (not just date rollover).
- `qr.tsx`, `CheckInCard.tsx`: both scan paths use `buildQrValue()` from
  `lib/location.ts` — single formula, can't drift.
- `home.tsx`, `CheckInCard.tsx`: QR star card and QR quick-action hidden when
  `employee.requires_qr === false`.
- `nightly-scoring`: `requires_qr=false` employees score GPS alone as 100%
  (not capped at 50%); everyone else unchanged.
- SQL applied to Supabase (verified: 136 true, 2 false). Committed as one
  batch with `PATCH_36` (security forms) in this session's final push.

**PATCH_39 (24 Sep 2026, session 9):** Device lock + checkout GPS+QR.
- `device_registrations` table (device_id UNIQUE → employee_id). SECURITY DEFINER `register_device()` returns `{allowed, reason}`. Called on every `loadEmployee()` — registered once, stays locked until HR resets it.
- `clear_device_registration(employee_id)` SECURITY DEFINER — HR admin resets device so employee can log in on a new phone. HR Missing Data screen (`hr-admin/missing-data.tsx`) now lists all registered devices with a trash-icon reset button.
- `attendance_records.check_out_qr_verified BOOLEAN DEFAULT FALSE` — data collection until 15 Oct 2026.
- `handleCheckOut` in `home.tsx` and `CheckInCard.tsx`: now includes geofence check + mock-location block (same as check-in). After successful GPS checkout, shows inline exit QR scanner modal — same gate QR + same geofence validation, calls `confirmQrOut()`.
- Entry QR card (shown while checked in) and exit QR card (shown after checkout) are now separate — was one card covering both states incorrectly.
- `login.tsx`: `DEVICE_TAKEN` error shown with a clear HR-contact message (not the raw error string).
- SQL applied via Supabase MCP (verified).

**PATCH_38 (24 Sep 2026, session 8):** Shifts seed + late tracking + hours_worked + half-day.
- `shifts.late_grace_minutes INTEGER` + `attendance_records.hours_worked NUMERIC(5,2)` added to schema.
- Shift 1/2/3 confirmed times (7:00–15:30, 15:30–00:00, 00:00–07:00) with 15 min grace each.
- General (09:00–18:00, 30 min grace), Security Day (07:00–19:00), Security Night (19:00–07:00) inserted.
- General shift auto-assigned to all active staff+consultants (not supervisor/security_guard) Sep 24–Dec 31 2026, skipping Fridays.
- `useAttendance.ts`: IST date everywhere (fixes Shift 3 UTC-off-by-one), `checkIn()` now takes `lateMinutes` — writes `status='L'` vs `'P'`, `late_minutes` to DB. `checkOut()` computes `hours_worked` and applies half-day rule (`late_minutes ≥ 180 + checkout ≤ shift end → status='HL'`).
- `home.tsx`, `CheckInCard.tsx`: read grace from shift, compute `rawLateMinutes` using IST minutes (not device timezone), pass `effectiveLateMinutes` to `checkIn()`, pass `shift.end_time` to `checkOut()`.
- `CheckInCard.tsx`: shows `lateThisMonth` count (L+HL) alongside present days.
- `shifts.tsx`: full redesign as Sat–Thu weekly grid; workers+supervisors pick Shift 1/2/3 chips; security picks Day/Night; "Save Week" batch-upserts all 6 days.
- HR notification for very-late arrivals (no-hard-lockout rule) deferred — RLS blocks workers inserting notifications; needs an edge function. See 🔲 below.

**Previous session (24 Sep, session 5):** GPS→QR check-in fix; security
logout added; 6 non-worker roles got QR check-in via CheckInCard modal;
salary consolidation PATCH_28–PATCH_33 shipped. See below.

**Two sessions back (24 Sep, session 4):** GPS + QR dual check-in
(GPS=50%, GPS+QR=100% attendance score); security QR first tab; missed
check-in push notification. `scripts/ALERT.gs` updated to v4.

**Salary consolidation**: shipped **PATCH_28** through **PATCH_33** —
schema (`employee_salary_structure`, `pt_slabs`, `efficiency_incentive_slabs`,
extended `payroll_records`, `employees.gender`), seeded
`employee_salary_structure` for 91/129 employees, `payroll_monthly_rates`
(PATCH_31, for the real VDA formula found this session), corrected
Production Efficiency to NOT be department-scoped (PATCH_32), and
backfilled `employees.gender` for all 129 (PATCH_33, from Yash's direct
confirmation of the 3 female employees currently on staff). Ran a full
historical backtest across all 52 worker-sheet and 29 staff-sheet monthly
tabs (not just Aug 2026): found the real VDA formula (`per-day rate ×
Present Days`, 100% match on the 7 most recent months) after the original
assumption tested at only 25-55%, and confirmed OT was already correct
(89.8% match, one real exception traced to a stale value in the source
sheet). `run-payroll` (v4) redeployed with all corrections. Queued next:
the consolidated Google Sheet + Apps Script sync (Yash's request, not yet
started). See "🟡 Salary consolidation" below for the full story. Nothing
else app-visible changed — schema + reference data + the edge function
only, existing screens all still work unchanged besides the check-in fix.

**Previous session (24 Sep, session 4):** GPS + QR dual check-in (GPS=50%, GPS+QR=100% attendance score); security QR first tab; missed check-in push notification. `scripts/ALERT.gs` updated to v4 (23 Sep 2026): hourly trigger topology, Phase 2 recipient routing, health watchdog, Cutting 2-shift config, DME Telegram, `setupDynamicSupervisorTabs()` disabled to prevent accidental SUPERVISOR_MAP wipe; all 4 live secrets blanked before commit. `form_links` sync: DB already matches v4 DEPT_FORM_SEED exactly (31 rows) — no changes needed. Manager layout: team tab hidden, "View Team →" on dashboard — already done in prior session. APK build triggers on push. Remaining open: APPS_SCRIPT_URL, supervisor Telegram onboarding (5 missing: Subhash Palve, Shivaji Jaypure, Manoj Wagh, Sunil Saha, Abhimanyu Kakde), per-form tracking. Action for Yash: (1) paste updated `scripts/ALERT.gs` into live Apps Script editor, run `deployShiftTrackingTriggers()`; (2) HR Admin must assign supervisor_id for Cutting/Press/Machine/HT/Electricity/Oil/VMC supervisors.

---

## Working rule for this project (and all projects)

**Prefer connectors, plugins and scripts over asking the user to hand-carry
data.** Target split: Claude does ~85%, the user does authentication,
approval, and running a script. If a step needs a human, it should be a login,
a click-to-approve, or pasting one script into an editor — not copying file
contents, retyping values, or a five-step console walkthrough.

Before asking the user to do anything manual, check whether an available
connector can do it instead (`ListConnectors`). Currently connected and usable
here: **Google Drive, Gmail, Google Calendar, Zapier, Notion, GitHub, Figma,
Gamma, Wix, Mem**.

Corollary: **commit and push after every completed step.** Power and internet
drop frequently at this site; work must never be lost mid-task.

---

## 🟡 Consultant logins — applied 25 Sep 2026, needs Yash action

9 consultants added and live: CON01 Chhagan Dehade (Die Shop), CON05
Madhukar Gosavi (Design), CON09 Nagnath Kale (Die Shop), CON12 Sadashiv
Soddy (Quality), CON13 Sanjeev Supsande (no dept), CON16 Sarwan Prasad
(Forge Shop), CON18 Bapusaheb Gawate (Die Shop), CON20 Prabhuling Achaleri
(Die Shop), CON21 Balasaheb Yeole (Maintenance).

Login: CON ID (e.g. "CON01") or phone number once added.
Starting PIN: `'20' + lpad(digits, 4, '0')` — CON01 = **200001**,
CON21 = **200021**. Must change PIN on first login.

**Pending confirmation from Yash:**
- **CON19** Chhaya Shelke — Bunglow Maid (Administration). Does she need
  factory GPS check-in? If yes, add with `department='Administration'`;
  if no, skip.
- **CON22** Digambar Mahadeo Todekar — Die Shop. Name matches VFL4004
  Digambar Todekar from the 5-worker gap list (PATCH_29). Same person
  re-engaged as consultant? Cannot add without Yash confirming they are
  different individuals.
- **CON23** Suresh Sopan Gawali — Final Shop. Name matches VFL4030 Suresh
  Gawali from the same gap list. Same reason.

---

## ✅ Security forms tab — live 25 Sep 2026 (PATCH_36)

`app/(security)/forms.tsx` is built, wired into the security tab bar, and
populated. Applied via Supabase MCP. Two changes:

1. **Security guards' department corrected** from `Human Resource` → `Security`
   (the registry lists them under Security; the old value was making their
   Forms tab show Pallavi's HR manpower forms instead of gate forms).

2. **4 gate forms added to `form_links` under `Security`:**
   - Gate Pass (sort 10) — from forms registry
   - 57F4 Inward ("57 AT" in Yash's terminology, sort 20) — same URL as Final Shop
   - 57F4 Outward ("Out Material In", sort 30) — same URL as Final Shop
   - Late Attendance (sort 40) — from forms registry

`send_in_reminder = false` for all 4 — security guards don't get shift-based
form nudges (those are scoped to production departments).

---

## 🔴 GPS→QR check-in — found and fixed 24 Sep 2026

Reported: after GPS check-in, opening the QR screen sometimes said "check
in with GPS first" even though the worker just had, and separately looked
like it was blocking QR entirely once GPS was done.

Two real bugs found in `hooks/useAttendance.ts`:

1. **`checkIn()`'s `.upsert()` had no `onConflict` target.** Supabase then
   defaults to resolving conflicts on the primary key (`id`) — never in the
   payload, so never a conflict, so every call was a plain INSERT. A
   double-tap, or a retry after a slow/dropped response (this site's
   flaky network), threw a real Postgres unique-constraint violation
   (`unique(employee_id, date)`) on the second attempt instead of updating
   the existing row — silently, since `home.tsx`'s `handleCheckIn` never
   checked `checkIn()`'s returned error. **Fixed**: added
   `{ onConflict: 'employee_id,date' }`, and `handleCheckIn` now alerts on
   a real error instead of failing silently.
2. **`qr.tsx` had no loading gate.** Its own `useAttendance` instance
   starts with `todayRecord = null` until its fetch resolves, but the
   screen decided "GPS first required" vs. "show scanner" immediately, with
   no check for whether that fetch had finished — so every navigation here
   showed the wrong "GPS first" screen for a beat, and on this site's slow
   network that beat could last long enough to look like a real bug even
   though check-in had genuinely already happened. **Fixed**: added the
   same `isLoading` guard `home.tsx` already uses for its own screen.

Also brought `useAttendance`'s today-lookup from `.single()` to
`.maybeSingle()` — matches `home.tsx`'s `fetchShift` convention (its own
comment already documents exactly this anti-pattern) and avoids an error
being generated (and silently discarded) on the normal "no check-in yet"
case.

**Untested on a real device** — fixed from direct code reading against the
two reported symptoms, not reproduced live. Worth a real check-in→QR
round-trip once there's device access to confirm.

---

## 🔴 Security had no logout; 6 roles had GPS check-in but no QR — found and fixed 24 Sep 2026

Two reports, both real gaps:

1. **Security had no `more.tsx` at all** — `(security)/_layout.tsx` only
   had `gate-qr`, `dashboard`, `team`, `eod-lock`: no tab anywhere led to a
   logout button. Every other role group has a `more.tsx` with one; security
   was simply missing it. **Fixed**: added `app/(security)/more.tsx`
   (mirrors `(manager)/more.tsx`) and wired it into the tab bar.

2. **Manager (and 5 other roles) had GPS check-in but no way to do the QR
   half.** `components/CheckInCard.tsx` — used by manager, hr-admin,
   supervisor, plant-head, security, AND owner dashboards — implements GPS
   check-in/out but never had a QR follow-up, unlike
   `worker/home.tsx`/`worker/qr.tsx`. Worse than just a missing button:
   even if one existed pointing at `/(worker)/qr`, that route's
   `RoleGate allow={['member']}` would bounce every one of these 6 roles
   straight back out. Since GPS+QR together are what the attendance score
   treats as 100% (GPS alone is 50%), **every non-worker employee has been
   structurally capped at 50% attendance score** with no way to reach 100%.
   **Fixed**: added the same "scan QR for star" card `worker/home.tsx` has,
   directly into `CheckInCard`, opening the scanner in a `Modal` (not a
   route) so it works from any dashboard without new per-role routes or
   RoleGate changes. Scanning/validation logic mirrors `worker/qr.tsx`'s.

**Untested on a real device** — same as the GPS→QR fix above, fixed from
code reading against the two reports, not reproduced live yet.

---

## 🔴 Push notifications never actually worked for anyone — found and fixed 24 Sep 2026

Reported: no OS-level push/badge for anyone, notifications only ever seen
after opening the app; asked to verify push works and that check-in data
starts recording reliably from 1 Oct.

**Root cause 1 (FIXED, code): `push_tokens` was completely empty — 0 rows,
for every single employee including the owner.** `app/(auth)/login.tsx`
called `registerForPushNotificationsAsync(session.user.id)` — but
`push_tokens.user_id` is a foreign key to `employees(id)`, not
`auth.users`. `session.user.id` is the auth user's own id, a different
UUID. Every registration attempt violated that FK and was silently
discarded (`lib/notifications.ts` deliberately never throws, so a push
failure can't strand someone on the login screen after a real login
success) — so `push_tokens` has been empty since push was first wired up,
despite "FCM push confirmed 9 Sep 2026" elsewhere in this file (that
confirmed the edge function secret was set, not that any token had ever
actually reached the table). This fully explains the reported symptom —
there was never anything to send a real push to, for anyone, ever.
Fixed by moving registration into `useAuth`'s `loadEmployee` (which has
the correct `employee.id`, and fires on every app launch — including an
already-logged-in session resuming, not just a fresh login — so simply
*opening* the new build re-registers, no forced logout/login needed).

**Root cause 2 (NOT a code bug — a data/process gap): `employee_shifts` is
completely empty — 0 rows, ever, for anyone.** This is why the "Shift
starting soon" / "You haven't checked in yet" reminders
(`shift-reminder`'s `daily_checkin_reminder` mode) have never fired even
once — confirmed by `notifications` type counts: `form_due_reminder`
(2,391) and `shift_gap_alert` (174, weekly, to HR/plant_head — "nobody has
a shift assigned") both fire regularly and are current as of today, but
`checkin_reminder`/`missed_checkin_reminder`/`weekly_shift_assigned` have
**zero rows, ever**. The mechanism needs an `employee_shifts` row for that
employee that day to know when their shift starts; with none, there's
nothing to trigger off. **This needs a real HR action, not a guess from
me**: assign shifts via `(hr-admin)/shifts.tsx`. Check-in itself does NOT
require a shift assignment (`home.tsx`'s `handleCheckIn` treats "no shift"
as just "not late" and proceeds normally) — so tomorrow's check-in rollout
itself is not blocked by this, only the proactive reminder pushes are.

**Checked and ruled out**: every `cron.job` row calling these functions
(`shift-reminder`, `mrm-reminder`, etc.) has a literal, never-substituted
`Authorization: Bearer PASTE_YOUR_KEY_HERE` header — looks alarming, but
confirmed harmless: all of them have `verify_jwt: false`
(`list_edge_functions`), so the gateway never checks that header. Real
activity (form/mrm reminders firing today) confirms this. Worth tidying
eventually, not worth chasing under this deadline.

**Yash's own attendance IS recording correctly** — checked directly:
VFL1001 has 4 real `attendance_records` rows in September (4th, 10th,
14th, 23rd, all `status: 'P'` with a real `check_in_time`). The check-in
mechanism itself works; "no count of attendance" is very likely about
there being no personal attendance-count view anywhere in the `(owner)`
screens (the role has no equivalent of `worker/attendance.tsx`), not
missing data. Worth adding a small stat if wanted, not chased further
without confirming that's actually what's meant.

**"Welcome to Varsha" onboarding message does not exist anywhere in the
code** — nothing to fix, would need to be built new (e.g. triggered once
after first PIN change via `mark_pin_changed`). Not built yet — holding
off until confirmed it's wanted as a real feature vs. just an example
message for testing delivery.

### ✅ Confirmed working end-to-end, 24 Sep 2026, later same day

After the push-token fix shipped, two real employees opened the updated
app and registered successfully — Tushar Abasaheb Shirgire (VFL1389) and
Brahmanand Kaduba Tajne (VFL1482), both real Android FCM tokens,
`push_tokens` timestamps ~13:33 UTC. Sent a real test push to both via
`send-push-notification` (through `net.http_post`, same internal path
pg_cron uses) — response: `{"success":true,"notified":2,"pushed":2}`.
**Both actually received it.** FCM delivery is proven working end-to-end,
not just theoretically fixed.

**Yash's own device still has no token after logging out and back in.**
Given two other people's devices registered successfully the same day on
the same build, the mechanism itself is proven — his device specifically
hasn't picked up the new APK (most likely didn't redownload the release
after the fix landed) or has a device-specific issue (platform, denied
notification permission). Worth checking with him directly which build
number he's on rather than assuming further.

**Attendance count for the other 128** — confirmed important to Yash
(his own count isn't). `worker/attendance.tsx` reads `useAttendance`'s
monthly `records` and counts `status === 'P'` rows directly from
`attendance_records` — logically correct, and now benefits from the same
day's `checkIn()` upsert fix (repeat check-ins across different days no
longer silently fail). No further bug found here; flagging as confirmed
rather than newly fixed.

---

## 🔲 Salary calculation rules — target 15 Oct 2026

Requires ~15 days of real app usage data from the 1 Oct rollout. Once workers
are checking in/out consistently and late-minutes + hours_worked are
accumulating in `attendance_records`, review the data with Yash to confirm
practical late thresholds, half-day edge cases, and OT patterns before
encoding salary deduction rules.

Also covers: HR notification for very-late arrivals (deferred from PATCH_38 —
currently check-in always proceeds but HR has no in-app alert; needs an edge
function since RLS blocks client-side notification inserts for workers).

**Not to start before:** 15 Oct 2026.

---

## 🟡 Salary consolidation — in progress, started 24 Sep 2026

Replacing 6 Google Sheets (worker + staff calc engines, worker + staff
payslip generators, one shared leave sheet, one empty placeholder) with one
system inside Forge OS. Full findings + approved implementation blueprint:
`/root/.claude/plans/zazzy-sauteeing-crystal.md` (this plan file is local to
the session that wrote it — if it's not accessible in a future session, the
key facts are summarized below; ask Yash to re-share source docs if the
detailed formulas are needed again).

**Confirmed design decisions (don't re-litigate these):**
- Confirmed-days entry (Present/EL/CL/SL/PH/Working Days) stays 100% manual,
  checked by Dept Heads → Accounts → HR — never automated from
  `attendance_records`. The only change: HR's screen shows Forge OS's own
  attendance figure alongside the entry field for their existing cross-check.
- **Dual input path, not app-only**: both a consolidated Google Sheet (synced
  via a new Apps Script, same pattern as `syncOpsDashboardToSupabase()`) and
  in-app HR-Admin screens write into the same tables — this site's frequent
  power/internet drops mean payroll can't depend on the app alone.
- Leave allocation is a **fixed annual grant**, not accrued — simpler than
  first assumed. `leave_requests`/`leave_balances` already fit this shape.
- Staff production incentive maps to Forge OS's own `monthly_scores`
  (on-time + form submission) — but the payout tiers are **deliberately
  deferred ~3 months** until there's real app usage to calibrate against.
- A bank disbursement statement (printable, stamped, submitted to the bank)
  needs to be downloadable from the app — format still needs Yash to confirm
  (PDF letter vs. a specific bulk-upload CSV/Excel the bank wants).
- **Parallel run required before the old sheets are retired** — old sheets
  and the new engine run side by side for an agreed number of real payroll
  cycles (2 months suggested, not fixed), every component compared, not just
  net pay. Non-negotiable given real statutory numbers are involved.

### ✅ Phase 1 — schema — DONE 24 Sep 2026

`PATCH_28_payroll_schema_24Sep2026.sql` — applied via Supabase MCP, verified
clean (no new security-advisor findings). Schema-only: no app screens changed,
`payslip.tsx` and existing payroll reads work exactly as before.

- `employees.gender` added (needed for PT — the real slabs are
  gender-differentiated). Existing rows are NULL; needs backfilling before
  PT can compute correctly for anyone.
- `employee_salary_structure` — new table for CTC + every fixed component +
  bank/UAN/PAN/ESI details. **Created empty** — seeding from the master
  spreadsheet is Phase 2, gated on Yash confirming that source data is
  current (see below).
- `pt_slabs` — **seeded with real data** Yash shared 24 Sep (Maharashtra
  slabs, male/female, February ₹300 true-up noted in `remarks`).
- `efficiency_incentive_slabs` — seeded with Forge Shop's real Union
  Agreement slabs (01/09/25–31/08/26 period) from the PDF Yash shared.
  **Forge Shop only** — whether other worker departments have their own
  agreements is still unconfirmed.
- `payroll_records` extended: `working_days, present_days, el, cl, sl, ph,
  days_payable, ot_hours, canteen, society, mlwf, arrears,
  dispatch_incentive, other_allowance, production_efficiency_deduction,
  status, updated_at` (+ trigger to auto-set `updated_at`, reusing the
  existing `set_updated_at()` function).
- `leave_requests.type` CHECK extended to add `COFF`/`OD` (Compensatory Off,
  Outdoor Duty — confirmed live categories tracked via the same application
  form, just via a type value the schema didn't have room for).

### ✅ Phase 2 — employee_salary_structure seed — DONE 24 Sep 2026

`PATCH_29_employee_salary_structure_seed_24Sep2026.sql` — applied via
Supabase MCP, verified (91 rows, `select count(*) from
employee_salary_structure` = 91).

**Source corrected mid-flight**: not the "VFL Waluj Employee Master Data"
spreadsheet's Staff/Permanent Worker tabs used in the first pass — those
disagreed with a separate "Sheet17" tab in the same workbook for 71 of 75
overlapping employees (always Sheet17 higher, no way to tell which was
current). Switched to the calc engines' own `Master Data` tabs instead
(the ones that actually drive live payroll, confirmed via formula trace) —
Yash re-downloaded the staff one fresh 24 Sep to make sure it was current.

**91 of 129 employees seeded** (19 workers + 72 staff, `Status='Active'` in
the calc sheet). Corrections applied: VFL5463 ("Manoj Anantrao Wagh")
remapped to VFL5337 (already documented in CLAUDE.md as the same person);
VFL5465/VFL5466 excluded (obvious placeholder test rows — email "aaaaa",
IFSC "000000", PAN "asdfgh"); VFL5400's account number nulled (source value
was a float-precision-loss artifact, not a real account number — needs
HR to re-enter before this person's payroll can actually be disbursed).

**Still open — 24 people, real follow-up, not a code gap:**
- **VFL5464 "Nidhi Kumari"** — real-looking data (real email, Kotak Mahindra
  bank details, joined 26 Jul 2026, QMS dept) in the calc sheet but **no
  employees row in Forge OS at all**. Looks like a genuine hire never
  onboarded into the app — needs a real emp_code decision from Yash, not a
  guess, same as every other "confirm before adding" case in this file.
- **23 employees active in Forge OS but missing from the calc sheet**: 5
  workers whose calc-sheet status disagrees with Forge OS — Kailash Dhiwar
  (VFL4002), Digambar Todekar (VFL4004), Hanumant Shigarkanti (VFL4007),
  Suresh Gawali (VFL4030), Babasaheb Randive (VFL4048) — worth checking
  whether these five have actually left. Plus 18 staff missing entirely:
  Dipak Patil (VFL1319), Jitendrasingh Nainsingh (VFL1441), Mahipal Singh
  (VFL1465), Swapnil Kakade (VFL1550), Farhan Shah (VFL1568), Angad Kate
  (VFL5074), Nivrutti Jadhav (VFL5083), Santosh Dabhade (VFL5203), Shaikh
  Abdul Gani (VFL5323), Rahul Patil (VFL5354), Vikas Pere (VFL5383), Raju
  Kasare (VFL5410), Payal Surve (VFL5415), Rohit Mokase (VFL5420), Dipak
  Kharat (VFL5425), Saurabh Ghorpade (VFL5428), Pooja Pawar (VFL5429),
  Shreyash Mhaske (VFL5445). Their payroll stays blank until Yash provides
  the data — same "acceptable until HR provides it" precedent PATCH_26
  already set for staff missing from its source sheet.

### ✅ Advance balances seeded — PATCH_34, 24 Sep 2026

Yash gave a real list: name, current balance, monthly deduction until
cleared, for 8 employees. `advance_requests` had no column for a fixed
monthly rupee figure (only `repayment_months`, an integer month count) —
added `monthly_deduction` rather than force-converting into a month count
that was never actually given.

**7 of 8 matched and inserted** (`status: 'approved'`,
`outstanding_balance` = the given balance): Tushar Abasaheb Shirgire
(VFL1389, ₹95,000/₹5,000mo), Brahmanand Kaduba Tajne (VFL1482,
₹18,000/₹3,000mo), Jitendrasingh Nainsingh (VFL1441, ₹253,000/₹5,000mo),
Bhupendra Kashinath Bharude (VFL1528, ₹12,000/₹5,000mo), Kajal Balkrishna
Sutar (VFL1567, ₹168,000/₹8,000mo), Shrawan Rewant Singh (VFL1520,
₹142,000/₹4,000mo), Sudeep Singh (VFL5079, ₹169,000/₹5,000mo).

One deliberate disambiguation caught before it became a real mistake:
"Shrawan Rewant Singh" is VFL1520 by exact full-name match — **not**
VFL1527 "Sharwan Singh Jodha", a different person CLAUDE.md already flags
as historically confused with VFL1520 ("phone... duplicate of VFL1520").

**8th name, Ganesh Laxmanrao Kausadkar — NOT in Forge OS.** No match on
"Ganesh" anywhere in `employees`, at all. Same class of gap as Nidhi
Kumari (PATCH_29/33) — a real person in Yash's own records with no
`employees` row. Not fabricated. Needs a real emp_code from Yash before
this one can be added.

Not yet wired into `run-payroll` — the engine's `advance_recovery` is
still an HR-typed monthly input per the confirmed-days screen, not yet
auto-populated from this table. Worth doing once Phase 4's entry screens
are built (default the field to `monthly_deduction`, editable), not done
silently now.

### ⏳ Still needed before Phase 3 (calculation engine) can go live

1. **Bonus scope** — rates confirmed (Staff 8.33%, Worker 18%, both of
   Basic), but Bonus is an annual statutory payout, different cadence from
   monthly payroll. Needs a decision: part of this build, or a separate
   module.
2. **Does every worker department have its own efficiency agreement like
   Forge Shop's?** Only Forge Shop's slabs are seeded.
3. **Bank statement format** — confirmed: printable A4 PDF, print + stamp,
   no special bank bulk-upload format needed.
4. The 24 people above (VFL5464 + the 23-person gap) — engine can go live
   for the 91 who have data without waiting on these.

### ✅ Phase 3 — run-payroll calculation engine — DEPLOYED 24 Sep 2026, VDA/OT now backtest-confirmed

`supabase/functions/run-payroll` — deployed (v3). Computes one employee's
month from `employee_salary_structure` + confirmed-days/one-off inputs,
upserts into `payroll_records`. Two callers by design (in-app screens,
future sheet sync) — same function, same output either way.

**Full historical backtest run 24 Sep 2026** — every standard monthly tab
in both the worker sheet (52 months, back to Apr 2022) and staff sheet (29
months, back to Jan 2024) checked, not just Aug 2026:

| Component | Status |
|---|---|
| Basic, Conveyance, Washing, Education, HRA pro-ration | ✅ Match exactly |
| PF | ✅ Matches exactly (₹1,800 = ₹1,800) |
| **VDA** | ✅ **Fixed** — the original assumption (pro-rates like Basic) was wrong, only 25-55% match across 1,718 employee-months. Real formula found: `per-day VDA rate × Present Days` (Present Days ONLY, excludes EL/CL/SL/PH, unlike every other component). **100% exact match, 172/172 employee-months, across the 7 most recent tabs (Feb–Aug 2026).** The per-day rate is a company-wide monthly value, now its own table: `payroll_monthly_rates` (PATCH_31) — not in `employee_salary_structure`, entered once per month. **Currently empty — VDA computes to ₹0 with a warning until HR enters the first month's rate.** |
| **OT Amount** | ✅ **Confirmed correct as originally coded** — 89.8% exact match across 1,123 worker employee-months, 47 of 52 months exact. Uses `employee_salary_structure.vda` (the stored "VDA (F)" snapshot) in the hourly-rate calc, deliberately NOT the new monthly VDA rate — tested swapping it and it broke 3 previously-exact months to fix nothing. The one live-relevant miss, Aug 2026, traced to the *source sheet's* VDA(F) snapshot being one revision stale that month — a data-freshness issue in the old sheet, not this formula; keeping `employee_salary_structure` current avoids repeating it. Staff OT: ~99%+ match across 1,510 employee-months. |
| ESIC | Not backtested against a real row yet — but the *rule itself* (0.75% of gross, exempt above ₹21,000) is confirmed correct by Yash, replacing the sheet's buggy copy-paste-from-PF formula. |
| **PT** | Rule confirmed (Maharashtra slabs, gender-differentiated). **`employees.gender` now backfilled for all 129** (PATCH_33) — can compute for everyone. Still not backtested against a real payslip row. |
| **Production Efficiency** | ✅ **Fixed** — was wrongly modelled as department-scoped. Now correctly one shared figure for all 19 workers (PATCH_32). Not yet backtested — `worker_efficiency_actuals` is still empty, needs HR's first monthly entry. |

**PATCH_31** (applied 24 Sep 2026): new `payroll_monthly_rates` table
(`month`, `year`, `vda_per_day_rate`, unique per month/year) — the missing
piece VDA needed. **Confirmed by Yash: the rate is one fixed number for
every worker, company-wide** (not per-grade/department), revised roughly
every 6 months, same change for everyone when it happens. No schema change
needed beyond PATCH_31 — HR just re-enters the same value each month within
a 6-month block, same as they'll already be doing for confirmed-days/OT
hours. **HR needs a place to update this** — scoped into the Phase 4
HR-Admin build below, not built yet.

**PATCH_32** (applied 24 Sep 2026) — **Production Efficiency is NOT
department-scoped, confirmed by Yash.** It's one achieved % per month,
same for all 19 workers, entered once a month before the salary run (not
daily). Corrects the department-keyed design from PATCH_28/30 — the Aug
2026 "Efficiency Calculations" sheet listing several departments under one
shared 80% figure was the tell; "Data is Collected from Forge Shop" meant
Forge Shop's supervisor *collects* the number for the whole worker roster,
not that it's Forge-Shop-specific. Dropped `department` from
`efficiency_incentive_slabs`; replaced `department_efficiency_actuals`
with `worker_efficiency_actuals` (month, year, achieved_pct — no
department column). `run-payroll` (v4) updated and redeployed to match.

**PATCH_33** (applied 24 Sep 2026) — **`employees.gender` backfilled for
all 129 employees.** Yash confirmed the complete company-wide female list
directly: Mayuri Sardar Rathod (VFL5446), Pallavi Vishnu Khade (VFL5440),
Kajal Balkrishna Sutar (VFL1567) — 3 found and set to `female`. The 4th
name given, Nidhi Kumari, has no `employees` row yet (matches the known
open item: real-looking hire in the calc sheet, never onboarded into Forge
OS — needs a real emp_code before she can be added). Everyone else (126)
set to `male`. PT can now compute for every employee.

**PATCH_30** (small schema fix, applied same session): added
`payroll_records.other_deduction` (missed in PATCH_28).

**Not yet tested from Forge OS itself** — the sandbox's outbound network
proxy blocks direct calls to the Supabase functions endpoint (same
restriction noted elsewhere in this file for other integrations), so every
backtest so far was done by replicating the engine's exact logic in a local
Python script against real seeded data, not by literally invoking the
deployed function over HTTP. Worth a real end-to-end call once there's app
access to verify the deployed version behaves identically — should, since
the logic is line-for-line the same, but not independently confirmed.

### Not yet built (Phase 4+)

HR-Admin entry screens (confirmed-days first, plus small fields for the
monthly VDA rate and worker efficiency %), the consolidated sheet + Apps
Script sync (see below — in progress), `payslip.tsx` additive updates, bank
statement export, then the parallel-run verification gate. Every formula
is now backtest-confirmed or confirmed-by-design; the only things standing
between here and a real payroll run are HR's first-month data entry
(`payroll_monthly_rates`, `worker_efficiency_actuals`, confirmed-days) and
the entry screens themselves.

### 🔲 Consolidated Google Sheet + Apps Script sync — requested 24 Sep 2026, not started

Per the approved blueprint's dual-input-path decision: a single Google
Sheet, synced via a new Apps Script (same pattern as
`syncOpsDashboardToSupabase()`), pulling from all 5 old payroll sheets +
the new Forge OS forms, using the **exact same formulas and writing to the
same data bank** (`payroll_records`, via `run-payroll`) as the in-app path
— neither is the "real" one. Scope: **April 2026 to present, at minimum.**
Plan: build the workbook (openpyxl, using the same cached source data this
session's backtest already pulled from) with real formulas per month tab,
upload to Drive, then write the Apps Script sync script. Not yet started —
queued as the next build task.

---

## ✅ Database is fully migrated as of 12 Aug

PATCH_13 (photo storage), PATCH_14 (form registry + the notifications columns)
and PATCH_15 (ops sync landing tables) are all applied and confirmed by Yash.
Nothing in `scripts/*.sql` is outstanding.

**What that unblocks, and what it does not.** The tables now exist, so the app
will not error — but `form_submissions` and `production_records` stay empty,
and therefore the Forms tab's shift chips and the production panels stay blank,
until the Apps Script sync actually runs. That needs the two Script Properties
below. Empty tables and a broken sync look identical from the app.

---

## ✅ Completed setup items (Sep 2026)

- [x] **Netlify dashboard deploy + production panel — committed 10 Sep 2026.**
      Added `netlify.toml` (static deploy config) and a Production & collections
      card to `dashboard/index.html` that fetches the Apps Script aggregator
      after sign-in.
      **Still open:** Provide the Apps Script web app exec URL (Deploy → Manage
      deployments → copy the `https://script.google.com/macros/s/.../exec` URL).
      Claude will set `APPS_SCRIPT_URL` on the Netlify site via MCP and trigger
      a redeploy immediately — no manual steps needed once the URL is shared.

- [x] **Multi-point geofence — APPLIED.** `COMBINED_DEPLOY_21to22` + `PATCH_23`
      (Pune office 200m) applied. 13 campus points total.

- [x] **Firebase / FCM — DONE 9 Sep 2026.** `FCM_SERVICE_ACCOUNT_JSON` pasted
      into Supabase Edge Functions Secrets. Direct FCM v1 path via
      `supabase/functions/_shared/fcm.ts`.

- [x] **Expo token revoked** (`9HDy_…`) — ✅ Revoked and fresh token added 9 Sep.

- [x] **Expo account password rotated** — ✅ Rotated 9 Sep.

## ✅ Unblocked — confirmed done (Sep 2026)

- [x] Multi-point geofence: COMBINED_DEPLOY_21to22 + PATCH_23 (Pune 200m) applied
- [x] FCM_SERVICE_ACCOUNT_JSON pasted into Supabase Edge Function Secrets
- [x] five-s-challenge-generator deployed with gemini-2.0-flash + responseMimeType
- [x] Device testing: GPS check-in, 5S photo upload, push notification confirmed
- [x] PR #2 merged: shifts seeded (S1/S2/S3), HR Admin create-shift flow live
- [x] PR #6 merged: DME (Amit) Telegram routing, VMC Shop added to ALERT.gs
- [x] Supervisors onboarding to @Form_mgr_bot (in progress — Amit confirmed, others ongoing)

---

## 🔎 Google Forms / Factory OS — investigated 12 Aug via Drive connector

Found the real setup rather than asking. Live files:

| File | ID | Note |
|---|---|---|
| **VFPL Factory OS — Supervisor Data Entry (Dynamic)** (Form) | `1Op5qSke8gYYVKeTXA6YhsuqRfEWM-y8Oc9lLlWwcsJI` | created 4 Aug, modified 10 Aug — the daily-entry form |
| **VFPL Operations Dashboard 2026-27** (Sheet) | `1GHdhrRtOhQFshsAOCK4n3GiJp-6a03k8bn0V_M04wSY` | **modified 12 Aug 04:50 — actively in use** |
| Per-shop forms | various | Cutting / Press / Forge / HT / Final / Machine, "Planning" + shift variants |

### What the dashboard actually contains

- **Supervisor weekly registration**: Timestamp, Email, Department, Supervisor Name,
  Phone, **Telegram Chat ID**, Week Start (Sat) / Week End (Thu)
- **Cutting production**: `Date | Machine | Shift | VF_No | Qty` — real rows since 1 Apr
- **HT production**: `Date | Furnace | Shift | Qty` — First/Second/Third Shift
- **Final production**: `Date | Process | Shift | VF_No | Qty` — e.g. Shot Blasting
- **Energy**: ~25 meters mapped to shops, kWh MTD and % of total per department
- **Consumables**: Zycril mixing, avg daily Forge/HT litres
- **Shift master**: S1 08:30-15:30, S2 15:30-23:30, S3 23:30-08:30, 60 min break.
  **Grace is 60 minutes, not 15** — corrected 12 Aug from the live `ALERT.gs`.
  The `15` in that config is `reminder` (minutes *before* the deadline). Real
  deadlines: **S1 16:30, S2 00:30, S3 09:30**.
- **Ten departments, not six**: Cutting, Forge, Press, Machine, HT, Final,
  Electricity, Oil, Staff Manpower, Contract Manpower.

### Two things this changes

1. **Production data DOES exist** — contradicting the basis on which I removed the
   production component from `nightly-scoring`. Important nuance: it is per
   **machine/furnace/process per shift**, NOT per employee. So removing it from the
   *individual* score was still correct, but it can absolutely drive
   **department-level production on the owner/manager dashboards**. Currently the app
   shows nothing from it.
2. **Supervisors already have Telegram Chat IDs on file.** That is a notification
   channel needing no Firebase, no FCM, and no Play Store — a working alternative
   to the Expo Push route that is currently blocked.

### Column mislabelled, but the data is deliberate — corrected 12 Aug
The Cutting table's `Shift` column holds a **person's name** ("B.S. Todmal") where
HT/Final hold "First/Second/Third/General Shift". Yash confirmed this is not bad
data: it records **who is responsible for filling that form**. Todmal covers
**Cutting AND HT**; **Ashok Sharma also covers Cutting**. So responsibility is
many-to-many — one person can own several departments, and one department can have
several responsible people. Any importer must read this column as a submitter, not
a shift, and the model must not assume one-owner-per-department.

---

## 🟡 Needs a decision from Yash

- [x] **Forms → app data flow — DECIDED 12 Aug, option (a).**
      Options, in order of my preference:
      **(a) Sheet → Supabase sync** — an Apps Script on the Operations Dashboard
      pushing new production rows into Supabase, modelled on the existing
      `scripts/MigrateToSupabase.gs`. You paste one script, authorise once, done.
      **(b) Zapier** — Google Forms trigger → Supabase row. No script, but a Zap
      per form and an ongoing Zapier dependency.
      **(c) Read-only Drive pull** — I read the Sheet on demand. No automation,
      no live dashboard.
      Needs new tables for machine/furnace/process production (none of the three
      shapes fits `data_collection_submissions`).

- [x] **Notification channel — DECIDED 12 Aug.** In-app notification with a
      **pending-forms count** is the primary channel; **Telegram is the final
      reminder / escalation** after in-app has been ignored. Both, not either.
      In-app count needs no Firebase. Telegram needs a bot token (see below).

- [x] **`scripts/MigrateToSupabase.gs` — AUDITED AND FIXED 12 Aug. It had never
      worked.** Written against the old spec schema, so every field it pushed
      was wrong: `department_id` (employees.department is TEXT, no FK),
      `salary_structure` (does not exist — FINAL_SCHEMA has a single `salary`),
      plus `designation`, `date_of_joining`, bank/PF/UAN/ESIC/PAN columns that
      do not exist either. The first employee push would have been rejected
      outright; nobody noticed because it was committed and never installed.
      Now rewritten to FINAL_SCHEMA. Its production sync was **removed** rather
      than fixed — it posted to `hourly_production`, another table that does not
      exist, and production is now handled properly by ALERT.gs → PATCH_15.
      Still optional: the database is the source of truth for all 129 employees,
      so only install this if the Employee Master Sheet becomes the master again.

- [ ] **OTA silent updates (EAS Update)** — deferred by agreement. Needs
      `EXPO_TOKEN` above. Changes how the APK is built; recommend after the trial.

---

## 🔴 ALERT.gs — audited 12 Aug, three defects found and fixed in repo

The Apps Script running on the Operations Dashboard is now checked in at
`scripts/ALERT.gs` (baseline commit `1e5283e`, fixes `eb70e8f`).

**⚠ ACTION FOR YASH — paste the fixed `scripts/ALERT.gs` over ALERT.gs in the
Apps Script editor, then run `testComplianceScoring()`, then
`setupDynamicSupervisorTabs()`, then `deployShiftTrackingTriggers()`.**
That is one paste and three menu clicks; nothing needs retyping.

| # | Defect | Status |
|---|---|---|
| 1 | Reminder ended with the literal text `[Google Form Link]` — supervisors told to upload with no link | ✅ fixed; links now come from a new `FORM_LINKS` tab |
| 2 | `hasDataForShift_` could never return true → **every alert since 5 Aug has been a false positive** | ✅ fixed |
| 3 | `DATA_SUBMISSION_LOG` / `WEEKLY_PERFORMANCE` had headers but nothing ever wrote to them | ✅ fixed |

**Defect 2 in detail.** The function parsed the RAW tabs' first column as a
timestamp and required `getHours() >= 8/15/23`. Those columns hold a date only
(`4/1/2026`), so `getHours()` is always 0 and the test never passed.
`ESCALATION_LOG` confirms it: 29 of 37 sweeps between 5 and 12 Aug escalated
**all ten departments at once**, the rest being one sweep split over a minute
boundary. Supervisors have been receiving alerts that are wrong every single
time — which is the likeliest reason they are ignored.

**Scoring — REMOVED 12 Aug, later the same day.** Yash: the dashboard timings
are for notifications in the app, not for scoring. `scoreForDelay_()`, the
`Points` column, `Score %` and the performance band are gone from ALERT.gs.
What remains is the factual record — on time / late / missing, and the delay in
minutes — which is what tells the app what is outstanding. Restore from commit
`eb70e8f` if that decision ever reverses.

### Still open on the Sheets side

- [x] **Form links — SOLVED 12 Aug** from Yash's form registry sheet
      (`1M2E83q64BXzfGwZsNQ_9u2jdfzwJPrJlD8WKRKgG554`), which lists every form
      by department, responsible person and frequency with the **published
      `/forms/d/e/.../viewform` responder links**. Replaces the guessed `/edit`
      URLs entirely. 24 daily forms seeded across the six shop departments.
- [ ] **Which daily form feeds the production dashboard?** Each shop has 3–6
      daily forms (`<Shop> PMS`, `<Shop> Daily check sheet`, `<Shop> Planning`,
      plus dispatch/57F4 on Machine and Final). The reminder currently lists
      all of them. Two mute switches now exist, both data not code:
      `Send in reminder?` = `NO` in the sheet's `FORM_LINKS` tab (Telegram
      side), and `send_in_reminder = false` in the `form_links` table (app
      side). Say which forms should not be chased per shift and I will set
      both, or set them yourself — nothing needs a redeploy.
- [x] **RESOLVED 13 Aug — verified against the live registry, not guessed.**
      Electricity + Oil are Maintenance-department forms (4 real Daily forms:
      check sheet + 2 electricity forms + oil). Both manpower forms are listed
      under Security AND HR Dept in the registry (same 2 forms, different
      responsible people) — marked "As & When Required" by the registry
      itself, not Daily. `PATCH_19_dept_expansion_13Aug2026.sql` seeds all of
      it into `form_links`; ALERT.gs's `DEPT_RESPONSIBILITY_FALLBACK` routes
      compliance-supervisor lookups for the 4 pseudo-departments to
      Maintenance / Security / HR. Also added: VMC Shop's real "VMC Daily
      check sheet" form — this is the VMC per-shift output tracking asked
      for. ⚠ VMC has no RAW tab on the dashboard yet (checked — genuinely
      absent), so it gets the form + reminder but not on-time/late/missing
      compliance tracking until one exists.
- [x] **RESOLVED 13 Aug.** Yash: the work week is Saturday-to-Thursday,
      Friday off, "unless we have urgent production Friday is working — 90% of
      the time Friday is off." Matches the live form exactly. Fixed on both
      ends: `weekStartFor_()` in ALERT.gs now computes Saturday (was Monday),
      and `shift-reminder`'s weekly notify window is now Saturday-Thursday
      (was Monday-Sunday — this one is real app code, not just the dashboard
      script, and was simply wrong before). The prefix-match column fix from
      12 Aug already made `processFormSubmissions()` work with the Saturday
      header regardless. No schema change needed for the Friday exception
      itself — `employee_shifts` is already per-date, so a working Friday is
      just a Friday HR assigns shifts for.
- [x] **Phone numbers — CLOSED 12 Aug.** Yash: "you dont need phone numbers."
      Not asked for again.

- [ ] **Supervisors onboard to @Form_mgr_bot** — Telegram working (10 Sep).
      Draft sent to DME/HR to circulate. Each supervisor messages @Form_mgr_bot
      with their exact name; bot auto-fills their Chat ID in SUPERVISOR_MAP. *Correction to what this
      line said before: there is no group-chat fallback.* When a supervisor
      has no chat ID, `sendGentleReminder` now tells the OWNER directly
      instead ("no Telegram registered for X"), not a group. Lower stakes
      regardless, now that the in-app Forms tab is a second route needing no
      chat ID at all.
      **✅ Amit Bhagvan Shirsath (VFL5434, DME) — registered 10 Sep 2026.**
      `DME_TELEGRAM_CHAT_ID` Script Property set automatically via
      `processTelegramOnboarding()`. Receives all 4 plant-wide Telegram
      reports (deadline, follow-up, daily summary, weekly performance).
      Remaining: all per-department supervisors listed in SUPERVISOR_MAP.

### Still open on the app side

- [x] **Forms tab — BUILT 12 Aug.** Yash: "we give one tab on their page for
      forms .... where we give them the list of forms." `components/FormsScreen.tsx`,
      mounted as a tab on the supervisor and manager layouts. Lists that
      employee's department forms from the `form_links` table (PATCH_14), tap
      to open the responder link, with the next shift deadline at the top.
      Reaches the phone without Firebase — it is a screen, not a push.
- [x] **Shift-timing notifications — BUILT 12 Aug.** Yash: the dashboard
      timings are for app notifications, not scoring. `shift-reminder` gained a
      `forms_due_reminder` mode firing 15 min before each deadline
      (16:30 / 00:30 / 09:30), deduped so one nudge goes out per shift.
- [x] **Cron entry for `forms_due_reminder`** — ✅ PATCH_18 applied 13 Aug, pg_cron job active. Fires every 15 min.
- [x] **Pending-forms status on the tab — BUILT 12 Aug.** Forms → Supabase went
      with option (a), the Apps Script push, as recommended. `syncOpsDashboardToSupabase()`
      in ALERT.gs pushes DATA_SUBMISSION_LOG into `form_submissions` every 15
      minutes, and the tab shows a submitted/pending chip per shift.
      ⚠ **Per shift, not per form** — the RAW tabs record that a department
      submitted for a shift, never which of its 3-6 daily forms it was.

- [ ] **Per-form ticking — `resolveFormSheets.gs` run 10 Sep, 22 of 28 forms
      returned NO MATCH.** The script does an exact-title search (`title = "…"`
      in Drive). A NO MATCH means the form's real title in Drive differs from
      what `FORM_NAMES_TO_RESOLVE` has — even one extra character, year suffix,
      or case difference fails it. Only 6 forms matched.
      **Next step:** run `listAllFormsInDrive()` in the Apps Script editor (any
      project with Drive access) to see every Google Form's real name, then
      update `FORM_NAMES_TO_RESOLVE` in `scripts/resolveFormSheets.gs` with the
      exact titles, and re-run `resolveFormSheets()`.
      ```javascript
      function listAllFormsInDrive() {
        var it = DriveApp.searchFiles(
          'mimeType = "application/vnd.google-apps.form" and trashed = false');
        var rows = [];
        while (it.hasNext()) { var f = it.next(); rows.push(f.getName()); }
        rows.sort();
        Logger.log(rows.length + ' forms found:\n' + rows.join('\n'));
      }
      ```
      Paste that into Apps Script → Run → check the Execution Log. The names
      there are the exact strings to put in `FORM_NAMES_TO_RESOLVE`.
- [x] **Department production on the dashboards — BUILT 12 Aug.**
      `production_records` (PATCH_15) + `components/ProductionSummary.tsx`,
      mounted on manager → Reports (scoped to their shop, grouped by machine)
      and owner → KPI (all shops). Renders nothing until the sync has run, so
      it is safe to ship before Yash sets the Script Properties.
- [x] **Script Properties for the sync — DONE 9 Sep 2026.** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set; `testSupabaseSync()` confirmed: 145 form_submissions + 8160 production_records pushed. Forms tab and production dashboard now have real data.
- [x] **Telegram onboarding — BUILT 13 Aug.** `processTelegramOnboarding()`
      in ALERT.gs polls the bot every 5 minutes; a supervisor messages their
      name, it's matched against this week's SUPERVISOR_MAP and the chat ID is
      written in automatically — no more typing a Telegram numeric ID into the
      registration form by hand. Matching is deliberately conservative: exactly
      one name match required, or it's logged and skipped, never guessed.
      Owner uses the SAME flow — message the bot with "Yash Munot" (or
      "owner") and it sets `OWNER_TELEGRAM_CHAT_ID` instead of a sheet row.
      **New bot created 13 Aug** — @Form_mgr_bot, token in `TELEGRAM_BOT_TOKEN`.

- [x] **`sendTelegramAlert()` DID NOT EXIST — found and fixed 13 Aug.** Called
      from 7 places (sendGentleReminder's fallback, sendDMEDeadlineAlert,
      sendFollowUpAlert, sendDailySummary, 2 registration confirmations) and
      defined nowhere. Every call threw `ReferenceError`. Worse than one
      broken alert: Apps Script does not catch a throw inside a `forEach`
      callback, so in `sendGentleReminder()` the first department with no
      registered chat ID (which, before today, was every department) killed
      every department AFTER it in that same run too — even ones with a
      working chat ID. `sendDMEDeadlineAlert`/`sendFollowUpAlert`/
      `sendDailySummary` called it unconditionally, so those three have never
      delivered a single message, ever.
      Fixed by defining it: it now delivers to `OWNER_TELEGRAM_CHAT_ID`. Those
      three functions already compose a plant-wide, every-department report —
      that's what "an entire report" was always going to be — so no new
      report format was needed, just a working delivery path. Individual
      per-supervisor reminders (`sendGentleReminder`) also hardened with a
      per-department `try`/`catch` so this class of bug cannot recur.
      Verified with isolated Node tests, not just the syntax check: confirmed
      `sendTelegramAlert` no-ops (does not throw) with no owner registered,
      delivers correctly once one is, and that a chat-id-less department no
      longer blocks the departments after it.

- [x] **"Too many triggers" — found the real cause and fixed 13 Aug.** Not an
      ALERT.gs bug on its own: this script shares its Apps Script PROJECT
      (and therefore its 20-trigger-per-project quota) with `Code.gs`, the
      Operations Dashboard's own pull/alert script, which Yash pasted in for
      review. Code.gs already runs 11 triggers of its own (6 `runDashboardPull`
      + 4 `checkShiftEnd_*` + 1 `refreshCache15min`). `deployShiftTrackingTriggers()`
      used to create 15 more — 26 total, over Google's ceiling.
      Every alert function already no-ops safely when there is nothing to do
      right now (`getShiftToCheck_()` returns null outside a shift's window),
      so the fix was fewer triggers, not different code: `deployShiftTrackingTriggers()`
      now creates exactly 2 — `runShiftAlerts15min_()` (everything shift-
      boundary-shaped, every 15 min) and `runDailyMaintenance_()` (everything
      end-of-day-shaped, once daily). 2 + Code.gs's 11 = 13, comfortable
      headroom rather than sitting on the ceiling. Verified in Node: exactly 2
      triggers created, and the deletion pass — which only ever removes
      ALERT.gs's own stale trigger names — never touches `runDashboardPull`,
      `checkShiftEnd_*`, or `refreshCache15min`.

- [x] **Telegram token — inline slot added 13 Aug, same pattern as Supabase's.**
      `TELEGRAM_BOT_TOKEN_INLINE` and `OWNER_TELEGRAM_CHAT_ID_INLINE` at the top
      of the file, both blank in git for the same reason `SUPABASE_SERVICE_ROLE_KEY_INLINE`
      is: a live bot token lets anyone send as the bot and read everything sent
      to it, and a secret committed once is in the repository's history
      permanently even after a later commit removes it. Paste the token and
      (optionally) your numeric chat id into the LIVE Apps Script copy only —
      Script Properties still win if set there instead. Verified in Node: both
      inline values are used when no Script Properties are set, and Script
      Properties correctly override them when present.

---

## 🔴 In-app notifications have never worked — found and fixed 12 Aug

`supabase/functions/_shared/push.ts` writes every notification row as
`{ user_id, type, title, body, related_entity_type, related_entity_id }`.
The last two columns exist **only** in `supabase/migrations/20260803090000_initial_schema.sql`
— the old spec schema CLAUDE.md says to ignore. They are not in
`FINAL_SCHEMA_02Aug2026.sql`, which is what is deployed.

PostgREST rejects an insert naming a column that does not exist, and
`notifyEmployees()` never checked the error:

```ts
await db.from('notifications').insert(rows);   // error discarded
```

So the insert has failed every time, for every caller — `nightly-scoring`,
`fraud-detector`, `mrm-reminder`, `shift-reminder`. **The notification bell has
never received a single row from the server.** It stayed invisible because
Android push was separately broken on FCM, so "no notification arrived" already
had an accepted explanation.

- ✅ PATCH_14 adds both columns (`text`, not `uuid` — the forms reminder keys
  on `yyyy-mm-dd|Shift n`).
- ✅ `push.ts` now throws on insert failure instead of swallowing it.
- ⏳ Verify after running the combined deploy: trigger any edge function and
  check `select count(*) from notifications`.

---

## 🟢 Untested — needs a real device / real data

- [ ] **Role-by-role walkthrough** — now much cheaper: sign in as VFL1001 and
      use **More → View as** to step through all seven roles and every
      department. No second login, no PIN resets, nothing to undo afterwards.
- [ ] **5S photo submission end-to-end** — capture → upload → supervisor sees it.
      The one path in build 22/23 I could not test: no device, and Supabase is
      unreachable from the build sandbox.
- [ ] **Maintenance observation photo** — same flow, second screen.
- [ ] **GPS check-in inside the geofence** (100 m around 19.836079, 75.236261).
- [ ] **Nightly scoring** — rewritten but never executed against live data.
      Runs 22:00 IST; check `monthly_scores` the next morning.

---

## 🔴 Fraud detection — found and fixed 13 Aug: two of three fraud types were invisible to the owner

**`fraud-detector` (the edge function implementing GPS + bulk-confirmation
fraud checks) was never invoked by anything in the app.** Deployed since the
edge functions first shipped, called from nowhere — the same "deployed but
never invoked" pattern already found three times this session for cron jobs.
`worker/home.tsx` did its own client-only geofence check (blocks correctly,
but a modified APK could skip it, and it never wrote a record anywhere) and
computed a `mockLocationDetected` boolean that was stored on
`attendance_records` but never acted on or surfaced anywhere.

**Worse: even when called, both of `fraud-detector`'s actions wrote to the
wrong table.** `fraud_alerts` (`type` CHECK 'mock_location'/'buddy_punching'/
'bulk_confirm', `severity`, `status`) is the table every owner-facing surface
reads — `owner/alerts.tsx`, `owner/kpi.tsx`'s open-alerts count,
`dashboard/index.html`. `fraud_flags` is a different, narrower table
FINAL_SCHEMA's own "SECTION O" comment reserves for the buddy-device check
only (`worker/home.tsx`'s client-side same-device-different-employee check,
which was already correct). `fraud-detector` wrote mock-location and
bulk-confirmation flags into `fraud_flags` instead — so even a hypothetical
caller would have raised alerts nobody could ever see. Only `bulk_confirm`
alerts were ever visible, because `supervisor/team.tsx` has its own
parallel, correct, client-side implementation that writes directly to
`fraud_alerts` (works today, but its in-memory counter resets on remount and
it has no monthly escalation tiers).

**Fixed:**
- `handleGpsCheck` now writes `mock_location` alerts to `fraud_alerts`
  (human-readable description, `severity:'high'`, `status:'open'`) and
  notifies plant_head + owner. Being merely outside the geofence still blocks
  the check-in but no longer writes any row — matches the schema's own type
  CHECK, which has no slot for "outside radius" as a distinct alert type;
  that's not fraud on its own.
- `handleBulkConfirmationCheck` now writes to `fraud_alerts` too, and its
  monthly-count query for the 2-flags/3-flags escalation tiers reads from
  `fraud_alerts` filtered on `type='bulk_confirm'`, so if this action is ever
  wired up, escalation will actually work.
- `worker/home.tsx` now calls `fraud-detector`'s `gps_check` action on every
  check-in (new i18n key `worker.mockLocationDetected`, EN+HI). Fails open on
  a network error — the client-side geofence check above it still blocks
  obvious cases even offline, and a plant with patchy signal must never lose
  a legitimate check-in because the fraud check itself was unreachable.
- `supervisor/team.tsx`'s bulk-confirm path was deliberately **left alone** —
  it already writes to the right table with the right shape and is the only
  thing making bulk-confirm alerts visible today. Rewiring it to call the
  edge function (to get the escalation tiers and a check that survives a
  remount) is real future work, not done now because it changes tested,
  working behavior with no device available here to verify against.
- Verified with an isolated Node/tsx harness mocking the Supabase query
  builder (mirrors the resolveFormSheets.gs verification pattern from
  earlier today): 16/16 checks pass — mock-location blocks + alerts
  correctly, plain outside-geofence blocks but raises no alert, inside-
  geofence-no-mock allows cleanly, bulk-confirm-over-threshold alerts with a
  readable description and correct first-month count, under-threshold does
  nothing. `npx tsc --noEmit` and `expo export --platform web` (2892
  modules) both clean. The full headless-Chromium render check could not be
  completed — the sandbox container restarted mid-run — but this is a small,
  additive change to an already-verified screen (worker/home.tsx), and the
  bundler step that catches real syntax/type breakage passed.

**Still not done, and not urgent:** wiring `supervisor/team.tsx` to the edge
function for real monthly escalation tiers (2nd flag → HR Admin, 3rd+ →
Owner + Plant Head), which today never fire.

---

## 🔴 mrm-reminder / shift-reminder — audited 13 Aug: two real bugs found and fixed, one dead reference cleaned up

Line-by-line pass over the two edge functions that hadn't had one yet
(`nightly-scoring` and `fraud-detector` already did — see above). Both are
already known to be "deployed but never invoked" (PATCH_18/PATCH_20 exist to
fix that, neither run yet) — that part isn't new. What's new is what turned
up reading the logic itself against FINAL_SCHEMA and against what actually
gets seeded into `plant_config`.

**1. `mrm-reminder`'s escalation had no de-dup, and never could — the column
its own docstring said it wrote doesn't exist.** The docstring claimed step 3
"sets `escalated_at`" on the `mrm_reviews` row once a department is
overdue. There is no `escalated_at` column on `mrm_reviews` in FINAL_SCHEMA —
it exists only on unrelated tables in the old, ignored
`supabase/migrations/20260803090000_initial_schema.sql`, and the code never
actually attempted to write one. So every run past the 10th re-sent the Plant
Head an "MRM overdue" notification for the same still-pending department,
forever, once a day, with no way for the code to tell "already escalated"
from "escalate again." Fixed by de-duplicating against `notifications`
instead — checking for an existing `mrm_overdue` row keyed on the review's
own id (already unique per department/month/year) before sending another —
the same pattern `forms_due_reminder` already uses for its own dedup, so no
schema change was needed.

**2. That fix exposed a second, smaller bug: PATCH_20's single 09:00 IST
daily cron could never trigger the "10th at/after 17:00" branch the code
itself promises.** `isEscalationTime = dayOfMonth > dueDay || (dayOfMonth ===
dueDay && hour >= 17)`. With only one invocation a day, at 09:00, the
same-day-at-17:00 half of that condition is unreachable — 09:00 is always
before 17:00 — so the earliest the code could ever actually observe "past
due" was the 11th's 09:00 run, a full day later than documented. Fixed in
`scripts/PATCH_20_missing_crons_13Aug2026.sql` (not yet run — see below) by
adding a fifth cron job, `mrm-reminder-escalation`, pinned to day-of-month 10
at 17:00 IST only (`30 11 10 * *`), so that branch has an actual invocation
to fire on. Safe to run alongside the 09:00 job on the same day precisely
*because* of fix #1 above — without the dedup, this second run would have
double-escalated every department that went overdue on the 10th.

**3. `shift-reminder`'s `daily_checkin_reminder` mode has never fired for
anyone — the config key it read was never seeded under FINAL_SCHEMA, and its
hardcoded fallback doesn't match any real shift.** It read
`plant_config.shift_start_times` with a fallback of `{morning:'06:00',
evening:'14:00', night:'22:00', general:'09:00'}`. Those exact values are the
seed from the OLD, ignored `initial_schema.sql` — FINAL_SCHEMA never carried
that `plant_config` row forward, and no patch has ever inserted a
`shift_start_times` key under FINAL_SCHEMA either. So in the real, deployed
database `getPlantConfig()` always missed and silently fell back to those
stale values — which don't match this plant's real shifts (08:30 / 15:30 /
23:30, per `plant_config.form_shift_schedule`, seeded and live since
PATCH_14). Every real `employee_shifts.shift.start_time` this got compared
against would read `"08:30"` etc., never `"06:00"`, so the match could never
succeed — this reminder has been silently doing nothing since it was
written. Fixed by reading `form_shift_schedule` (the one shift-timing source
that actually is seeded under FINAL_SCHEMA — the same one
`forms_due_reminder` already reads) instead of maintaining a second,
never-seeded config key in parallel.
⚠ **Not fully closed even after this fix**: the `shifts` table itself has no
seed data anywhere in `scripts/*.sql`, and `app/(hr-admin)/shifts.tsx` only
*assigns* an existing shift to an employee — there is no screen or script
that *creates* a row in `shifts`. Until some `shifts` row exists with
`start_time` values matching `form_shift_schedule` (`08:30`/`15:30`/`23:30`),
`employee_shifts` cannot be populated at all (FK: `shift_id not null
references shifts(id)`) and this reminder still has nothing to match against
in practice. That gap is outside this fix's scope — it needs either a seed
script or a "create shift" flow, a real product decision, not a bug fix — but
it's the reason this reminder, while now correct, may still show `notified:
0` until it exists.

**4. Minor cleanup, not a functional bug:** `weeklyShiftNotify`'s "who should
have a shift" query excluded roles `('owner','ai_agent')`. `ai_agent` is not
a value FINAL_SCHEMA's `employees.role` CHECK constraint permits — it only
exists in the old, ignored schema — so no row could ever match it and the
exclusion was a harmless no-op. Still exactly the kind of stale reference to
the old schema CLAUDE.md's "What Claude must NEVER do" section warns about,
so simplified to `.neq('role', 'owner')`.

**`send-push-notification`** was also checked (lower priority — funnels
through the already-audited `_shared/push.ts`). No bugs found: it's
correctly invoked (`lib/notifications.ts`'s `notifyEmployeesByRole`, called
from `supervisor/team.tsx`'s bulk-confirm path), and every table/column it
touches (`employees.id`, `employees.emp_code`) matches FINAL_SCHEMA.

**Verified:** isolated Node/tsx harness (same technique as the fraud-detector
audit — mocked Supabase query builder, mocked `_shared/cors.ts` /
`supabaseAdmin.ts` / `push.ts`) exercising both fixed functions directly:
24/24 checks pass, covering — before-the-reminder-window (step 1 still
upserts, no notifications), in-window reminder with no escalation, exact-due-
day before 17:00 (not yet escalation), exact-due-day at 17:00 first
escalation (sends), a day later already-escalated (does NOT re-send, daily
manager reminder still does), `nextSaturdayToThursday` date math sanity, and
`dailyCheckinReminder` correctly matching a real 08:30 shift 15 minutes out
while leaving an unrelated Shift 3 employee alone. Two of those checks were
also run against an unmodified copy of the pre-fix code to confirm they
actually catch the bugs (both reproduce: the escalation double-fires, the
check-in reminder never fires) rather than passing regardless. `npx tsc
--noEmit -p .` clean. No `app/`/`hooks/`/`lib/` files were touched, so
`expo export --platform web` wasn't re-run (out of this change's blast
radius).

---

## 🔵 Known gaps still in the code

- [x] **QR check-in secret — CONFIRMED SET 13 Aug.** `is_set=true, length=48`.
- [x] **QR gate mechanism — FULLY CLOSED 25 Sep 2026.** `gate-qr.tsx`
      confirmed working at the gate (tested live, scanned successfully).
      Both scan paths are already on the strict salted check
      (`${plant.id}-${today}-${plant.qr_secret_salt}`, exact match) —
      workers via `app/(worker)/qr.tsx`, all other roles via the
      `CheckInCard` modal. The loose interim check that once existed in an
      earlier version of home.tsx was removed when QR scanning was moved to
      its own route. No further code change needed — strict validation is
      live for all 138 employees.
- [x] **Alert copy in Hindi — VERIFIED DONE 12 Aug.** All 38 `Alert.alert()`
      calls already use `t()`. Audited properly with `scripts/check-i18n.mjs`:
      Hindi covers 100% of English, and one key used on two dashboards
      (`common.overview`) had no entry at all — it was rendering the literal
      text "common.overview" as a section heading. Now added.
- [x] **`types/database.ts` — DELETED 12 Aug.** It mirrored the old schema and
      nothing imported it; it existed only to mislead. `types/index.ts` is the
      single type source.
- [x] **Buddy-device fraud check — FIXED 12 Aug, it had never fired.**
      `worker/home.tsx` used `Constants.deviceId || Constants.sessionId`.
      `Constants.deviceId` was removed from Expo years before SDK 51, so it is
      always undefined and every check-in wrote a fresh `sessionId` — meaning
      the "same device, different employee, same day" lookup could never match.
      Now a stable per-install id in `lib/deviceId.ts`.
- [ ] **Rotating supervisor assignment** — HR/IR decide weekly; no in-app flow.
      Currently a manual `supervisor_id` UPDATE. Closed as out of scope 10 Aug,
      but will keep needing manual SQL.
- [ ] **Shakeel Sayyad** — confirmed a real employee, still has no `emp_code`,
      so cannot be provisioned a login.
- [ ] **VFL1527 phone** — deliberately NULL, correct number still unknown.
- [ ] **`shifts` table has no seed data and no creation flow** — found 13 Aug
      while fixing `shift-reminder`'s `daily_checkin_reminder` mode (see
      above). No `scripts/*.sql` file seeds `shifts`, and
      `app/(hr-admin)/shifts.tsx` only lets HR assign an *existing* shift to
      an employee — there's no screen or script that creates one. Until a
      `shifts` row exists with `start_time` matching
      `plant_config.form_shift_schedule` (`08:30`/`15:30`/`23:30`),
      `employee_shifts` can't be populated (FK constraint) and shift-based
      reminders have nothing real to match against. Needs a decision: seed
      the three known shifts directly, or build a "create shift" screen.

---

## ✅ SQL deployed — PATCH_24 + PATCH_25 + PATCH_26 (23 Sep 2026)

All three deployed directly via Supabase MCP connector.

| File | Purpose | Status |
|---|---|---|
| `PATCH_24_leave_balances_22Sep2026.sql` | Seeds `leave_balances` for all 129 employees. 24 staff corrected from salary slip actuals. VFL1527 overdrawn at EL=-12/CL=-1/SL=-4. | ✅ Applied — 129 rows confirmed |
| `PATCH_25_payroll_records_22Sep2026.sql` | 19 active VFL4xxx workers, Aug 2026 payroll, net_pay only. | ✅ Applied |
| `PATCH_26_staff_payroll_23Sep2026.sql` | 36 active staff, Aug 2026, full per-component breakdown. | ✅ Applied |
| `PATCH_27_shifts_seed_23Sep2026.sql` | Shifts S1/S2/S3 — already present from PR #2; no-op. | ✅ Verified — 3 rows live |

**Confirmed in DB:**
- `leave_balances` WHERE year=2026 → 129 rows ✅
- `payroll_records` WHERE year=2026 AND month='08' → 55 rows ✅ (19 workers + 36 staff)
- `shifts` → 3 rows (Shift 1 08:30, Shift 2 15:30, Shift 3 23:30) ✅

**Staff not in salary slip** (VFL1319, VFL1465, VFL1550, VFL1553, VFL1568, VFL5074, VFL5083, etc.): payslip screen will show blank — acceptable until HR provides data.

---

## ✅ Done and verified

- [x] APK builds, installs, and launches (was crashing on open — CI never
      embedded the Supabase credentials)
- [x] PIN login: employee code **or** mobile + 6-digit PIN (PATCH_10)
- [x] Forced PIN change on first login
- [x] RLS infinite recursion fixed — login used to dead-end silently (PATCH_11)
- [x] 7 open RLS security holes closed, incl. privilege escalation (PATCH_12)
- [x] Photo storage bucket + RLS (PATCH_13)
- [x] NativeWind wired up — it had never been active, so **no** styling applied
      anywhere in the app
- [x] Full design pass across all 7 role groups, consistent palette
- [x] Varsha branding: app icon, splash, notification icon, in-app header
- [x] Camera capture wired on 5S + maintenance (was a hardcoded placeholder URL)
- [x] `nightly-scoring` rewritten off three non-existent tables
- [x] `manager/reports.tsx` implemented, department-scoped
- [x] `owner/kpi.tsx` wired to real data (was hardcoded chart values)
- [x] In-app update banner + build number on the update row
- [x] EAS `projectId` set (push token registration unblocked; delivery still needs FCM)
- [x] `HR_reset_pin.sql` utility for role testing
