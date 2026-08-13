# Forge OS — Claude Code Project Context

**Company**: Varsha Forgings Pvt Ltd (VFPL), Aurangabad  
**App**: Forge OS — bilingual (EN/HI) React Native attendance + HR system  
**Last full audit**: 10 August 2026  
**Branch**: `claude/forge-os-backend-setup-7woj4t`

---

## Working rules

**Prefer connectors, plugins and scripts over manual user steps.** Target
split: Claude does ~85%; the user does authentication, approval, and running a
script. If a human step is genuinely needed it should be a login, a
click-to-approve, or pasting one script — never copying file contents,
retyping values, or a multi-step console walkthrough. Before asking for
anything manual, run `ListConnectors` and check whether a connector can do it.
Connected and usable: Google Drive, Gmail, Google Calendar, Zapier, Notion,
GitHub, Figma, Gamma, Wix, Mem.

**Commit and push after every completed step.** Power and internet drop
frequently at this site; a failure must never cost more than the step in
progress.

**Keep `PENDING.md` current** — it is the shared checklist of what is
outstanding, blocked, or untested. Update it before the final push of any
session.

---

## Non-negotiable security rules

- All secrets via environment variables — never hardcoded
- Every database operation must go through Supabase RLS — never bypass from the client
- `.env` is gitignored — never commit real keys
- `SUPABASE_ACCESS_TOKEN` must never appear in chat — only in GitHub secrets
- Never use `DROP SCHEMA public CASCADE` — use per-table DROP

---

## Stack

| Layer | Technology |
|---|---|
| App | React Native + Expo Router (SDK 51, file-based routing) |
| Styling | NativeWind v4 (Tailwind for RN) |
| State | React hooks + AsyncStorage (zustand installed but not used) |
| i18n | i18next + react-i18next — `i18n/en.json` and `i18n/hi.json` |
| Backend | Supabase (project ref: `odfwtdpvpfzdrznvurru`) |
| DB | PostgreSQL via Supabase, RLS enforced |
| Auth | Supabase Auth email+password, presented as **employee code (or mobile) + 6-digit PIN** (PATCH_10, 11 Aug). Phone OTP retained as a fallback but inactive — needs an SMS provider + TRAI DLT registration |
| Edge functions | Deno (supabase/functions/) |
| Notifications | Expo Push + Supabase notifications table |
| PDF | expo-print |

---

## Supabase project

- **URL**: `https://odfwtdpvpfzdrznvurru.supabase.co`
- **Project ref**: `odfwtdpvpfzdrznvurru`
- **Expo project**: `@erp.varsha/forge-os` (username: `erp.varsha`)

---

## AUTHORITATIVE SCHEMA

**`scripts/FINAL_SCHEMA_02Aug2026.sql` is the deployed schema.** Ignore `supabase/migrations/20260803090000_initial_schema.sql` (old spec-derived schema — column names differ). The type file `types/database.ts` mirrors the OLD schema; `types/index.ts` mirrors FINAL_SCHEMA and is what the app uses.

### Key column names (FINAL_SCHEMA)

| Table | Key columns |
|---|---|
| `employees` | `emp_code`, `name`, `department` (TEXT), `supervisor_id`, `manager_id`, `plant_head_id`, `language_preference`, `category`, `salary` |
| `attendance_records` | `date` (not shift_date), `status` CHECK('P','A','L','WO','H','HL'), `checkpoint2_confirmed_by`, `checkpoint3_confirmed_by` |
| `monthly_scores` | `on_time_score`, `task_completion_score`, `eotm_badge` CHECK('bronze','gold'), `five_s_score` (was "5s_score" before PATCH_04) |
| `notifications` | `user_id` (not employee_id), `read` (not is_read), `related_entity_type`/`related_entity_id` both TEXT (added by PATCH_14) |
| `form_links` | `department` (uses `employees.department` spelling — 'Heat Treatment', not ALERT.gs's 'HT'), `form_name`, `url`, `send_in_reminder`, `sort_order` |
| `push_tokens` | `user_id` (not employee_id), `token`, `platform` |
| `leave_balances` | `earned_leave`, `casual_leave`, `sick_leave` |
| `advance_requests` | `employee_id`, `amount`, `reason`, `repayment_months`, `status`, `outstanding_balance` |
| `mrm_reviews` | `department` TEXT (not department_id FK), `month` TEXT zero-padded |
| `fraud_alerts` | `type` CHECK('mock_location','buddy_punching','bulk_confirm'), `employee_id`, `severity`, `status` |
| `fraud_flags` | `employee_id`, `flag_type` TEXT, `description`, `reviewed` |

### Tables that DO exist (FINAL_SCHEMA)
`employees`, `departments`, `plant_config`, `attendance_records`, `shifts`, `employee_shifts`, `leave_balances`, `leave_requests`, `advance_requests`, `payroll_records`, `monthly_scores`, `maintenance_observations`, `"5s_challenges"`, `"5s_submissions"`, `casual_workers`, `data_collection_submissions`, `mrm_reviews`, `fraud_alerts`, `fraud_flags`, `vehicle_log`, `eod_confirmations`, `email_tasks`, `notifications`, `push_tokens`, `form_links` (PATCH_14), `form_submissions` + `production_records` (PATCH_15)

### Tables that do NOT exist (referenced in old code)
`tasks`, `hourly_production`, `shift_reports`, `salary_advances`, `five_s_challenges`, `five_s_challenge_completions`

---

## Authentication — PIN login (PATCH_10, 11 Aug 2026)

**Why not OTP:** Supabase Phone OTP needs a configured SMS provider; for Indian numbers that also means TRAI DLT registration (company docs, days-to-weeks approval) plus per-message cost across 129 employees. Sending without a provider fails with `Unsupported phone provider` — which is exactly what the trial hit on 11 Aug.

**How PIN login works.** Supabase Auth has no native PIN mode, so each active employee is provisioned a real Supabase auth user whose email is synthetic (`<empcode>@forgeos.local`) and whose **password is the PIN**. This keeps us on stock Supabase Auth — real JWTs, sessions, refresh — rather than hand-rolled auth, and every RLS policy keyed on `employees.auth_user_id = auth.uid()` keeps working untouched.

- **Login accepts employee code _or_ mobile number.** Both are needed: ~a third of employees have no phone in the DB (VFL1527 deliberately NULL; only ~96 of 120 got numbers in PATCH_03), so phone alone would lock people out.
- **Identifier → email resolution** goes through `public.resolve_login_identifier()`, a SECURITY DEFINER function returning *only* the synthetic email. Needed because the lookup happens while still anonymous, when RLS correctly hides `employees`. It does reveal whether a code exists — accepted, since emp_codes are printed on ID cards and the PIN is the secret.
- **Starting PIN = emp_code digits padded to 6.** `VFL1001` → `001001`. Per-employee, *not* one shared default — a shared default would let anyone sign in as any colleague who hadn't logged in yet.
- **`must_change_pin` forces a change on first login**, gated in `app/index.tsx` (the only auth guard) and in `login.tsx`. Cleared via `public.mark_pin_changed()` — a SECURITY DEFINER function rather than an RLS update policy, because any policy broad enough to let employees update their own row would also let them edit their own `role`, `salary` or `supervisor_id`.

**⚠ Starting PINs are guessable by design.** Anyone who has seen an ID card can derive a colleague's starting PIN. The window is "until that person first logs in". HR should push everyone through first login promptly.

**OTP is retained, not deleted** — `app/(auth)/login-otp.tsx.bak`, the `signInWithOtp`/`verifyOtp` functions in `hooks/useAuth.ts`, and the phone-based `employees_self_claim` RLS policy are all intact. To revert: configure an SMS provider, restore that screen over `login.tsx`, revert `useAuth.ts`. Nothing in PATCH_10 needs undoing first.

---

## Push notifications — partially wired (11 Aug 2026)

**Status: project ID set, Android delivery still blocked on FCM.**

`Notifications.getExpoPushTokenAsync()` requires an EAS `projectId`. `app.json` had none, so it threw `No projectId found` in every standalone APK, `push_tokens` stayed permanently empty, and **all** push went nowhere — not just update alerts, but `shift-reminder`, `fraud-detector`, `mrm-reminder` and `send-push-notification`, i.e. four of the six edge functions.

- ✅ `app.json` → `extra.eas.projectId` = `832b3a3c-b4f7-4c27-9644-554ea6dc94b7` (provided by Yash 11 Aug). Not a secret — it is compiled into the APK.
- ✅ `owner` set to `erp.varsha` so EAS resolves the project.
- ✅ `google-services.json` in the repo root and referenced from `app.json` → `expo.android.googleServicesFile` (13 Aug). Firebase project `gen-lang-client-0072991718`, sender id `770370492554`, package `com.vfpl.forgeos` — verified to match before wiring.
- ✅ **Expo removed from the push path entirely (13 Aug).** Expo's push service is only a relay to FCM, and using it meant completing a dashboard wizard that demands an Android upload keystore this project does not have (CI builds are signed with the debug keystore, never by EAS). The server now talks to FCM v1 directly — `supabase/functions/_shared/fcm.ts`, authenticating with a Firebase service account. No Expo credentials, no keystore, no wizard.
- ⏳ **One secret still needed:** Supabase → Edge Functions → Secrets → `FCM_SERVICE_ACCOUNT_JSON`, pasting the whole service account JSON. Until it is set, in-app notifications work and push is skipped with a warning.
- Old note, kept for context: Expo's push service relays to Firebase Cloud Messaging for Android. Required:
  1. Firebase console → create/open a project → add an Android app with package `com.vfpl.forgeos`
  2. Download `google-services.json` into the repo root
  3. Add `"googleServicesFile": "./google-services.json"` under `expo.android` in `app.json`
  4. Upload the FCM **V1 service account JSON** to the Expo project (expo.dev → forge-os → Credentials → Android, or `eas credentials`)

  Without steps 1-4 the native FCM token cannot be obtained, so `getExpoPushTokenAsync()` still fails — it is caught and returns null (login is never blocked), but no device ever registers.

**Note `google-services.json` is a config file, not a secret**, but it identifies the Firebase project — commit it deliberately, not accidentally.

⚠ Push only starts working for employees who **reinstall** after these land: the projectId is compiled in at build time.

---

## Roles (7)

`owner` > `plant_head` > `hr_admin` + `manager` > `supervisor` > `security_guard` + `member`

**VFL1001** Yash Munot — owner  
**VFL1386** Fazal Ilahi Khan — plant_head  
**VFL5440** Pallavi Vishnu Khade — hr_admin

---

## Employee data

- 81 staff employees (EMPLOYEE_SEED_03Aug2026.sql)
- 39 worker employees (WORKER_SEED_04Aug2026.sql)
- 120 original + 4 (PATCH_08) + 5 (PATCH_09) = 129 total once all patches run
- ~96 of the original 120 have phone numbers after PATCH_03 (includes VFL5337 fix, 10 Aug)
- **VFL1527** Sharwan Singh Jodha — phone intentionally left NULL (number given was duplicate of VFL1520)
- **VFL1528** Bhupendra Kashinath Bharude — phone +918805698127 (fixed in PATCH_05)
- **VFL5450** Sayed Uzaif Ali — full name in payroll is "Sayed Uzaif Ali Syed Altaf Ali"; confirmed same person, no DB change needed
- **PATCH_08 (real emp_codes, confirmed against contact list + salary sheet 10 Aug 2026)**:
  VFL5462 Bharat Vasantrao Salve (Manager, Accounts), VFL5458 Shaikh Irfan (Supervisor, Forge Shop, Week 3 rotating), VFL5459 Vaibhav Mali (Supervisor, Press Shop, Week 1 rotating), VFL5460 Ashok Kumar (Supervisor, Final Shop)
  ⚠ Supersedes an earlier PATCH_08 committed 09 Aug that used fabricated codes VFL5463/5465/5466/5467 — see correction note in the patch file.
- **Nagnath Kale / Sadashiv Soddy**: confirmed NOT in payroll (contact list or salary sheet) — genuine outside consultants, no emp_code exists. Not added to DB. Only add if Yash provides a real emp_code and confirms app login is needed.
- **PATCH_09 (confirmed 10 Aug 2026)**: VFL5461 Shaikh Hafizuddin Tamizuddin (Manager, Quality), VFL5452 Bholanath Das (Forge Shop QA), VFL5453 Shaikh Zaker Abdul Quayyum (Press Shop QA), VFL5457 Sandip Tryambak Landage (Maintenance), VFL5454 Shaikh Tohid Yunus (Purchase)
- **VFL5463 correction (10 Aug 2026)**: "Manoj Anantrao Wagh" is NOT a new employee — he is VFL5337, already in EMPLOYEE_SEED_03Aug2026.sql (same name/dept/salary), just missing his phone. PATCH_03 now sets VFL5337's phone directly instead of PATCH_09 inserting a duplicate VFL5463 row. Caught by cross-checking against the Rev 04 org chart, which shows only one Manoj Wagh (Electrician, Maintenance).
- **supervisor_id**: partial assignments done in PATCH_05 (Final/Die/Maintenance/Forge); rotating departments need weekly update or a supervisor_rotation table
- Salary sheet (Jul 2026 payroll template) — used as source for dept/designation/salary of PATCH_08/09 new hires; contact list (not salary sheet) is the source of truth for phone numbers — several salary-sheet mobile numbers are misaligned/shifted
- **PATCH_07 corrections**: VFL1463→Press Shop, VFL1556→Press Shop+supervisor, VFL1545→manager, VFL1389→manager, VFL1557→HR dept, VFL5447→Admin dept
- **Vijay Kumar Yadav**: removed from org chart — never in DB, no action needed

---

## plant_config (key-value table)

Keys: `plant_code`, `plant_name`, `plant_lat`, `plant_lng`, `geofence_radius_meters`, `qr_secret_salt`, `form_shift_schedule` (PATCH_14)  
**GPS set to 19.836079, 75.236261 (confirmed by Yash, 09 Aug 2026). Geofence = 100 m.**  
QR salt: set by PATCH_16, generated inside Postgres with pgcrypto — nobody ever sees the value, including Claude. Confirmed set 13 Aug (`is_set=true, length=48`). ⚠ Having a real salt does not by itself secure QR check-in — see the note in `app/(worker)/qr.tsx` and "Work week" below.

---

## Work week — Saturday to Thursday, Friday off (confirmed 13 Aug 2026)

Yash: "week starts Saturday - friday is weekly off unless we have urgent
production friday is working. 90% of times friday is off."

Fixed on both ends that used to disagree or guess:
- `scripts/ALERT.gs` `weekStartFor_()` now computes Saturday (was Monday —
  a placeholder the script had "always assumed," per its own prior comment).
- `supabase/functions/shift-reminder`'s `weeklyShiftNotify()` window is now
  Saturday-Thursday (was Monday-Sunday — this is real app code that HR's
  shift-assignment notifications depend on, and it was simply wrong, not a
  guess anyone had flagged before).

No schema change needed for the Friday exception itself. `employee_shifts` is
already per-date, so a working Friday (urgent production) is just a Friday HR
assigns shifts for, same as any other day; a Friday off is one with none.

---

## SQL Patches applied (run in Supabase SQL Editor in order)

| File | Purpose | Status |
|---|---|---|
| `FINAL_SCHEMA_02Aug2026.sql` | Full schema | ✅ Applied |
| `EMPLOYEE_SEED_03Aug2026.sql` | 81 staff | ✅ Applied |
| `WORKER_SEED_04Aug2026.sql` | 39 workers | ✅ Applied |
| `PATCH_01_hrAdmin_03Aug2026.sql` | Pallavi role fix | ✅ Applied |
| `PATCH_02_plantHead_phone_04Aug2026.sql` | Fazal plant_head + Yash phone | ✅ Applied |
| `PATCH_03_phones_09Aug2026.sql` | 96 employee phones (incl. VFL5337 fix) | ✅ Applied 10 Aug |
| `PATCH_04_schema_fixes_09Aug2026.sql` | Rename 5s_score → five_s_score, add indexes | ✅ Applied 10 Aug |
| `PATCH_05_supervisor_ids_09Aug2026.sql` | VFL1528 phone fix + supervisor/manager/plant_head IDs | ✅ Applied 10 Aug |
| `PATCH_06_plant_config_09Aug2026.sql` | Real GPS (19.836079, 75.236261) | ✅ GPS applied 10 Aug — **QR secret salt still ⏳, must be set manually (never via chat)** |
| `PATCH_07_org_corrections_09Aug2026.sql` | Dept/role fixes: Dinkar→Press, Shyambabu→Press/sup, Mujahed→manager, Tushar→manager, Milind→HR, Sarang→Admin | ✅ Applied 10 Aug |
| `PATCH_08_new_employees_09Aug2026.sql` | **CORRECTED 10 Aug** — 4 new employees with real emp_codes: Bharat Salve(VFL5462), Irfan Shaikh(VFL5458), Vaibhav Mali(VFL5459), Ashok Kumar(VFL5460) | ✅ Applied 10 Aug |
| `PATCH_09_qa_purchase_maintenance_10Aug2026.sql` | 5 new employees: Tamizuddin(VFL5461), Bholanath Das(VFL5452), Shaikh Zaker(VFL5453), Sandip Landage(VFL5457), Tohid Shaikh(VFL5454) | ✅ Applied 10 Aug |
| `COMBINED_DEPLOY_03to09_10Aug2026.sql` | Combined one-shot version of the 7 patches above, run by Yash via SQL Editor | ✅ Ran 10 Aug — **129 total employees confirmed** |
| `PATCH_10_pin_auth_11Aug2026.sql` | PIN auth: provisions a Supabase auth user per active employee (synthetic `<empcode>@forgeos.local` email, PIN as password), links `auth_user_id`, adds `must_change_pin`, adds `resolve_login_identifier()` + `mark_pin_changed()` | ✅ Applied 11 Aug — sign-in confirmed working |
| `PATCH_11_rls_recursion_fix_11Aug2026.sql` | Marks `current_employee_id()`, `get_current_employee_role()`, `is_management()` as SECURITY DEFINER. Without this, selecting from `employees` recurses into its own RLS policy and dies with "stack depth limit exceeded", so login succeeds but the employee row never loads | ⏳ Not yet run — included in the combined file below |
| `PATCH_12_rls_hardening_11Aug2026.sql` | Closes the 7 open RLS holes from "Known RLS issues": employees INSERT was trivially true for any signed-in user (privilege escalation), notifications INSERT was `check (true)`, fraud_alerts/fraud_flags INSERT unscoped, attendance_records + leave_requests + advance_requests not scoped to a supervisor's own team, mrm_reviews readable by everyone. Adds the missing notifications UPDATE so the bell can be cleared | ⏳ Not yet run — included in the combined file below |
| `COMBINED_DEPLOY_11to12_11Aug2026.sql` | PATCH_11 + PATCH_12 concatenated (generated, cannot drift). Idempotent | ✅ Ran 11 Aug — confirmed by Yash |
| `PATCH_13_photo_storage_11Aug2026.sql` | Creates the private `submission-photos` Storage bucket + RLS so 5S/maintenance photos have somewhere to go. There was no bucket in the project at all; the camera screens wrote a hardcoded placeholder.com URL | ✅ Applied 12 Aug |
| `PATCH_14_form_registry_12Aug2026.sql` | `form_links` table + 24 daily forms seeded from Yash's registry sheet (keyed to `employees.department` spellings, not ALERT.gs's), `plant_config.form_shift_schedule` for the deadline times, and the missing `notifications.related_entity_type` / `related_entity_id` columns that had been making every server-side notification insert fail silently | ✅ Applied 12 Aug |
| `PATCH_15_ops_sync_12Aug2026.sql` | `form_submissions` + `production_records` — landing tables for the Operations Dashboard sync. Select-only RLS; writes come from Apps Script with the service role | ✅ Applied 12 Aug |
| `COMBINED_DEPLOY_13to15_12Aug2026.sql` | PATCH_13 + 14 + 15 concatenated. Supersedes `COMBINED_DEPLOY_13to14` and `COMBINED_DEPLOY_13` (both deleted; contents are inside this one) | ✅ Ran 12 Aug — 13+14 via the combined file, 15 on its own |
| `PATCH_16_qr_salt_13Aug2026.sql` | Generates `plant_config.qr_secret_salt` inside Postgres (pgcrypto) — nobody, including Claude, ever sees the value. First version matched the wrong placeholder list and silently no-op'd; fixed to match on shape (48 hex chars) instead | ✅ Confirmed set 13 Aug — `is_set=true, length=48` |
| `PATCH_17_reminder_scope_13Aug2026.sql` | Flags which of the 24 form_links rows are chased on the shift timer: 18 production forms YES, 6 non-production (overtime, dispatch, 57F4) NO. All 24 stay visible in the Forms tab either way | ✅ Applied 13 Aug — `18 true / 6 false` confirmed |
| `PATCH_18_forms_reminder_cron_13Aug2026.sql` | Schedules `forms_due_reminder` via pg_cron + pg_net, every 15 minutes. Without this the mode is deployed but never invoked — day-of-week inference never picks it | ✅ Applied 13 Aug — job active |
| `PATCH_19_dept_expansion_13Aug2026.sql` | Maintenance (4 daily forms: check sheet + 2 electricity + oil), Human Resource (2 manpower forms, As & When Required), VMC Shop (1 daily form) — all real published forms, verified against the live registry sheet via Drive before writing, not guessed | ⏳ Not yet run |
| `HR_reset_pin.sql` | HR utility: reset one employee to their starting PIN and re-arm the forced change. Needed after testing a role by logging in as that employee | ♾️ On demand |

**Total employees confirmed live: 129** (120 original + 4 PATCH_08 + 5 PATCH_09).

---

## App screen map (52 screens, 7 role groups)

```
app/
├── index.tsx              — role router (the only auth guard; routes on the EFFECTIVE role, see view-as)
├── view-as.tsx            — admin inspection: render the app as any role/department/category
├── (auth)/login.tsx       — employee code / mobile + PIN login
├── (auth)/change-pin.tsx  — forced PIN change on first login
├── (auth)/login-otp.tsx.bak — original OTP screen, kept as fallback (.bak so expo-router ignores it)
├── (worker)/              — member role
│   ├── home.tsx           — GPS check-in/out, QR, daily checklist
│   ├── attendance.tsx     — monthly calendar
│   ├── score.tsx          — composite score breakdown
│   ├── leave.tsx          — leave balance + apply
│   ├── advance.tsx        — advance requests
│   ├── payslip.tsx        — payroll record + PDF
│   ├── 5s.tsx             — daily 5S challenge + photo submit
│   ├── observation.tsx    — maintenance observation submit
│   ├── notifications.tsx  — in-app notification bell
│   ├── qr.tsx             — QR scan check-in
│   ├── profile.tsx        — employee profile
│   └── more.tsx           — language toggle, logout
├── (supervisor)/
│   ├── dashboard.tsx      — team attendance summary
│   ├── team.tsx           — confirm P/A per member (checkpoint 3)
│   ├── tasks.tsx          — resolve maintenance observations
│   ├── approvals.tsx      — approve leave/advance requests
│   ├── forms.tsx          — Google Forms for this department (PATCH_14)
│   ├── shift-report.tsx   — submit shift production data
│   ├── casual-workers.tsx — log casual worker counts
│   ├── 5s-verify.tsx      — approve/reject 5S submissions
│   └── more.tsx
├── (manager)/
│   ├── dashboard.tsx      — department attendance %
│   ├── team.tsx           — list supervisors under this manager
│   ├── approvals.tsx      — approve escalated leave/advance
│   ├── forms.tsx          — Google Forms for this department (PATCH_14)
│   ├── mrm.tsx            — submit MRM review
│   ├── reports.tsx        — department-scoped reports
│   └── more.tsx
├── (hr-admin)/
│   ├── dashboard.tsx      — stats: total, present, pending advances/leaves
│   ├── new-employee-flow.tsx — show pending activations
│   ├── advance-ledger.tsx — all advances with outstanding balance
│   ├── shifts.tsx         — shift assignment (master + per-employee)
│   ├── missing-data.tsx   — employees missing phone/dept/supervisor
│   └── more.tsx
├── (plant-head)/
│   ├── dashboard.tsx      — plant-wide attendance + low-attendance alert
│   ├── approvals.tsx      — final approval of all pending requests
│   ├── mrm.tsx            — view MRM submission status per dept
│   ├── email.tsx          — priority email task inbox
│   └── more.tsx
├── (owner)/
│   ├── dashboard.tsx      — top-level KPIs
│   ├── kpi.tsx            — KPI bar chart (data hardcoded — not wired to DB yet)
│   ├── approvals.tsx      — owner-level escalation approvals
│   ├── alerts.tsx         — open fraud alerts
│   ├── eotm.tsx           — Employee of the Month per category
│   └── more.tsx
└── (security)/
    ├── dashboard.tsx      — vehicle log (inward/outward)
    ├── team.tsx           — checkpoint 2 attendance confirmation
    ├── eod-lock.tsx       — EOD vehicle count reconciliation
    └── gate-qr.tsx        — today's salted gate QR, for display at the gate (PATCH_16 + 13 Aug)
```

---

## Admin "view as" (12 Aug 2026)

Owner, plant_head and hr_admin can inspect the app as any role, department or
category — `app/view-as.tsx`, reached from their `more.tsx`. Replaces signing
in as seven employees and resetting each PIN with `HR_reset_pin.sql`.

**Presentation only.** `hooks/useViewAs.ts` (zustand + AsyncStorage) changes
which screens render and which department they query; every request still
carries the admin's own JWT, so RLS answers for their real role. It can only
ever show *less* than the admin may see, never more. The picker is gated on the
REAL role, so a switch cannot reach the switcher. Writes still land under the
admin's own id — an approval made while viewing as a supervisor is recorded as
the admin's.

`hooks/useEffectiveIdentity.ts` is what screens should read when deciding what
to SHOW; keep using `employee.id` for anything they WRITE.
`components/ViewAsBanner.tsx` is mounted in the root layout so it cannot be
navigated away from.

---

## Plant dashboard — `dashboard/index.html` (12 Aug 2026)

One self-contained HTML file for HR and the plant head. No build step, no
server, no CDN — vanilla JS, hand-rolled SVG, inline CSS. Download and open.

Signs in with the same emp code/mobile + PIN via `resolve_login_identifier`,
then queries as that user, so **RLS is the security boundary, not the file**.
The embedded key is the *publishable* key (public by design, already in the
APK). A `service_role` / `sb_secret_` key must never go in this file.

Shows: today's headcount/present/attendance/late, pending approvals, open fraud
alerts, a 30-day attendance trend, app adoption (first logins via
`must_change_pin`, push registration), late-comers, low scores with an
adjustable threshold, per-department breakdown, a data-quality list, today's
form submissions, and month-to-date production.

**Warnings** write a real `notifications` row, which works because PATCH_12
made `notifications_insert` require `is_management()`.

---

## Telegram — dedicated bot, live (13 Aug 2026)

Yash asked whether the individual supervisor DMs should reuse the existing
bot or use a new one; recommended and agreed: **new bot**, dedicated purpose,
clean token, no collision with anything else this account might do.
**Created 13 Aug — @Form_mgr_bot.** Token goes in `TELEGRAM_BOT_TOKEN` (one
Script Property, not two — every send function reads that same one).

- **Onboarding.** A numeric Telegram chat ID is not something a person knows
  without messaging a bot first, so most `SUPERVISOR_MAP` rows had it blank.
  `processTelegramOnboarding()` polls the bot every 5 minutes; a supervisor
  messages their name, it's matched (case-insensitive, exactly one hit
  required) against this week's `SUPERVISOR_MAP` rows, and the chat ID is
  written in automatically. Deliberately conservative — zero or multiple
  matches are logged and skipped, never guessed, for the same "Todmal"
  name-variant reason documented elsewhere in this file. The owner uses the
  identical flow: messaging the bot with "Yash Munot" (or "owner") sets
  `OWNER_TELEGRAM_CHAT_ID` as a Script Property instead of writing a sheet row.
- **`sendTelegramAlert()` did not exist — found and fixed 13 Aug.** It was
  called from 7 places (the no-chat-id fallback in `sendGentleReminder`,
  unconditionally from `sendDMEDeadlineAlert`/`sendFollowUpAlert`/
  `sendDailySummary`, and 2 registration confirmations) and defined nowhere
  in the file. Every call threw. Because Apps Script does not catch an
  exception inside a `forEach` callback, the first department with no
  registered chat ID — which, before onboarding existed, was every
  department — killed every department scheduled AFTER it in that same
  `sendGentleReminder` run too. The three report functions called it
  unconditionally, so they have never delivered a single message, ever. Now
  defined: delivers to `OWNER_TELEGRAM_CHAT_ID`. Those three already compose
  a plant-wide, every-department report, which is what "send me the entire
  report" turned out to mean — no new report format needed, just a working
  delivery path. `sendGentleReminder`'s loop is also now wrapped per
  department in `try`/`catch` so one bad send can never again silently
  swallow the rest of the batch.
- Needs `deployShiftTrackingTriggers()` re-run to install the 5-minute
  polling trigger.

## Edge functions (6, all Deno)

| Function | Purpose | Cron |
|---|---|---|
| `nightly-scoring` | Composite monthly score for all members/supervisors/managers | Nightly 22:00 IST |
| `fraud-detector` | GPS + bulk-confirmation fraud checks | Called by app on check-in/supervisor confirm |
| `mrm-reminder` | Ensure MRM rows exist; remind managers 8th-10th; escalate to plant_head | Daily |
| `shift-reminder` | Weekly shift notify (Thursday) + daily check-in reminder (hourly) + `forms_due_reminder`, which nudges a department's supervisors/managers 15 min before each shift's form deadline | Thursday + hourly + every 15 min (`{"mode":"forms_due_reminder"}`, needs its own cron entry — mode inference never picks it) |
| `five-s-challenge-generator` | Generate daily 5S challenge via Gemini | Daily |
| `send-push-notification` | HTTP dispatcher — write notification row + Expo push | On-demand |

**Shared helpers** (`supabase/functions/_shared/`):
- `push.ts` — `notifyEmployees()` inserts `notifications` rows (`user_id` column) + Expo push batch. ⚠ It also writes `related_entity_type` / `related_entity_id`, which existed only in the OLD schema until PATCH_14 added them — before that every insert was rejected by PostgREST and the error was discarded, so no server-side notification ever reached anyone. It now throws on insert failure.
- `supabaseAdmin.ts` — service-role client + `getPlantConfig()`
- `geo.ts` — Haversine distance in metres
- `cors.ts` — CORS headers + `jsonResponse()`

---

## Known RLS issues (not yet fixed — need careful migration)

1. `employees` INSERT: `OR auth.role() = 'authenticated'` makes it trivially true — any logged-in user can create an employee row
2. `notifications` INSERT: `with check (true)` — any user can write to any user's notifications
3. `fraud_alerts` and `fraud_flags` INSERT: any authenticated user can insert
4. `attendance_records` write: supervisors not scoped to their own team
5. `leave_requests` UPDATE: supervisors not scoped to their own team
6. `mrm_reviews` SELECT: readable by all authenticated users (should be manager+ only)
7. No DELETE policies on any table (intentional for audit trail)

---

## Known screen-level issues (pending fixes)

| Screen | Issue |
|---|---|
| ~~`worker/home.tsx`~~ | ✅ Fixed 12 Aug. `Constants.deviceId` has not existed in Expo for years, so the buddy-device fraud check compared a fresh `sessionId` on every launch and could never match — no buddy flag was ever raised. Now `lib/deviceId.ts`, persisted per install. `.single()` → `.maybeSingle()` on the two optional lookups |
| `worker/5s.tsx` | Camera `takePhoto()` uses placeholder URL — not wired to expo-camera |
| `worker/observation.tsx` | Camera not wired |
| `supervisor/casual-workers.tsx` | Upsert conflict key uses `date` — check if `CasualWorkersRow` matches FINAL_SCHEMA |
| All screens | No auth guard in individual route layouts — only `app/index.tsx` routes by role |

---

## What Claude must NEVER do

- Commit `.env` or any file containing `service_role` key
- Use `drop schema public cascade`
- Guess employee phone numbers
- Reference `types/database.ts` column names (old schema) — always use `types/index.ts`
- Use `shift_date`, `full_name`, `employee_code`, `department_id`, `reporting_manager_id`, `salary_structure` — these are old schema names that don't exist in FINAL_SCHEMA

---

## Pending from Yash (owner)

0. **SQL — ALL APPLIED as of 12 Aug.** FINAL_SCHEMA, the seeds, PATCH_01 through PATCH_15 and every combined file have been run and confirmed by Yash. Nothing in `scripts/*.sql` is outstanding. Do not re-run any of them.

   Still needed, in the Supabase dashboard: a cron entry for `shift-reminder` every 15 minutes with body `{"mode":"forms_due_reminder"}`. Without it the shift form reminders never fire.

   And in the Apps Script editor, after pasting `scripts/ALERT.gs`: Project Settings → Script Properties → add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, then run `testSupabaseSync()` once. Without those two properties the dashboard→app sync never runs, so the Forms tab cannot show what is outstanding and department production stays empty. **The service role key must never be pasted into chat.**

1. **Worker → supervisor mapping** — CLOSED 10 Aug (Yash: "that will happen in the app") — this is an in-app assignment flow, not a DB patch task
2. **Rotating supervisor update** — CLOSED 10 Aug (Yash: rotations are decided every Friday by HR/IR, cannot be provided in advance) — the weekly `supervisor_id` UPDATE is HR/IR's own task going forward, not tracked here
3. **VFL1527 phone** — intentionally left NULL; correct number still unknown
4. **Shakeel Sayyad** — confirmed 10 Aug by Yash as a real employee, phone to stay NULL. Still needs a real `emp_code` (and department/designation/salary from the salary sheet) before he can be inserted — not fabricated, per the VFL5463 lesson (see PATCH_09 correction above). Add once Yash provides the code.
5. **Nagnath Kale / Sadashiv Soddy real emp_codes** — confirmed as genuine outside consultants (not in contact list or salary sheet). Provide a real emp_code from your master register only if they need app logins.
6. **Real bundle ID before Play Store submission** — **N/A as of 10 Aug**: Yash confirmed the app will NOT go on Play Store — APK will be distributed as a direct download link to all 129 employees (sideload install). `com.vfpl.forgeos` stays as-is, no further action needed on this.
7. **EAS account for signed/production builds** — not needed given #6 (no Play Store, sideload distribution). The existing debug APK from GitHub Actions is sufficient — Android installs any signed APK (including debug-signed) directly, no Play Store signing required. Only revisit if Yash later decides to publish to Play Store.

---

## App build

**Distribution: direct download link, no Play Store.** Every successful CI run auto-publishes to a GitHub Release. Stable permanent link for WhatsApp/anywhere — always resolves to the newest build:
`https://github.com/erpvarsha-star/forge-os-trial/releases/latest/download/app-release.apk`

**Working CI path — set up 10 Aug, confirmed producing a genuinely standalone-installable APK that doesn't crash on launch 11 Aug:**
`.github/workflows/build-apk.yml`. Triggers: manual (`workflow_dispatch` — Actions → Build Android APK → Run workflow, though note the token this repo's Claude sessions run under gets 403 on both `workflow_dispatch` and rerun-run API calls — only the `push` trigger actually works for them) or push to files it cares about (see `paths:` filter). Builds `assembleRelease` (NOT `assembleDebug` — see bug list below), then `softprops/action-gh-release` uploads `app-release.apk` straight from the runner to a GitHub Release (`apk-<run number>` tag, `make_latest: true`). This bypasses both the agent sandbox's network restrictions (Azure Blob Storage, which the artifact-download URL uses, is blocked the same as dl.google.com/expo.dev) and chat file-upload limits — Claude never needs to touch the binary. First run that produced an actually-launchable APK: https://github.com/erpvarsha-star/forge-os-trial/actions/runs/31449330749 (`apk-10`, commit 1f99490) — see the crash-on-launch bug below; every earlier "green" run (including the 10 Aug one previously linked here as "first fully-working") built successfully but crashed to a blank screen on open.

Real bugs this took to get green — all fixed in the repo, but re-check these on any future dependency bump, they're exactly the kind of thing that silently breaks again:
- **A green Gradle run doesn't mean a working app — check it actually launches, not just that it built (11 Aug).** `lib/supabase.ts` calls `createClient()` with `process.env.EXPO_PUBLIC_SUPABASE_URL!`/`_ANON_KEY!`; those `EXPO_PUBLIC_*` vars are inlined into the bundle by Metro at build time, not read at runtime. `.env` is gitignored, so CI never had them — `build-apk.yml` had no `env:` block supplying them at all — and `createClient(undefined, undefined, …)` throws `supabaseUrl is required` synchronously, before any screen renders. Every APK from every "successful" run up through 10 Aug had this crash; it was never actually caught because the CLAUDE.md verification step describing a headless-Chromium check couldn't have been run as described either (see next bullet) — the claim that it passed was wrong. Fixed by adding `EXPO_PUBLIC_SUPABASE_URL` (not secret, public project URL) and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (GitHub Actions repo secret, since `.env` can't reach CI) to the job's `env:` block, plus a fail-fast step that errors the build with setup instructions if the secret is empty instead of silently shipping a crashing APK.
- `react-native-web`/`react-dom` were referenced by CLAUDE.md's stated verification method (`npx expo export --platform web`) but were never actually in `package.json` — that command failed outright with "missing web dependencies," so the verification this doc claimed had been done, hadn't. Added both as pinned `devDependencies` (`react-native-web@0.19.10`, `react-dom@18.2.0` — the exact versions Expo SDK 51's own error message names; deliberately exact-pinned, not caret, matching how this project pins every other RN-interop package after the nativewind/reanimated incident below).
- `react-native-screens@3.31.0` ships a broken `postinstall` script (`bob build && husky install`) meant only for its own repo's dev workflow — `npm ci` needs `--ignore-scripts`.
- `assets/` was completely empty despite `app.json` referencing 5 icon/splash files — currently placeholder art, **swap for real branding before any real build**.
- `expo-router` declares `expo-linking` as a peer dependency with a wildcard `"*"` version. Left unpinned, npm resolves it to the newest ever published release (was SDK 57, this project is SDK 51) — pinned explicitly to `~6.3.0` in `package.json`.
- `babel.config.js` had `nativewind/babel` under `plugins` instead of `presets` — it's a preset (returns `{plugins: [...]}`), not a plugin, and Metro crashed outright with `.plugins is not a valid Plugin property`.
- `package.json` had `"nativewind": "^4.0.0"` (unpinned), which floated to 4.2.x → pulls in `react-native-css-interop@0.2.x`, whose babel plugin unconditionally requires `react-native-worklets/plugin` (Reanimated 4 only) — this project pins `react-native-reanimated@~3.10.0`. Pinned nativewind to `~4.1.23`, the last release whose `react-native-css-interop@0.1.x` uses `react-native-reanimated/plugin` instead.
- **The build type matters, not just whether Gradle exits 0.** `assembleDebug` succeeded for several runs before anyone noticed it produces an APK with **no embedded JS bundle at all** — React Native's gradle plugin only creates the bundling task for non-debuggable variants. It would have failed immediately for all 129 employees (needs a live Metro dev server). Switched to `assembleRelease`, which `android/app/build.gradle` signs with the debug keystore by default (standard Expo/RN template) — fully standalone, no separate keystore needed since this isn't going to Play Store.

Verification beyond "the Gradle command exited 0": `npx expo export --platform web` (bundles all 2671 modules across every screen/role) + a headless Chromium load of the output, confirming the actual login screen renders with zero console/page errors. Actually run 11 Aug with real Supabase credentials present (renders the phone-OTP login screen, zero console errors) and, as a negative control, with them absent and the Metro cache cleared (reproduces the exact `supabaseUrl is required` crash) — both required to trust the check, since a stale Metro cache will silently serve the previous run's bundle and pass either way.

**EAS cloud build (signed builds, Play Store submission) — not set up, needs Yash's Expo account:**
```bash
eas build --platform android --profile preview
# or: expo.dev → erp.varsha → forge-os → Builds → New Build
```
