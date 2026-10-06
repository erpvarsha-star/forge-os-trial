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

**🔒 LOCKED RULE — record a decision the moment Yash gives it, in this same
turn, not "noted for later."** (Added 27 Sep 2026, after Yash caught this file
re-asking a question he had already answered — VFL5463 was wrongly flagged as
a duplicate to reject, when he had already explained it was a legitimate
rejoin.) A decision only exists once it is written into this file's relevant
section (Employee data, plant_config, etc.) — not once it is written into a
chat reply, not once it is "remembered." Concretely:
- When Yash explains or corrects a fact about an employee, a config value, a
  process, or anything else this file documents, **edit this file before
  doing anything else with that information** — don't finish the current task
  first and circle back.
- Before restating any fact from this file that could plausibly have changed
  (headcount, who's active, pending approvals, config values) — **verify it
  against the live database first.** This file is a starting point for what
  to check, never a substitute for checking. Treat a note here as "true when
  written," not "true now," unless it is something that cannot change (a
  primary key, a historical event, a completed one-time migration).
- If Yash says "I already told you this" or corrects the same fact twice,
  that is a signal this file has a stale or missing entry — fix the entry
  itself, don't just apologize and move on.

**🔒 LOCKED RULE — IST everywhere, permanently (audited + fixed 27 Sep 2026, session 14).**
The app operates on IST (UTC+5:30), never device-local time or bare UTC. The
database stores timestamps in UTC; every place the app computes "today,"
"this month," a query date-boundary, or an overdue/deadline check MUST derive
it from IST, never from a plain `new Date()`/`.getMonth()`/`.getFullYear()`/
`.getDate()`/`.getDay()` call, because those read the *device's* clock and
timezone — wrong the moment a phone isn't set to IST, and wrong for anyone
near the UTC/IST day boundary (IST is 5.5h ahead, so 18:30 UTC is already the
next day in IST) regardless of device settings.

**The fix that made this a rule, not a suggestion**: a full-codebase audit
found and fixed 16 files with exactly this bug (see PENDING.md, 27 Sep 2026)
— it wasn't hypothetical, it was the live cause of HR's "calendar shows the
wrong date, yesterday's attendance is missing" report. There are now
committed, tested helpers specifically so this can never quietly regress:

- **Frontend** (`app/`, `hooks/`, `components/`): import from `lib/istDate.ts`
  — `istDateStr()` (today, `YYYY-MM-DD`), `istNow()` (IST as a `Date`, read via
  its `getUTC*` methods), `istMonthYear()` (current month/year), `getMonthEndDay()`
  (28–31, replaces any hardcoded month-end), `istStartOfDayUTC(dateStr)`
  (the UTC instant for IST midnight of that date — required whenever filtering
  a `timestamptz` column like `created_at`, since a bare `"YYYY-MM-DDT00:00:00"`
  with no `+05:30` offset is silently read as UTC midnight, 5.5h early).
- **Edge functions** (`supabase/functions/*/index.ts`, Deno): import the
  equivalent from `supabase/functions/_shared/istDate.ts` — same four
  functions, same names, ported for Deno. Never duplicate an inline `istNow()`
  in a new function; import the shared one.
- **Raw SQL / dashboard queries**: still use `AT TIME ZONE 'Asia/Kolkata'`:
  ```sql
  SELECT timestamp_column AT TIME ZONE 'Asia/Kolkata' as ist_time FROM table_name;
  ```

**Before adding any new date/time logic — frontend, edge function, or SQL —
Claude must grep for `new Date()`, `.getMonth()`, `.getFullYear()`, `.getDate()`,
`.getDay()`, and `.toISOString().split('T')[0]`/`.slice(0,10)` in the file being
touched and confirm the IST helper is used, not a device-local equivalent.**
A "duration/elapsed-time" calculation (subtracting two Date objects, or a
`Date.now() - N*1000` sliding window) is the one legitimate exception — that
kind of math is timezone-invariant by construction and needs no IST helper.
Everything else that answers "what calendar day/month is it" must go through
the helpers above. This matters for shift times, deadlines, attendance
recording and counting, payroll month/year lookups, and all compliance data —
the user operates on IST, never UTC, and never "whatever the device thinks."

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
- **Org plan: staying on Free — decision from Yash, 27 Sep 2026.** A health
  check that day found the org (`joixzxeabmmsdguruiih`) on the Free tier —
  no automated backups/PITR, 500MB storage cap. Flagged Pro ($25/mo) as the
  one upgrade that actually protects against data loss. **Yash's call:
  staying free** — usage is well within limits (26MB of 500MB at the time
  of the check) and "as per reviews it does not break." **Do not re-raise
  the Pro upgrade recommendation** — this is a closed decision, not an
  oversight. Revisit only if actual usage approaches the Free tier's limits,
  or if Yash raises it himself.
- **`SUPABASE_ACCESS_TOKEN` GitHub secret — rotated 27 Sep 2026, valid to
  25 Sep 2027, full account access (Supabase personal access tokens have no
  project-scoping option).** The `Deploy Edge Functions` workflow had been
  failing on every run since ~24 Sep with `supabase link` returning
  "Unauthorized" — this token fixes that. **When this token expires
  (25 Sep 2027) the exact same failure will recur** — check
  `.github/workflows/deploy-functions.yml` run history if edge function
  deploys start silently not landing again after that date, and rotate the
  same way (supabase.com/dashboard/account/tokens → generate → paste into
  the GitHub repo secret).

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
- **Nagnath Kale / Sadashiv Soddy — STALE NOTE, SUPERSEDED 27 Sep 2026.** This used to say "confirmed NOT in payroll, no emp_code, not added." That was true when written; it no longer is. Both are live in `employees` with real emp_codes — **CON09 Nagnath Damu Kale** (Die Shop) and **CON12 Sadashiv Nitalaksha Soddy** (Quality) — both `is_active=true`, both have completed first login (`must_change_pin=false`). **Do not re-flag either as "consultant, no emp_code, not added" again** — verify against the live `employees` table before repeating any older note in this file, not the other way round.
- **CON12 Sadashiv Nitalaksha Soddy — role corrected `member`→`manager`, 28 Sep 2026.** He is the Quality group's shift allocator per `Shift_Planning_1.csv` and, per Yash, "consultant and quality manager" — but had `role='member'` from `PATCH_35`'s blanket consultant-role default. Fixed via `PATCH_62`. Do not describe him as a `member` again; check `employees.role` live if in doubt, same rule as everywhere else in this file.
- **CON24 Shriram Pawar (Maintenance) — added 28 Sep 2026, PATCH_62.** Found only in `Shift_Planning_1.csv` (a Maintenance team member under allocator VFL1560), not previously in `employees`. `role='member'`, `category='consultant'`, salary 0 — CSV had no phone/salary, matching how `PATCH_35` seeded the other consultants. Login provisioned (starting PIN `'20' + LPAD(24, 4, '0')` = `200024`, same formula as every other consultant).
- **PATCH_09 (confirmed 10 Aug 2026)**: VFL5461 Shaikh Hafizuddin Tamizuddin (Manager, Quality), VFL5452 Bholanath Das (Forge Shop QA), VFL5453 Shaikh Zaker Abdul Quayyum (Press Shop QA), VFL5457 Sandip Tryambak Landage (Maintenance), VFL5454 Shaikh Tohid Yunus (Purchase)
- **VFL5463 / VFL5337 — two different events, do not conflate.**
  1. *10 Aug 2026 (historical, still true as a record):* a data-entry mistake nearly inserted "Manoj Anantrao Wagh" a second time as VFL5463 when he already existed as VFL5337 (same name/dept/salary, just missing a phone). Caught before it happened; PATCH_03 set VFL5337's phone directly instead. **That VFL5463 row was never created.**
  2. *27 Sep 2026 (current, unrelated to #1 — confirmed directly by Yash):* the real VFL5337 (Manoj Anantrao Wagh) **left the company and has since rejoined**. His original record was deactivated 26 Sep 2026 (`VFL5337.is_active=false`, still holds his history/login for the record). HR (Pallavi) submitted a **new, legitimate** employee record under **VFL5463** for his rejoin — this is not a duplicate-in-error like #1, it is the correct way to represent a second stint. **Decision: approve VFL5463 through the normal chain (plant_head → owner) like any other new hire — do not reject it as a duplicate.** The only open item on it is the same CTC concern below, not its legitimacy.
  - **🔒 RESOLVED 27 Sep 2026, decision from Yash — HR finalises pay monthly, never annual.** The ₹20-21k figures weren't a data-entry mistake: HR (Pallavi) works entirely in finalised monthly pay. The annual/monthly ratio varying 11.1x-13.9x across the live workforce (checked directly) isn't noise either — it's workers/members carrying a higher bonus % than staff, so no single multiplier reconstructs a "true" annual figure from monthly pay across every category. **Decision: `ctc_annual` is never typed in by HR — it is auto-derived as 12x the finalised monthly total**, and this must never block onboarding on a value HR doesn't have. Implemented in `components/SalaryBreakupFields.tsx` — the CTC Annual input was removed from the form entirely; `breakupToPayload()` computes it from the sum of the monthly fields actually entered. The 3 requests already pending when this shipped (VFL5463, VFL5465, VFL5466) were recomputed the same way (₹207,996 / ₹207,996 / ₹221,712) so they aren't stuck behind the old figure.
- **VFL1319 Dipak Balkrishna Patil (Accounts) — deactivated 28 Sep 2026, Yash: "has left."** PATCH_60 applied. Matches what his own salary sheet's Master Data already said ("Non-Active"). Never logged in, no direct reports — clean deactivation.
- **4 more deactivated 28 Sep 2026, Yash: "these have also not working for Varsha"** (PATCH_61) — all 4 were on the never-logged-in list: **CON22 Digambar Mahadeo Todekar** and **CON23 Suresh Sopan Gawali** (Die/Final Shop), **VFL5354 Rahul Ashok Patil** (Machine Shop, already flagged this session — see the "2 staff employees" note above), **VFL4048 Babasaheb Dagadu Randive** (Forge Shop). CON22/CON23 were added earlier this same session as confirmed rejoins (PATCH_55, real pay in June 2026) — **not a contradiction**: their payroll drops sharply in July and stops entirely in August, consistent with a short second stint that also ended. None had ever logged in.
- **VFL5439 Bhanwar Singh Rathod (Security, security_guard) — stationed at Pune Office, not the Aurangabad plant, confirmed by Yash 28 Sep 2026.** Explains the "Pune Office" `plant_locations` row (200m radius, real Pune coordinates 18.556944, 73.816361) that earlier sessions flagged as an unexplained outlier outside the documented 12-point Aurangabad campus seed — **it's deliberate, not a data error.** He is still on the never-logged-in list (`must_change_pin=true`) — being at a different location doesn't explain that; still needs a first login.
- **VFL1391 Atul Bhata Patil (Maintenance, member) — 00:05 check-in on 28 Sep = Shift 3 of 27 Sep, decision from Yash, 28 Sep 2026.** Yash did NOT say he is a permanent night worker (an earlier version of this note wrongly said so): "if he checked in 12.05 am consider him as night shift" … "it is 3rd shift for 27th not 28th." Record stays `date=2026-09-27`, his 27 Sep shift set to Shift 3, on time. (A first correction wrongly moved it to 28 Sep — reverted same day.) See "Shift 3 belongs to the previous working day" below for the general rule.
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

## plant_locations — multi-point geofence (PATCH_21, 13 Aug 2026)

`plant_locations` (`name`, `latitude`, `longitude`, `radius_meters`, `is_active`) supersedes the single-point `plant_config` geofence check-in-validity-wise, once seeded. Check-in is valid within radius of ANY row — the campus is one contiguous site (12 named locations: Plant location, Office 1st Floor, Machine/Die/VMC/Press/HT/Forge/Cutting/Final shops, Raw Material, Store), not tied to the employee's own department.

`worker/home.tsx` and `fraud-detector`'s `gps_check` both read `plant_locations` first and fall back to the old single-point `plant_config` geofence when it's empty or doesn't exist — **PATCH_21 (table only, 0 rows) is safe to run any time; behaviour is unchanged until PATCH_22 (the seed) also runs.** Real coordinates received from Yash 13 Aug (this sandbox's network egress proxy cannot reach any Google Maps domain, confirmed with a direct proxy-level 403, not just a fetch-tool restriction) — `COMBINED_DEPLOY_21to22_13Aug2026.sql` has both patches ready to run. Sanity-checked before writing: every point is within 131m of "Plant location" (Machine shop is farthest, at 131.3m — just outside the OLD single-point 100m radius, a real case this fixes). "Cutting shop" and "Final Shop" were sent with identical coordinates — seeded as given, harmless, but worth Yash double-checking it isn't a copy-paste slip in the source sheet. See PENDING.md.

**Per-point radius — 15m tried, too tight, now 25m (PATCH_57, 28 Sep 2026).**
27 Sep 2026: an audit found the seeded 100m-everywhere radius pushed the
effective check-in boundary well past the campus (the whole site spans only
134.7m end to end) — plausibly reaching a public street corner, which
matched a complaint. Yash's call that day: 15m. Flagged at the time that
typical phone GPS accuracy (±5-20m outdoors, worse inside a steel-frame shop)
made 15m risky. **That risk materialized 28 Sep** — Yash: "15m is making it
difficult for ppl to sign in." Raised to **25m** on all 12 real campus points
(`Pune Office`, not part of the documented 12-point seed, left at 200m,
untouched both times — confirmed 28 Sep 2026 as deliberate, not a data
error: VFL5439 Bhanwar Singh Rathod is stationed there, see "Employee data"). If 25m still proves too tight for a specific shop
(Machine shop sits 68.6m from its nearest neighbour, the widest gap on
campus), the fix is a **per-point** radius bump there, not another global
change — watch `worker.outsidePlant` complaint volume before touching it
again.

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

## Shift inference for unassigned check-ins — decision from Yash, 27 Sep 2026

**Decision:** "if there is no shift allotment done for anyone consider the
shift closest to their check in time as their time." Before this, an employee
with no `employee_shifts` row for today had `shiftStart` stay `undefined`, so
`rawLateMinutes` was always `0` — **lateness was silently never evaluated at
all** for anyone HR hadn't assigned a shift to yet, not just left unflagged.

**Implemented same session, algorithm corrected same session after Yash
worked through his own examples** — `lib/shiftInference.ts`'s
`findClosestShift()`, called from both check-in paths (`app/(worker)/home.tsx`,
`components/CheckInCard.tsx`) whenever no shift row exists for today.

⚠ **First version used symmetric closest-start-time distance — wrong, caught
by Yash before it shipped to real behavior.** His own worked example: 08:15
should be Shift 1 (starts 07:00), late — but 08:15 is numerically closer to
General's 09:00 (45min away) than to Shift 1's 07:00 (75min away), so
closest-distance would have wrongly assigned General (on time), not Shift 1
(late). **Correct model, confirmed against Yash's exact examples
(07:45/08:00/08:15/08:30 → Shift 1, late; 08:45 → General, on time):** each
shift owns a window from `(its own start − 15min)` up to `(the next
chronological shift's start − 15min)`; whichever window contains the actual
check-in time wins. The 15-minute buffer is fixed for every shift — including
General, whose own `late_grace_minutes` is 30 — because this buffer answers a
different question (which shift is this?) than `late_grace_minutes` does
(is this check-in late for that shift?); conflating them was not what Yash
described. Verified with a standalone script reproducing every one of his
examples exactly before merging.

Finds the matching `shifts` row (handles Shift 3's 00:00 wraparound via
circular window math), **inserts an `employee_shifts` row for it** (not just
a one-off calculation — this makes the inferred shift persist for that date,
so Late Comers Review, shift-wise reports, and a later check-out all see the
same shift consistently), then uses its `start_time`/`late_grace_minutes` for
the late calculation exactly as an HR-assigned shift would.

**One inference detail decided here, not asked, because it was unambiguous
given the existing data:** candidate shifts are restricted to `security_guard`
matching only shift names starting with "Security", everyone else matching
non-Security shifts. `shifts.department` is `null` on every live row (no
DB-level role scoping), and "Security Day" and "Shift 1" both start at 07:00
— without this split a security guard's 07:00-window check-in could land on
either shift depending on array order.

**Behavior change to watch for:** employees who were previously never marked
late (no shift assigned) will now show as late if they check in after their
inferred shift's start + grace period. This is the intended effect of the
decision, not a bug — but worth knowing before HR gets asked why someone who
was never late before suddenly is.

---

## Check-in time decides the shift, even over HR's allocation — decision from Yash, 28 Sep 2026

"hr is still getting use to the app so, consider the persons check in time as
his shift, hes coming in that shift as his manager or planthead called him in
that, hes not deciding himself. so let hr get familiar with allocation of
shift on thursday; if they do not plan on thursday we have to assume they are
verbally told of when to come to work." Extends the 27 Sep inference rule
below from "no allocation" to "allocation that doesn't match the check-in":
an employee is never marked late against an HR-assigned shift they were
verbally moved off. Implemented in `lib/shiftInference.ts`
`resolveShiftForCheckIn()`: if the check-in fits the assigned shift (from
60 min before its start up to its grace period) the assigned shift is kept;
otherwise the shift whose window contains the check-in time is used and the
day's `employee_shifts` row is **updated** to it. The 60-min early allowance
is Claude's judgment call (not Yash's number) so General staff arriving
08:00–08:44 aren't reclassified to Shift 1 and marked late — change it in
one constant if Yash wants it different. Temporary by intent ("while HR gets
used to it") — revisit once HR plans shifts every Thursday.

**Test mode until 1 Oct 2026 — decision from Yash, 28 Sep 2026.** "we are in
test mode of app, and 1st october is when we ensure its working well."
Do NOT retroactively re-evaluate pre-1-Oct attendance (e.g. the 39
check-ins since 27 Sep that never got a shift/lateness because of the
PATCH_59 bug) — leave test-period data as it is. 1 Oct is the go-live
date the app must be working correctly by; fixes land before then, data
from 1 Oct onward is what counts.

## Shift 3 belongs to the previous working day — decision from Yash, 28 Sep 2026

"it is 3rd shift for 27th not 28th." Shift 3 runs 00:00–07:00, but it is the
**third shift of the previous working day**: a check-in at 00:05 IST on
28 Sep is Shift 3 **of 27 Sep**, and its `attendance_records.date` /
`employee_shifts.date` is 27 Sep, not the IST calendar date. The working day
therefore runs Shift 1 → Shift 2 → Shift 3, rolling over only when the next
day's Shift 1 window opens (06:45 IST = Shift 1 start − the 15-min
shift-matching buffer from the inference rule above). Any check-in before
06:45 IST belongs to the previous date. Nightly counts, dashboards and
reports that use "today" still mean the calendar date — only the date an
attendance/shift row is filed under follows this rule.

## Attendance counting rules — fixed 28 Sep 2026

**`attendance_records.status = 'L'` means Late, not Leave** (`ATTENDANCE_STATUS_LABELS`
in `constants/index.ts`) — the person checked in and is at work. Found
28 Sep that almost every counter treated only `'P'` (or `'P'`/`'HL'`) as
present, so every late arrival was silently counted as absent: the Owner /
HR / Manager / Plant Head / Supervisor dashboards, the plant HTML dashboard,
the manager's monthly report, an employee's own "present days", and —
most seriously — `nightly-scoring`, which scored late days as absences in
the attendance ratio *and* never counted them as late (so `lcCount` was
always 0). 26 Sep: 39 counted vs 60 actually at work.

**The rule now, everywhere:** present = `P`, `L`, `HL`
(`PRESENT_STATUSES` / `isPresentStatus()` in `constants/index.ts` — use
these, never re-list statuses inline in app code). Expected/denominator =
active headcount minus `WO`/`H` rows — **not** "people who have a row",
because a no-show has no row at all and would otherwise vanish from the
denominator (the HTML dashboard showed ~97% on a day ~56% attended).
Absent tiles = expected − present, not just explicit `'A'` rows.

Also fixed same pass: the attendance calendar's "today" ring compared
`istNow()` (shifted, meant for `getUTC*` reads) using date-fns local
getters, double-applying +5:30 — wrong day every evening after 18:30 IST.
It now compares against `istDateStr()`. And `(manager)/mrm.tsx` was saving
`submitted_at` as `istNow().toISOString()`, a timestamp 5.5h in the future
(no rows affected — no MRM had been submitted yet). **`istNow()` must never
be written to a `timestamptz` column or read with local getters.**

---

## Daily + month-end attendance to Google Sheet + email — built 28 Sep 2026

Yash: wants attendance visible outside the app, so a Sheet that stays
updated + email, not just the in-app dashboards. Confirmed via
`AskUserQuestion`: both Sheet and email; the Sheet is his own existing
**"VFL HR OS 2026 27"** spreadsheet (`10-OpV86Gvi_TlBPQ6zKQC6y7MLWqietELGU3G06exIM`),
not a new one; email recipients TBD ("I will give you the email addresses
when you need them").

**`scripts/AttendanceReport.gs`** (new file, lives in the SAME Apps
Script project as `ALERT.gs` — reuses its `SUPABASE_URL`/
`SUPABASE_SERVICE_ROLE_KEY` Script Properties and `getSupabaseCredentials_()`,
zero new credentials). Not yet pasted into the live Apps Script editor —
that one-time paste + running `installAttendanceReportTrigger()` once is
still Yash/HR's step.

- **"Daily Attendance" tab**: one row per *every active employee* per
  day, not just those who checked in — an absent employee gets a blank
  row rather than being dropped, matching this session's own "never
  silently drop people from the denominator" fix for the in-app
  dashboards. Columns: Date, Emp Code, Name, Department, Check In,
  Check Out, Working Hrs, Late Mins.
- **"Monthly Attendance Summary" tab**: rebuilt on the 1st of each month
  for the month that just closed. Columns: Month, Emp Code, Name,
  Department, Total Present Days, Avg Working Hrs/Day, Times Late
  (>grace). **"Total Present Days" is read as days present (P/L/HL),
  not calendar days in the month — an assumption, not confirmed by
  Yash**, since his spec paired it with "average working hrs per day,"
  which only makes sense per-present-day.
- **Late Mins reuses existing data, no new math**: `attendance_records.late_minutes`
  is already grace-adjusted at write time (`hooks/useAttendance.ts`'s
  `checkIn()`), so "only shown if crossed grace" just means "blank when
  null/0" — nothing new to compute.
- **No-checkout rule applied, same as the app** (28 Sep decision above):
  if someone checked in but `hours_worked` is null, the row gets the
  shift's default (General=9h, else 8.5h floor) — but ONLY when they
  actually checked in; a true absence (no check-in at all) stays blank,
  not defaulted. `lib/workingHours.ts`'s logic is hand-replicated since
  Apps Script can't import it — **keep both in sync by hand if that rule
  ever changes**, same duplication risk already flagged for the IST
  helpers.
- **Trigger design, fixed after an independent review caught a real
  bug**: v1 used `.timeBased().atHour(8).inTimezone('Asia/Kolkata')` —
  `.inTimezone()` does not exist on Apps Script's `ClockTriggerBuilder`
  and would have thrown at install time. Fixed to the same pattern this
  project's own `runShiftAlerts15min_` already uses: an **hourly**
  trigger whose handler explicitly checks `Utilities.formatDate(now,
  'Asia/Kolkata', ...)` before doing real work (gated to the 07:00-07:59
  IST hour, deduped via Script Properties so it only fires once per IST
  day) — never relying on the Apps Script project's own timezone
  setting, which nothing in this repo confirms is set to IST.
- **07:00 IST, reporting on "yesterday," self-healing "day before
  yesterday" too**: chosen because Shift 3 (00:00-07:00) belongs to the
  *previous* working day (see "Shift 3 belongs to the previous working
  day" above) — 07:00 is right after that window closes. Re-processing
  the day before yesterday every run means a Shift-3 checkout landing
  slightly late (e.g. 07:15-07:45, after this run already fired) gets
  corrected automatically the next morning, via upsert-in-place —
  without any special-case code.
- **Idempotent by upsert-in-place**, not delete-then-append: each row
  carries a hidden `_key` column (date+employee, or month+employee); a
  re-run overwrites the matching row instead of duplicating it.
- **Failure handling**: a Supabase read failure aborts before touching
  the Sheet or sending the real report — Yash still gets alerted, via
  `MailApp` to `OWNER_EMAIL` (already defined in `ALERT.gs`) plus
  whatever `ATTENDANCE_REPORT_RECIPIENTS` holds, so a broken job is
  never silent (this project's own `sendTelegramAlert` incident is the
  cautionary precedent).

**Still open, not decided — needs Yash before/around first real use:**
1. Email recipient addresses (he'll provide).
2. "Total Present Days" definition (see assumption above).
3. Whether this should start running now (test mode until 1 Oct) or
   stay installed-but-inert until go-live — harmless either way since
   it's read-only, but confirm.
4. The "VFL HR OS 2026 27" spreadsheet has more tabs than could be
   enumerated from here (confirmed at least "Overtime_Form", ~25k
   rows) — worth a glance that "Daily Attendance"/"Monthly Attendance
   Summary" don't collide with anything already there before the first
   real run.

**⚠ SUPERSEDED 6 Oct 2026 — Apps Script approach abandoned, see below.**
Yash: "your code .gs for pulling from supabase into sheet is not working."
(Root cause was almost certainly that the one-time paste-into-editor +
`installAttendanceReportTrigger()` step above was never done, not a bug in
the script — but Yash wants a different method either way, so this file
no longer tracks `AttendanceReport.gs` as the live path forward. The file
itself is left in `scripts/` but should not be pasted into Apps Script
going forward; the sections above are kept only as a record of what was
built and why, not as a to-do.)

## Daily attendance in Google Sheets — Whalesync, not Apps Script (6 Oct 2026)

**⚠ SUPERSEDED same day — Whalesync dropped, too expensive (Yash's own
words).** See "Self-serve data review" below for the final answer: Table
Editor + SQL views directly in Supabase, no sync tool at all. The
`daily_attendance_report` view this section built is still live and still
useful — just browsed directly, not synced anywhere.

**Decision from Yash, 6 Oct 2026**: no Apps Script, no Claude-orchestrated
automation tool (Make/Zapier) either — "you need connectors that supabase
can use and not you," i.e. a tool that connects directly to Supabase and
Google Sheets on its own, continuously, rather than Claude scripting a
daily batch job through a third-party automation platform.

**Chosen tool: Whalesync** (not a Supabase product, but a well-known
third-party continuous-sync tool many Supabase users pair with it for
exactly this — DB table/view → Google Sheet, kept live, no cron needed).

**What's ready on the Supabase side, done 6 Oct 2026**: Whalesync syncs
tables/views as-is — it cannot run custom SQL — but the daily attendance
report is a computed join (formatted check-in/out times, default hours
for a no-checkout day, department sort), not a raw table. So
`PATCH_74_daily_attendance_report_view_06Oct2026.sql` adds a Postgres
**view**, `public.daily_attendance_report`, with exactly that shape —
Date, Emp Code, Name, Department, Check In, Check Out, Working Hrs, Late
Mins, Overtime Hrs, one row per active employee per day (absent employees
get a blank row, never dropped, same "never silently drop people" rule as
the in-app dashboards) — so Whalesync has one clean source to point at.
Re-evaluates `now()` on every read, so "today" is always actually today in
IST, no stored/stale date. **Not granted to `anon`/`authenticated`** —
only readable via the `service_role` key, same key this project's other
admin-side integrations already use, never the app's own client queries.
Verified live: 99 rows on creation, matching the active headcount that day.

**Still Yash's own step, not done yet**: sign up at whalesync.com, connect
Supabase (needs the project's `service_role` key — pasted directly into
Whalesync's own connection form, never into this chat, same rule as every
other key in this file), connect the Google account that owns the "Forge
OS - Daily Attendance - 2026-10-06" sheet (OAuth, no key to paste), then
create a one-way sync: source = `daily_attendance_report` view → that
sheet's "Daily Attendance" tab. Whalesync keeps it continuously current
after that — no daily cron, no scenario to maintain, nothing further for
Claude to build unless Yash wants the Monthly Attendance Summary tab done
the same way (a second view, same pattern, not yet built — ask before
building it).

**Abandoned for this**: the Make.com scenario (scheduler → Postgres query
→ Google Sheets bulk-write) that was mid-build before Yash's "connectors
that supabase can use and not you" clarification — no Make credential
request was created, nothing to undo.

## Self-serve data review — Table Editor + SQL views, no Claude needed (6 Oct 2026)

**🔒 LOCKED decision from Yash, 6 Oct 2026.** Dropped Whalesync (cost) and
every other sync-tool idea above. Yash's own framing, direct quote: "who
is overtime, who is late can be answered by me to supabase than going
through you" — reviewing data must not depend on Claude, month after
month. Only **changing the app** (features, bugs, schema, screens) should
still need Claude — same as any running software needs a developer for
changes, not for being read.

**What this means in practice, and where the line actually is:**
- **Routine HR questions ("who's late," "who's on overtime," "who's short
  on hours," "show me September")** → Yash runs a query himself in
  Supabase's **SQL Editor** (dashboard → SQL Editor) or browses a **view**
  directly in **Table Editor** (dashboard → Table Editor → Views). No
  Claude round-trip needed for any of this, starting now.
- **A brand-new kind of question nothing already answers** (e.g. "who's
  never submitted a 5S form this month") → still needs Claude once, to
  build the view — after that, it's a standing, self-serve tool exactly
  like the two below, forever.
- **Changing the app itself** → always needs Claude. Not a dependency
  problem — that's what "the app has a developer" means for any software.

**Two views built so far, both already live, both already verified
against real data, both scoped to `service_role`/dashboard access only
(not exposed to `anon`/`authenticated`, so none of this touches the app's
own RLS-gated client queries):**

1. **`daily_attendance_report`** (`PATCH_74`, widened to 2 days by
   `PATCH_77`, 6 Oct 2026) — one row per active employee for *today and
   yesterday* (IST), re-evaluated on every read: Check In/Out (HH:MM),
   Working Hrs (with the no-checkout default already applied), Late
   Mins, Overtime Hrs. Built originally for the Whalesync/Sheet plan,
   still useful standalone. Two days, not just today, because Shift 3
   belongs to the previous working day and "today" alone would always
   be mid-flight — matches the original `AttendanceReport.gs` design.
2. **`monthly_attendance_summary`** (`PATCH_75`, 6 Oct 2026) — one row per
   employee per calendar month that has at least one attendance row:
   `days_present`, `days_absent`, `days_late`, `days_short_hours`,
   `avg_hours_worked`, `total_overtime_hours`, `total_late_minutes`. Uses
   the *exact same rules* the app's own Late Comers Review and dashboards
   use (`PRESENT_STATUSES`, the 8.5h floor, `overtime_hours`) so a number
   Yash gets from SQL Editor and a number the app shows can never
   disagree. Ready-to-run queries are in the patch file's own comments —
   copy-paste into SQL Editor, no editing needed beyond the month date:
   - Late this month: `select emp_code, name, department, days_late from monthly_attendance_summary where month = date_trunc('month', now())::date and days_late > 3 order by days_late desc;`
   - Overtime this month: swap `days_late > 3` for `total_overtime_hours > 0`, order by that column.
   - Short hours this month: swap for `days_short_hours > 3`.
   - Any past month: `where month = '2026-09-01'` (first of that month).
   Verified live 6 Oct 2026 against real October data before handing this
   over — top late-days results matched expectation (two employees at 5
   late days each, correctly above the >3 bar).

**Exporting a result**: both SQL Editor and Table Editor have a built-in
Export-to-CSV button on any result set — free, no setup, no connector.
Emailing a result to himself instead of downloading: Gmail is already
connected in this environment at no cost — ask Claude on-demand ("email
me this month's late list") or ask for a standing daily/weekly scheduled
email; neither needs a new signup or a paid tool.

## Owner has no KPI tab — decision from Yash, 28 Sep 2026

Redundant with `dashboard/index.html` (the plant HTML dashboard, which
pulls from the same Supabase data) once Yash confirmed he already uses that
link and doesn't need a second, in-app copy of the same KPIs. `app/(owner)/kpi.tsx`
deleted, its tab removed from `(owner)/_layout.tsx`. Note: this screen had
already been fixed earlier (real DB data, not the hardcoded version an
older note in this file wrongly still described) — removed for redundancy,
not because it was broken.

## Owner has no Forms tab — decision from Yash, 27 Sep 2026

"i dont use any forms as there is no approval beyond me . so i dont need to
see these forms and i anyways take care of all my expenses." `app/(owner)/forms.tsx`
deleted, its tab removed from `(owner)/_layout.tsx`. No other role's Forms
tab touched — this is owner-specific, since owner is the only role with
nothing above it in the approval chain.

**Bug found and fixed same session:** `late-review.tsx` (owner, plant_head,
hr_admin) and `(hr-admin)/approvals.tsx` were reachable via each role's
`more.tsx` link as intended, but none of their `_layout.tsx` files declared
them as `<Tabs.Screen ... options={{ href: null }} />` — expo-router auto-adds
any undeclared screen file in a Tabs group as its own visible tab, so all
three were silently showing up as an extra, icon-less tab at the end of the
bar (Yash: "i see a new tab in the end late comers review"). **Whenever a new
screen is added to a role group that already has a `_layout.tsx` Tabs list,
it MUST get an explicit `<Tabs.Screen>` entry — a real tab if it should be
one, `href: null` if it's more.tsx-only** — or it silently leaks into the tab
bar exactly like this.

---

## Working hours mapping (NOT salary) — decision from Yash, 27 Sep 2026

**Correction to an earlier note in this file (same day) — that entry
wrongly framed this as a salary-deduction formula request. It is not.**
Yash: "we are not building salary as per hrs right now. all i am asking for
is mapping... this is to understand if someone is working less hours."
Purely a visibility/flagging requirement — whether the expected hours were
met each day — not a payroll input.

**The numbers, exactly as given:**
- Shift 1/2/3 (rotating): ~8 hours nominal, includes a break.
- General: 9 hours nominal (09:00–18:00 — matches `shifts.start_time`/
  `end_time` for General exactly).
- **Minimum working hours, same floor for every shift type: 8.5 hours**
  ("8.30" = 8 hours 30 minutes, not decimal). Below this, flag as short.
- **Max sanity bound: 14 hours** — above this on `hours_worked`, treat as a
  likely data problem (forgotten checkout, clock issue), not a real
  16-hour shift, when it comes time to build the flagging logic.

**Already exists, not new:** `attendance_records.hours_worked` is computed
at check-out (`hooks/useAttendance.ts`, PATCH_38, 24 Sep 2026).

**Built same session — where to surface it: added to Late Comers Review
(Yash's choice over a new screen or raw-data-only).** `hooks/useLateComers.ts`
now computes a second qualifying set alongside the late-arrivals one — any
active employee with more than 3 days this month where `hours_worked < 8.5`
— reusing the same per-employee shift-grouping and the same ">3 times"
review bar (no separate count was specified, so this one is shared, not
independently tunable yet). `components/LateComersReview.tsx` renders it as
a second section, "Short Working Hours," alongside the existing "Late
Arrivals" one. The query is no longer status-filtered, since a short-hours
day can happen on a day the employee wasn't late for check-in at all.

**Not built yet, and not asked for by name:** the 14h max sanity bound (a
"likely data problem, not a real 16-hour shift" flag) — noted for later, not
part of this pass.

**No-checkout decision — Yash, 28 Sep 2026, implemented same day.** "IF THERE
IS NO CHECK OUT PERSON SHOULD BE CONSIDERED AS WORKED NORMAL SHIFT HRS.
8.5/9 HRS AS PER ROLE." A day where an employee checked in but never checked
out (`attendance_records.hours_worked` stays null forever — nothing ever
backfills it) counts as a **normal full day**, not short and not unknown —
General = 9h, every other shift (Shift 1/2/3, Security Day/Night — only two
numbers were given, not a per-shift figure) = the same 8.5h floor.
`lib/workingHours.ts` centralizes this (`MIN_WORKING_HOURS`,
`defaultHoursForShift()`, `effectiveHoursWorked()`) so anything built later
that needs a real number for a no-checkout day — a monthly total-hours
report, `run-payroll` if hours ever feed it — uses the same rule instead of
re-deriving it (or worse, treating null as 0). The raw `hours_worked` column
is deliberately left null, not backfilled — this is a read-time convention,
not a data correction. Late Comers Review's Short Working Hours section
already excluded null-`hours_worked` rows before this decision (an accident
of the `typeof === 'number'` check, not an intentional design), so its
behavior is unchanged; the code comment there now makes that exclusion
explicit and correct rather than incidental.

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
| `PATCH_19_dept_expansion_13Aug2026.sql` | Maintenance (4 daily forms: check sheet + 2 electricity + oil), Human Resource (2 manpower forms, As & When Required), VMC Shop (1 daily form) — all real published forms, verified against the live registry sheet via Drive before writing, not guessed | ✅ Applied 23 Aug |
| `PATCH_20_missing_crons_13Aug2026.sql` | Schedules `nightly-scoring`, `mrm-reminder`, `five-s-challenge-generator` and shift-reminder's default (no-body) mode — found via re-audit 13 Aug that none of the four had a `cron.schedule()` anywhere in this repo, the same "deployed but never invoked" pattern already found 3 times this session. All four confirmed idempotent before scheduling. Also now adds a fifth job, `mrm-reminder-escalation`, pinned to the 10th at 17:00 IST only — found during the mrm-reminder/shift-reminder audit that the single 09:00 daily run could never observe the code's own "10th at/after 17:00" escalation condition (09:00 is always before 17:00), so escalation was silently a day later than documented; see PENDING.md. ⚠ Check Dashboard → Cron first in case one was configured there instead | ✅ Applied 23 Aug |
| `PATCH_21_plant_locations_13Aug2026.sql` | Creates `plant_locations` (multi-point geofence table), 0 rows. Safe to run any time — check-in behaviour is unchanged until PATCH_22 also runs | ✅ Applied 23 Aug |
| `PATCH_22_plant_locations_seed_13Aug2026.sql` | Seeds 12 campus locations (11 from Yash's sheet + "Store") with real coordinates, received 13 Aug | ✅ Applied 23 Aug |
| `COMBINED_DEPLOY_21to22_13Aug2026.sql` | PATCH_21 + PATCH_22 concatenated (generated, cannot drift) — run this one file | ✅ Applied 23 Aug |
| `PATCH_52_resolve_false_mock_location_alerts_27Sep2026.sql` | Resolves VFL4057's 10 stale false-positive `mock_location` fraud_alerts, root-caused to a code bug (see "What Claude must NEVER do" / PENDING.md) and fixed the same session | ✅ Applied 27 Sep 2026 |
| `PATCH_53_staged_leave_advance_approvals_27Sep2026.sql` | Staged multi-role approval chains for `leave_requests`/`advance_requests` — schema, triggers, `my_turn_*`/`review_*` RPCs, audit table. See "Leave & Advance approval chains" section above | ✅ Applied 27 Sep 2026 |
| `PATCH_54_payroll_schema_extension_28Sep2026.sql` | Adds line-item columns to `payroll_records` (employer_pf/esi, bonus, gratuity, allowances) matching the real salary sheets. See "Real payroll data on file" section above | ✅ Applied 28 Sep 2026 |
| `PATCH_55_new_employees_from_salary_sheets_28Sep2026.sql` | Adds CON22, CON23 (re-hires), VFL5455, VFL5456 — found only in the salary sheets, not yet in `employees` | ✅ Applied 28 Sep 2026 |
| `PATCH_56_payroll_import_apr_aug_2026_28Sep2026.sql` | Full Apr-Aug 2026 payroll import for all 3 categories (536 rows), assembled from Python-generated SQL batches | ✅ Applied 28 Sep 2026 |
| `PATCH_57_gps_radius_25m_28Sep2026.sql` | Raises `plant_locations.radius_meters` from 15m to 25m on all 12 real campus points — 15m (set 27 Sep) was rejecting legitimate check-ins | ✅ Applied 28 Sep 2026 |
| `PATCH_58_vfl1391_shift3_fix_28Sep2026.sql` | VFL1391's 00:05 check-in filed as Shift 3 of 27 Sep (Yash's rule), 28 Sep shift back to General | ✅ Applied 28 Sep 2026 |
| `PATCH_59_set_my_shift_rpc_28Sep2026.sql` | `set_my_shift_for_date()` — SECURITY DEFINER, own row only, today/yesterday only. `employee_shifts` writes are management-only, so the 27 Sep shift-inference insert had been failing silently for every regular employee (39 check-ins with no shift, lateness never evaluated) | ✅ Applied 28 Sep 2026 |
| `PATCH_60_vfl1319_deactivate_28Sep2026.sql` | Deactivates VFL1319 (Dipak Balkrishna Patil, Accounts) — confirmed left by Yash | ✅ Applied 28 Sep 2026 |
| `PATCH_61_deactivate_4_left_28Sep2026.sql` | Deactivates CON22, CON23, VFL5354, VFL4048 — confirmed left by Yash | ✅ Applied 28 Sep 2026 |
| `PATCH_62_shift_allocator_28Sep2026.sql` | New `employees.shift_allocator_id` column; populates it for 73 employees across 8 department groups from Yash's `Shift_Planning_1.csv`; adds CON24 (Shriram Pawar, Maintenance — new); fixes CON12's role `member`→`manager`; adds `allocate_team_shift_week()` RPC | ✅ Applied 28 Sep 2026 — verified: 73 allocated (group sizes sum exactly), RPC tested positive+negative via disposable SQL |
| `PATCH_63_shift5_ot_29Sep2026.sql` | New `shifts` row: Shift 5 (19:00-07:00, 12h) — the night OT variant of Shift 3, coexists with it, chosen week-by-week. See "Shift 4 & Shift 5" section below | ✅ Applied 29 Sep 2026 |
| `PATCH_64_shift4_day_ot_29Sep2026.sql` | New `shifts` row: Shift 4 (07:00-19:00, 12h) — the day OT variant of Shift 1. Required a real tie-handling bug fix in `lib/shiftInference.ts` first (Shift 4 ties Shift 1's start_time) — see "Shift 4 & Shift 5" section below | ✅ Applied 29 Sep 2026 |
| `PATCH_65_admin_hr_attendance_forms_30Sep2026.sql` | 4 `form_links` rows for Google Forms Yash provided: Administration dept (Kajal, Monthly + Daily Attendance) and Human Resource dept (existing HR team, Monthly + Daily Attendance) | ✅ Applied 30 Sep 2026 |
| `PATCH_66_plant_head_monthly_form_30Sep2026.sql` | New `form_links` row (MANAGEMENT dept) for Fazal's monthly form (due 5th) + pg_cron schedule for the new `plant-head-form-reminder` edge function. See "Plant Head monthly form reminder" section below | form_links row ✅ Applied 30 Sep 2026 (via MCP) — **cron.schedule() step still ⏳, needs Yash to paste a real key in the SQL editor** |
| `PATCH_67_con24_pin_fix_30Sep2026.sql` | Restores CON24's (Shriram Pawar) password to the documented consultant-formula starting PIN (`200024`), after `HR_reset_pin.sql` had silently overwritten it with the wrong (VFL-style) formula on 30 Sep. See "Employee data" below | ✅ Applied 30 Sep 2026 — verified matches `200024` |
| `PATCH_68_cron_keys_01Oct2026.sql` | Replaces the placeholder Authorization header on the 6 cron jobs that still had it (see "Cron jobs never had real keys" below) | ✅ Applied 1 Oct 2026 — verified all 7 cron jobs have a real key, none on the placeholder |
| `PATCH_69_con24_pin_refix_06Oct2026.sql` | CON24's PIN broke a second time (reset to `000024` again on 4 Oct) — restored to `200024` again. Root cause of the repeat still open | ✅ Applied 6 Oct 2026 |
| `PATCH_70_gps_radius_45m_06Oct2026.sql` | Raises `plant_locations.radius_meters` 25m → 45m on all 12 real campus points (third change to this value — 15m, then 25m, now 45m) | ✅ Applied 6 Oct 2026 |
| `PATCH_71_kajal_pune_schedule_06Oct2026.sql` | New `employees.default_shift_id`/`weekly_off_day` columns + "General (Pune)" shift (10:00–19:00) + Kajal (VFL1567) set to both. See "12-point request, 6 Oct 2026" below | ✅ Applied 6 Oct 2026 |
| `PATCH_72_overtime_hours_and_auto_checkout_06Oct2026.sql` | New `attendance_records.overtime_hours` column + hourly cron for the new `auto-checkout` edge function. See "12-point request, 6 Oct 2026" below | ✅ Applied 6 Oct 2026 |
| `PATCH_73_fix_reset_employee_pin_con_formula_06Oct2026.sql` | Fixes the real CON24 root cause — `reset_employee_pin()` RPC (HR's own self-service tool, `missing-data.tsx`) only ever implemented the VFL-style PIN formula; added the missing CON-prefix branch | ✅ Applied 6 Oct 2026 |
| `PATCH_74_daily_attendance_report_view_06Oct2026.sql` | Read-only `daily_attendance_report` view (today + yesterday, PATCH_77 widened it from today-only) for self-serve Table Editor/SQL Editor review — see "Self-serve data review" below | ✅ Applied 6 Oct 2026 |
| `PATCH_75_monthly_attendance_summary_view_06Oct2026.sql` | Read-only `monthly_attendance_summary` view — late/overtime/short-hours per employee per month, same rules the app uses, for self-serve review without Claude | ✅ Applied 6 Oct 2026 |
| `PATCH_76_fraud_alert_resolution_and_dedup_06Oct2026.sql` | Adds `resolve_fraud_alert()` RPC (Confirmed/False Positive/Investigate) + occurrence-count dedup to `fraud_alerts` — collapsed 39 inflated rows to 4 real incidents. See "Fraud alerts" below | ✅ Applied 6 Oct 2026 |
| `PATCH_77_daily_attendance_report_two_day_06Oct2026.sql` | Widens `daily_attendance_report` (PATCH_74) from today-only to today+yesterday, matching the originally-agreed design | ✅ Applied 6 Oct 2026 |
| `HR_reset_pin.sql` | HR utility: reset one employee to their starting PIN and re-arm the forced change. Needed after testing a role by logging in as that employee. **Fixed 30 Sep 2026** — see "Employee data" below for the CON-prefix bug this had | ♾️ On demand |

**Total employees confirmed live: 129 as of 23 Aug 2026 — STALE, do not quote this number.** Headcount moves constantly (departures, rejoins, new hires, pending approvals) and this file is not re-synced automatically. **Always run `SELECT count(*) FILTER (WHERE is_active) AS active, count(*) AS total FROM employees;` before stating a headcount** — never state 129, or any other number written here, from memory. As of 27 Sep 2026 the real figures were 98 active / 142 total rows ever created; by the time anyone reads this they will be different again — that is the point of this note.

---

## App screen map (56 screens, 7 role groups — 27 Sep 2026: +1 (hr-admin)/approvals.tsx, +3 late-review.tsx across owner/plant-head/hr-admin; 28 Sep 2026: +1 shifts.tsx each in (manager)/(supervisor), reached via More, not a bottom tab — see "Shift allocation tabs" below)

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
│   ├── approvals.tsx      — static "moved" message (PATCH_53 — supervisors removed from leave/advance chains)
│   ├── forms.tsx          — Google Forms for this department (PATCH_14)
│   ├── shift-report.tsx   — submit shift production data
│   ├── casual-workers.tsx — log casual worker counts
│   ├── 5s-verify.tsx      — approve/reject 5S submissions
│   ├── shifts.tsx         — shift allocation, scoped to shift_allocator_id (PATCH_62, 28 Sep 2026 — empty-team state if not set as anyone's allocator)
│   └── more.tsx
├── (manager)/
│   ├── dashboard.tsx      — department attendance %
│   ├── team.tsx           — list supervisors under this manager
│   ├── approvals.tsx      — leave/advance requests at this manager's stage (PATCH_53 my_turn_*/review_*), + Accounts-stage items for the Accounts dept's own manager
│   ├── forms.tsx          — Google Forms for this department (PATCH_14)
│   ├── mrm.tsx            — submit MRM review
│   ├── reports.tsx        — department-scoped reports
│   ├── shifts.tsx         — shift allocation, scoped to shift_allocator_id (PATCH_62, 28 Sep 2026 — empty-team state if not set as anyone's allocator)
│   └── more.tsx
├── (hr-admin)/
│   ├── dashboard.tsx      — stats: total, present, pending advances/leaves
│   ├── approvals.tsx      — leave/advance requests at HR's stage (PATCH_53, new screen — HR had none before)
│   ├── new-employee-flow.tsx — show pending activations
│   ├── advance-ledger.tsx — all advances with outstanding balance
│   ├── shifts.tsx         — shift assignment (master + per-employee)
│   ├── missing-data.tsx   — employees missing phone/dept/supervisor
│   ├── late-review.tsx    — chronic latecomers (>3x/month), grouped by shift (27 Sep 2026)
│   └── more.tsx
├── (plant-head)/
│   ├── dashboard.tsx      — plant-wide attendance + low-attendance alert
│   ├── approvals.tsx      — salary/new-hire sign-off + leave/advance at plant_head's stage (PATCH_53)
│   ├── mrm.tsx            — view MRM submission status per dept
│   ├── email.tsx          — priority email task inbox
│   ├── late-review.tsx    — chronic latecomers (>3x/month), grouped by shift (27 Sep 2026)
│   └── more.tsx
├── (owner)/
│   ├── dashboard.tsx      — top-level KPIs
│   ├── approvals.tsx      — final salary/new-hire sign-off + leave/advance at owner's stage (PATCH_53)
│   ├── alerts.tsx         — open fraud alerts
│   ├── eotm.tsx           — Employee of the Month per category
│   ├── late-review.tsx    — chronic latecomers (>3x/month), grouped by shift (27 Sep 2026)
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
- **Token/chat-id — same inline-or-Script-Properties pattern as Supabase.**
  `TELEGRAM_BOT_TOKEN_INLINE` and `OWNER_TELEGRAM_CHAT_ID_INLINE` at the top
  of `scripts/ALERT.gs`, both blank in git for the same reason
  `SUPABASE_SERVICE_ROLE_KEY_INLINE` is — a live secret committed once is in
  the repository's history permanently. Script Properties win if set there
  instead. Paste the token (and, optionally, your numeric chat id — not a
  secret, just an account identifier) into the live copy only.
- **"Too many triggers" — this script shares its Apps Script PROJECT with
  the Operations Dashboard's own pull/alert script (referred to here as
  "Code.gs", though no file by that name is tracked in this git repo — its
  source lives only in the live Apps Script project).** Historical note,
  now corrected: an earlier version of this section claimed Code.gs ran 11
  triggers (`6 runDashboardPull + 4 checkShiftEnd_* + 1 refreshCache15min`)
  — **that was stale and wrong**, confirmed 28 Sep 2026 by actually listing
  the live triggers rather than trusting the old note (see the locked
  "verify against live data" rule). Fixed by using fewer triggers rather
  than touching Code.gs's: every alert function already no-ops when there
  is nothing to do right now, so `deployShiftTrackingTriggers()` creates
  exactly 2 — `runShiftAlerts15min_()` and `runDailyMaintenance_()` — each
  a thin, try/catch-wrapped dispatcher over the individual functions that
  used to have their own trigger.
- **Needs `deployShiftTrackingTriggers()` re-run to pick up the 2-trigger
  layout** (it deletes the old per-function triggers first).
- **Real live census, 28 Sep 2026 (via `listAllTriggers_()` in
  `AttendanceReport.gs`) — project was pinned at the 20-trigger ceiling.**
  Actual breakdown: `runCacheBuilder` ×6, `runAnalyticsDaily` ×6,
  `syncVMCToDashboard` ×1, `runDashboardPull` ×1, `backupCacheDaily` ×1,
  `checkHealthAndAlert` ×1 (defined in `ALERT.gs`, delete-then-create
  installer, correctly 1x), `processFormSubmissions` ×1 (also `ALERT.gs`,
  also duplication-safe), plus this project's own
  `runAttendanceReportHourlyGate_`/`runShiftAlerts15min_`/
  `runDailyMaintenance_` (1x each, correct). **None of
  `runCacheBuilder`/`runAnalyticsDaily`/`syncVMCToDashboard`/
  `runDashboardPull`/`backupCacheDaily` are defined anywhere in this git
  repo** — confirmed by search, not assumed — so whatever installs
  `runCacheBuilder`/`runAnalyticsDaily` in the live (untracked) Operations
  Dashboard script almost certainly calls `ScriptApp.newTrigger(...).create()`
  on every manual re-run without deleting old copies first (the same bug
  class as `deployShiftTrackingTriggers()` used to have, just in a file
  this repo can't fix directly).
- **Fix: `dedupeClockTriggers_(execute)` in `AttendanceReport.gs`** —
  works generically off `ScriptApp.getProjectTriggers()`, not tied to any
  one script's source, so it can clean this up without needing Code.gs's
  code. Dry-run by default (`dedupeClockTriggers_()`, no args, just logs
  what it would remove); `dedupeClockTriggers_(true)` actually deletes,
  keeping exactly one trigger per handler. Only touches `CLOCK`-type
  triggers, never `processFormSubmissions`' `onFormSubmit` trigger. **If
  the trigger count balloons again, this is the tool to re-run** — the
  underlying untracked installer isn't fixed, only mitigated after the
  fact, so this can recur if that script is ever manually re-run again.

## Edge functions (6, all Deno)

| Function | Purpose | Cron |
|---|---|---|
| `nightly-scoring` | Composite monthly score for all members/supervisors/managers | Nightly 22:00 IST |
| `fraud-detector` | GPS + bulk-confirmation fraud checks | Called by app on check-in only (13 Aug — was deployed but never invoked by anything before that; see PENDING.md). Bulk-confirmation is still handled entirely client-side in `supervisor/team.tsx`, not via this function |
| `mrm-reminder` | Ensure MRM rows exist; remind managers 8th-10th; escalate to plant_head (escalation is now de-duplicated against `notifications` — 13 Aug, see PENDING.md) | Daily 09:00 IST + a second run pinned to the 10th at 17:00 IST (PATCH_20's `mrm-reminder-escalation` job), so the code's own "10th at/after 17:00" escalation condition has an invocation that can actually observe it |
| `shift-reminder` | Weekly shift notify (Thursday) + daily check-in reminder (hourly) + `forms_due_reminder`, which nudges a department's supervisors/managers 15 min before each shift's form deadline | Thursday + hourly + every 15 min (`{"mode":"forms_due_reminder"}`, needs its own cron entry — mode inference never picks it) |
| `five-s-challenge-generator` | Generate daily 5S challenge via Gemini | Daily |
| `send-push-notification` | HTTP dispatcher — write notification row + push (FCM v1 direct for Android, Expo relay for anything else — see `_shared/fcm.ts` and `_shared/push.ts`) | On-demand |
| `plant-head-form-reminder` | New 30 Sep 2026. Notifies every active plant_head (today: just Fazal) on the 1st-5th IST of each month for any `form_links` row with `department='MANAGEMENT'` and `send_in_reminder=true` still outstanding. De-duplicated against `notifications` per form per day. See "Plant Head monthly form reminder" below | Daily 09:00 IST (PATCH_66's cron job) — ✅ live, Yash ran the cron.schedule() 1 Oct 2026 |
| `auto-checkout` | New 6 Oct 2026. Finds any `attendance_records` row still checked in with no checkout 24h+ after `check_in_time`, fills `check_out_time`/`hours_worked` per the existing no-checkout convention, then runs the same shift-finalization + overtime logic a manual checkout uses. See "12-point request, 6 Oct 2026" below | Hourly (PATCH_72's cron job) — ✅ live |

**Shared helpers** (`supabase/functions/_shared/`):
- `push.ts` — `notifyEmployees()` inserts `notifications` rows (`user_id` column) + Expo push batch. ⚠ It also writes `related_entity_type` / `related_entity_id`, which existed only in the OLD schema until PATCH_14 added them — before that every insert was rejected by PostgREST and the error was discarded, so no server-side notification ever reached anyone. It now throws on insert failure.
- `supabaseAdmin.ts` — service-role client + `getPlantConfig()`
- `geo.ts` — Haversine distance in metres
- `cors.ts` — CORS headers + `jsonResponse()`

---

## RLS — all known holes closed (PATCH_12, confirmed 11 Aug)

This section used to list 6 open holes. **Stale — found while re-auditing
13 Aug.** All 6 were closed by `PATCH_12_rls_hardening_11Aug2026.sql`, which
has been applied and confirmed by Yash since 11 Aug (see the patches table
above). Keeping the record of what was fixed, since it explains why several
policies look stricter than a first read of FINAL_SCHEMA suggests:

1. `employees` INSERT — was `is_management() OR auth.role() = 'authenticated'`
   (the second branch made it trivially true for any signed-in user); now
   `is_management()` only.
2. `notifications` INSERT — was `with check (true)`; now `is_management()`
   only, plus a UPDATE policy scoped to `user_id = current_employee_id()` so
   the bell can be cleared.
3. `fraud_alerts` / `fraud_flags` INSERT — were unscoped for any authenticated
   user; now scoped to the reporting employee.
4. `attendance_records` write — now scoped to a supervisor's own team.
5. `leave_requests` UPDATE — now scoped to a supervisor's own team.
6. `mrm_reviews` SELECT — was readable by every authenticated user; now
   manager-and-above only.

No DELETE policies on any table remains intentional — audit trail.

---

## Screen-level issues — none open (found stale while re-auditing 13 Aug)

Every row this table used to list is fixed. Kept as a record, not a to-do:

| Screen | Was | Status |
|---|---|---|
| `worker/home.tsx` | `Constants.deviceId` doesn't exist in Expo SDK 51 — buddy-device fraud check compared a fresh `sessionId` every launch, could never match | ✅ Fixed 12 Aug — `lib/deviceId.ts`, persisted per install |
| `worker/5s.tsx` | Camera `takePhoto()` wrote a hardcoded placeholder URL | ✅ Wired to `PhotoCapture` — verified in code, not just claimed |
| `worker/observation.tsx` | Camera not wired | ✅ Same `PhotoCapture` component wired in |
| `supervisor/casual-workers.tsx` | Upsert conflict key `supervisor_id,date` — unverified against schema | ✅ Verified 13 Aug — matches `unique (supervisor_id, date)` in FINAL_SCHEMA exactly |
| All screens | No auth guard in individual route layouts | ✅ Fixed 13 Aug — `components/RoleGate.tsx` on all seven groups |

---

## Leave & Advance approval chains — frozen 27 Sep 2026, decisions from Yash

**Implemented 27 Sep 2026, same session as the design freeze** —
`PATCH_53_staged_leave_advance_approvals_27Sep2026.sql` (schema + triggers +
`compute_approval_chain()`/`my_turn_*()`/`review_*()` RPCs + `request_stage_actions`
audit table) plus every approval screen rewritten onto it
(`hooks/useLeaveAdvanceApprovals.ts` + `components/LeaveAdvanceApprovalCards.tsx`,
shared across `(manager)`, `(plant-head)`, `(owner)`, and a brand-new
`(hr-admin)/approvals.tsx`; `(supervisor)/approvals.tsx` now shows a static
"moved" message since supervisors are out of both chains). See PENDING.md for
the full verification record. Design notes below are kept as the reference for
what the chains mean and why, not as a to-do.

**Two-step transition UX — built 27 Sep 2026, same session.**
`components/TwoStepFormModal.tsx` + `FormsScreen.tsx` special-casing "Leave
Application"/"Advance Application" by name: tapping "Apply" in-app first
captures the same fields the process needs (feeding the new staged chain
above), shows a "Step 1 complete" confirmation, then opens the existing Google
Form for step 2. The in-app approval workflow and the Google Form process run
independently — this doesn't replace the Google Form, it runs alongside it
until the in-app flow is proven with no bugs. Built for Leave + Advance;
whether to extend this to other common forms (Gate Pass, Cash Expenses,
Hospital Form) is still open — ask before building those.

**Frozen chains, by requester's own role/category:**

| Requester | Leave chain | Advance chain |
|---|---|---|
| member / supervisor / security_guard | Manager → HR → Plant Head | Manager → HR → Accounts → Plant Head → Owner |
| HR (Pallavi, hr_admin) — her own request | Plant Head only | Accounts → Plant Head → Owner |
| manager — their own request | HR → Plant Head | HR → Accounts → Plant Head → Owner |
| plant_head (Fazal) — his own request | Owner only | Owner only |
| owner (Yash) — his own request | No approval gate — auto-recorded | No approval gate — auto-recorded |
| Bharat Salve (Accounts manager, VFL5462) — his own advance | — (leave follows the manager row above) | Skips the Accounts stage (he *is* Accounts) → HR → Plant Head → Owner |

**Accounts stage mechanism — decided 27 Sep 2026:** dynamic role+department
match — anyone with `role='manager' AND department='Accounts'` can act at the
Accounts stage, not a hardcoded emp_code. Today that resolves to Bharat Salve
(VFL5462), but the Accounts-stage review RPC must query on role+department,
never on his specific `employee_id`, so it keeps working unchanged if he goes
on leave, changes role, or is replaced.

Yash's exact words locking this in: "we can remove the supervisor approval and
keep it manager HR accounts planted in me for advance. for leave it can stick
to manager HR plant head." Neither chain has a supervisor stage — advance is
Manager → HR → Accounts → Plant Head → Owner, leave is Manager → HR → Plant
Head, exactly as given, for the rank-and-file row above.

---

## Real payroll data on file — Apr-Aug 2026, FY2026-27 (28 Sep 2026)

**Yash's instruction:** store the 3 salary sheets he uploaded (Consultant,
Worker, Employee/Staff) tab-by-tab so this is never asked for again, and
build Payslips only from April 2026 onward for this financial year (the
sheets carry good history back to 2022-2024, deliberately not imported —
out of scope for FY2026-27 payslips).

**Done, PATCH_54/55/56:**
- `payroll_records` gained the line-item columns the real sheets carry that
  it had no column for — employer_pf/employer_esi/bonus/gratuity/
  leave_encashment (Worker+Staff), education/medical/professional_development/
  communication/uniform/washing (Staff allowances), heat_allowance/vda/
  production_allowance (Worker allowances), week_off. Decision from Yash:
  store every line item exactly as given, not folded into generic columns.
- All Apr-Aug 2026 rows imported from the 3 sheets — 536 rows total (Staff
  79/76/77/76/75, Worker 26/24/24/20/19, Consultant 9/9/11/11/— no Aug tab
  yet for consultants). Column mapping was derived by aligning each sheet's
  own header rows programmatically, then cross-checked against the 55
  pre-existing `payroll_records` draft rows from an earlier `run-payroll`
  backtest (e.g. VFL1064 Aug net_pay = ₹28,400 in both) before trusting it —
  the backtest was accurate, just an incomplete subset (0 consultants, ~39
  staff missing), so this import upserts on top of it (never duplicates)
  and marks every row `final`.
- **4 employees found only in the sheets, not in Forge OS at all — added
  (PATCH_55), not guessed:**
  - **CON22 / CON23** are re-hires of two already-known inactive workers:
    CON22 = Digambar Mahadeo Todekar (same person as **VFL4004**), CON23 =
    Suresh Sopan Gawali (same person as **VFL4030**), both rejoining as
    consultants from mid-June 2026 — same pattern as the documented
    VFL5337→VFL5463 rejoin. Both provisioned real login access (starting PIN
    = emp_code digits padded to 6, same as every other active employee).
  - **VFL5455 (Anil Dadarao Awchar, Maintenance Sr. Engineer)** and
    **VFL5456 (Yograj Vishwanath Dharmik, Maintenance Fitter)** were
    actually paid Apr-Jun 2026 / Apr 2026 per the sheets, but had never been
    onboarded into Forge OS under any code — a real gap on this app's side,
    not something Yash had told Claude before. Added as `is_active=false`
    (matches their current Non-Active status in the sheet's own Master
    Data), no login provisioned since they've since left.
- Consultants have no `employee_salary_structure` row (that table is the
  Worker/Staff fixed-rate breakup only — consultants are a flat monthly fee
  per their Master Data's single 'Gross P.M.' column) and their one earnings
  figure per month is stored in `payroll_records.basic` for lack of a
  better-fitting column — unambiguous on read since `employees.category`
  says 'consultant'.
- One documented judgment call: the Consultant sheet's undifferentiated
  'Leave' column (Worker/Staff split EL/CL/SL/PH, Consultant doesn't) is
  stored in `el` as the closest-fit generic count — rare, small values (1-2
  days, 2 people, across all 4 months), noted here rather than silently
  dropped.

**Still needed from Yash, not yet built:** September 2026 payroll (he said
it "is still to be generated" — wait for that sheet/update separately, same
process). The Payslips screen itself (More tab → monthly list) is the next
build step, not done yet as of this note.

---

## Update banner — real regression, root-caused and fixed (28 Sep 2026)

**`components/UpdateBanner.tsx` is a real, already-built feature** (mounted
in `app/_layout.tsx`, above the `<Stack>` navigator) — an earlier note in
this file wrongly told Yash no such banner existed; that was incomplete
memory, not a fact, and it should not have been stated without checking the
code first.

**Real bug, introduced by an earlier fix in this same file's history:** the
27 Sep fix for the More-tab "Download Latest App" row's staleness (mount-once
`useEffect` never re-checking) switched the shared `hooks/useAppVersion.ts`
to `useFocusEffect`. That is correct for a component that is itself a screen
inside the navigator (the More-tab row), but `UpdateBanner` is deliberately
mounted *outside* the Stack (so an admin can never navigate away from it) —
it is never a "screen" and never receives expo-router focus/blur events, so
`useFocusEffect` silently never ran its check there at all. Yash's exact
report matches this precisely: the banner had worked fine before that fix
and stopped right after.

**Fixed:** `useAppVersion.ts` now uses a plain `useEffect` (runs once on
mount, for every consumer) plus an `AppState` listener that re-runs the
check whenever the app returns to the foreground (`'active'`) — this covers
both consumers correctly regardless of whether they sit inside a navigator
screen or not, and is the actual right fix for "a phone kept backgrounded
should notice a new build on reopen," which `useFocusEffect` only partially
achieved.

---

## Fraud alerts — 39 open, investigated 28 Sep 2026

All 39 open `fraud_alerts` rows are `type='mock_location'`, `severity='high'`,
and concentrated in just 3 employees, not spread across the workforce:
**VFL5442** (Darshan Anil Alhat, 20 alerts in a 10-minute window),
**VFL4036** (Bhagwan Revji Walunj, 14 alerts over ~12 hours), **VFL5446**
(Mayuri Sardar Rathod, 5 alerts in 37 minutes) — all 26-27 Sep 2026.

Basis for the flag: `fraud-detector`'s `gps_check` trusts whatever the app
sends as `mockLocationDetected`, which the app sets from Android's own
`location.mocked === true` signal — when it fires, check-in is rejected
outright (same as outside-geofence). The current client code already has
the `location.mocked` fix (not the old, wrong `Location.getProviderStatusAsync()`
check) verified in both `CheckInCard.tsx` and `worker/home.tsx`, so this is
not the same bug class as VFL4057's (PATCH_52). Whether these 3 are a real
spoofing app or a device/OS quirk (some Android OEMs flag `mocked:true`
spuriously) is not answerable from data alone — **needs the same
one-screenshot check as VFL4057: what does their check-in screen actually
say when it fails.** Not yet resolved as of this note.

**Fixed 6 Oct 2026 — resolution finally exists, and the 39-row count was
itself a bug.** Yash: "you have not given me option to resolve or
escalate the alert. so what is it for? ... if the alert is of same person
it needs to be clubbed as one alert rather than different ones bringing
the count high." Both true — confirmed by re-reading `alerts.tsx`: it was
(and had always been) 100% read-only, no action of any kind; the only
resolution ever done was PATCH_52's one-off raw SQL `UPDATE`, never
through the app, because `fraud_alerts` had no UPDATE RLS policy at all.
And the "39 open alerts" figure was itself an artifact — `gps_check`
inserted a brand-new row on every single flagged check-in with zero
dedup, so one flaky device retriggering 20 times in 10 minutes counted as
20 alerts, not one incident.

**`PATCH_76_fraud_alert_resolution_and_dedup_06Oct2026.sql`** fixes both:
- `fraud_alerts` gains `occurrence_count`/`last_occurred_at` (incremented
  on a same-employee/same-type/same-IST-day repeat instead of a new row —
  `logFraudAlert()` in `supabase/functions/fraud-detector/index.ts` does
  the increment-or-insert; a partial unique index,
  `fraud_alerts_open_daily_dedup`, is a safety net if that logic is ever
  bypassed) and `resolution`/`resolution_note`/`resolved_by`/`resolved_at`.
  One-time cleanup collapsed the historical 39 rows to 4 (VFL5442: 20,
  VFL4036: 13 on 26 Sep + 1 on 27 Sep — correctly kept as 2 rows since
  they're different IST days, VFL5446: 5) — same 3 employees, same
  underlying incidents, just not inflated into 39 rows.
- **`resolve_fraud_alert(p_id, p_resolution, p_note)`** — `SECURITY
  DEFINER`, owner-only (matches where `alerts.tsx` has always lived).
  Three resolutions, exactly the "what decision is needed from me"
  answer: **Confirmed** (real issue → `status='resolved'`, closed out as
  a genuine incident), **False Positive** (device/OS quirk, not fraud →
  `status='resolved'`), **Investigate** (not sure yet → stays
  `status='investigating'`, visible on `alerts.tsx` with a different
  badge next time the read query is widened past `status='open'` — not
  done this pass, `alerts.tsx` still filters to `open` only). No new
  UPDATE RLS policy — RPC-only, same pattern this project already uses
  for leave/advance review and salary-change approval.
- `app/(owner)/alerts.tsx` now shows an "Nx today" badge when
  `occurrence_count > 1` and three per-alert buttons (Confirmed / False
  Positive / Investigate), each opening a shared note modal, calling the
  RPC, refetching after. Push notifications to plant_head/owner also now
  fire only on the first occurrence of a given day, not once per retry —
  the same spam this fix addresses was also paging management repeatedly
  for one incident.
- Edge function redeployed (version 13) via `mcp__Supabase__deploy_edge_function`.
- Verified: `npx tsc --noEmit` still exactly 7 (pre-existing baseline),
  `node scripts/check-i18n.mjs` clean, live row count confirmed 39→4.
- **Not done this pass, deliberately out of scope:** `fraud_flags` (the
  separate buddy-device-check table) still has no resolution path either
  — not raised by Yash, not touched.

**A broader "Needs Your Call" design exists but was NOT built this
pass** — a second, wider feature (same session) for `employee_shifts`
rows the system guessed on (inferred/reclassified, not HR-allocated),
with a third resolution option ("flag this logic for Claude to review")
meant to feed Claude's periodic review of `lib/shiftInference.ts`/
`lib/workingHours.ts`. Fully designed (schema, RPCs, UI, i18n, open
decisions) but not implemented — build only if Yash asks for it
specifically; the fraud-alert fix above was the narrower, immediately-
asked-for piece.

---

## Shift allocation tabs for department allocators — built 28 Sep 2026

Yash uploaded `Shift_Planning_1.csv`, a real weekly shift-planning roster: 8
department groups, each with one named **allocator** who sets Shift
1st/2nd/3rd/General for everyone in that group every Thursday, week starting
Saturday. Previously only HR (`app/(hr-admin)/shifts.tsx`) had a
shift-assignment screen, and it sees the *entire* company, unscoped. This
gives the other 7 named allocators their own screen, scoped to just their
own people.

**Decisions from Yash:**
1. **Shift-allocation authority is a separate relationship from
   `supervisor_id`, not a replacement for it.** Checked live data first:
   Maintenance's `supervisor_id` already correctly points to a different
   person (attendance confirmation) than the CSV's allocator (Shaikh
   Majeed) — same pattern in the HR group. Two different jobs, two
   different people, in several departments. `supervisor_id` stays
   untouched; shift-allocation gets its own new column.
2. **CON12 (Sadashiv Soddy) — role fixed to `manager`.** He's the Quality
   group's allocator per the CSV but had `role='member'`. Root-caused to
   `PATCH_35_consultants_25Sep2026.sql`, which bulk-inserted all 9
   consultants with a blanket `'member'` role and its own comment noting a
   dedicated role was "scoped for a future session" — not a deliberate call
   about CON12 specifically. Yash, once told the ripple effect (pulls him
   into the manager leave/advance approval chain and `(manager)/team.tsx`/
   `mrm.tsx`): **"Fix role to manager now."**
3. **CON24 (Shriram Pawar, Maintenance) — added**, exactly what the CSV
   gives (no phone/salary in the sheet, so those stay null/0, matching how
   `PATCH_35` seeded the other consultants).

**Implemented same session, `PATCH_62_shift_allocator_28Sep2026.sql`:**
new `employees.shift_allocator_id uuid references employees(id)` column;
73 employees mapped across the 8 groups (verified: group sizes — 12
Maintenance incl. CON24, 18 Forge & Cutting, 3 Press, 12 DIE/VMC, 10
Machine, 4 HT, 6 Quality, 8 HR — sum to 73 exactly, matching the live
`count(*) where shift_allocator_id is not null`); every emp_code the CSV
listed (minus CON24) was confirmed to already resolve to a real active
employee before the patch ran, per this project's no-guessing rule on
employee data.

**`allocate_team_shift_week(p_employee_id, p_shift_id, p_week_start)`** —
the real security boundary, `SECURITY DEFINER`, checks
`employees.shift_allocator_id = current_employee_id()` for the target
employee before writing, then upserts `employee_shifts` for all 6 days of
that Sat-Thu week. Needed because `is_management()` (role in manager/
plant_head/hr_admin/owner) does **not** include `supervisor` — Sudeep Singh
(Forge & Cutting's allocator) would be flatly blocked by the existing
`employee_shifts_write` RLS policy otherwise — and because even for
managers, that policy is unscoped (any manager could write shifts for any
employee company-wide), which this must not allow. **Verified directly via
SQL before wiring the UI**: a disposable positive test (VFL1560 allocating
Shift 1 to his own team member VFL4012) wrote all 6 days correctly; a
disposable negative test (VFL1560 attempting to allocate for VFL4065, on a
different allocator's team) correctly raised and was rejected; test rows
deleted after.

**New shared UI**, following this session's own "thin per-role wrapper
around a shared component" pattern (same as Payslips, Late Comers Review):
`components/ShiftAllocationGrid.tsx` + `hooks/useShiftAllocation.ts`,
extracted from `(hr-admin)/shifts.tsx`'s week-nav/chip-grid UI, offering
**Shift 1/2/3/General only — no Security options** (no security guard in
the CSV has an allocator outside HR's own group, matching Yash's own
wording "1st 2nd 3rd or general"; this also fixes a real gap the old HR
screen has — it never offered General as an option at all, only Shift
1/2/3). Team list is scoped to `.eq('shift_allocator_id', me.id)
.eq('is_active', true)`; save issues one `allocate_team_shift_week()` RPC
call per employee with a selection (not a single bulk upsert, since the
RPC — not the UI — is what enforces scoping per employee). Thin wrapper
screens `app/(manager)/shifts.tsx` and `app/(supervisor)/shifts.tsx`.

**Reached via More, not a bottom tab** — `<Tabs.Screen name="shifts"
options={{ href: null }} />` added to both `(manager)/_layout.tsx` and
`(supervisor)/_layout.tsx` (per this project's locked rule: every new
screen in a role group with an existing `_layout.tsx` needs an explicit
entry or it leaks in as a stray tab), with a "Shift Allocation" row added
to each role's `more.tsx` — deliberately matching how HR's own
`shifts.tsx` is wired (also `href: null` + a more.tsx link), not added as
a 6th/7th bottom-bar icon, since manager already has 5 visible tabs and
supervisor already has 6. A manager/supervisor with zero people assigned
to them as allocator still sees the tab, just with an empty-team state —
same reasoning as `(supervisor)/approvals.tsx`'s static "moved" message,
since Expo Router tabs don't support per-user conditional visibility
cleanly.

New `shiftAllocator.*` i18n keys (`tab`/`sub`/`myTeam`/`noTeam`) added in
both `en.json` and `hi.json`; everything else (`hrAdmin.weekOf`/`saveWeek`/
`weekSaved`/`noRotatingEmployees`/`noShiftsYet`) reused verbatim from the
existing HR screen's keys since the wording is identical.

**Verified:** `npx tsc --noEmit` — still exactly 7 errors, the same
pre-existing baseline (`permissions-onboarding.tsx`/`FormsScreen.tsx` icon
typing), none in the new files. `node scripts/check-i18n.mjs` — clean,
Hindi covers every new key. **Not yet exercised on a real device** — only
type-checked and verified against live data/RPC calls directly, no UI
walkthrough. New APK build needed.

**Real bug found same session (29 Sep 2026): HR's master shift screen
excluded plain `member`/`staff` employees.** Yash: HR's shift screen (the
original, unscoped one, `app/(hr-admin)/shifts.tsx`) was missing 2 of the
8 people in her own HR group from the CSV. First fix widened the filter
to `role IN (member,supervisor,security_guard)` — **still wrong, per
Yash's own follow-up correction; see "Shift 4 & Shift 5" below for the
final state (no role filter at all).**

## Shift 4 & Shift 5 — day/night OT variants — decisions from Yash, 29 Sep 2026

Some Shift 3 (00:00–07:00) employees actually come in at 7pm for
overtime and work straight through to 7am — the 7pm–12am portion is the
OT. Confirmed via `AskUserQuestion`: **Shift 5 (19:00–07:00, 12h) coexists
with Shift 3, chosen week-by-week by the allocator** — not a permanent
replacement. Yash also proposed a day-shift equivalent when describing
this ("7am to 7pm and 7pm to 7am, as shift 4 and shift 5") — first built
only Shift 5 since Shift 4 had no described concrete use case yet, but
Yash then confirmed he wants both live now: **"all people allocating
shifts from the csv... will now see shift 1 2 3 4 5 and general to choose
from?"** — yes, built same session. On the OT-rupee split question (how
much of the 12h counts as "overtime" for payroll), Yash had **no
preference** — implemented as **visibility only**, matching this
project's existing "Working hours mapping (NOT salary)" precedent: both
are tracked as ordinary 12h shifts (mapping/flagging, not a payroll
input), no rupee OT amount computed. Revisit the split rule only if Yash
raises it.

**`PATCH_63_shift5_ot_29Sep2026.sql`** (19:00–07:00) and
**`PATCH_64_shift4_day_ot_29Sep2026.sql`** (07:00–19:00) — both
`is_night_shift`/`false` as appropriate, `late_grace_minutes=15`. Kept as
their **own** rows rather than reusing `Security Night`/`Security Day`
(same windows) so security-specific reporting/logic keyed on those exact
names is untouched.

**Real bug found and fixed before Shift 4 could ship: `findClosestShift()`
broke completely when two shifts share a `start_time`.** Shift 4
(07:00) ties exactly with Shift 1 (07:00) — Shift 5 hadn't hit this
since 19:00 was otherwise unique. Caught by testing *before* applying
the patch (same discipline as every other shift-inference change this
project has made), not discovered live: with the tie, the old
`next.startMin - current.startMin` window-length calculation produces a
literal 0, and the `|| MINUTES_PER_DAY` fallback (meant only for the
single-shift-in-pool case) turned that into a **full 24-hour window** —
whichever of Shift 1/Shift 4 happened to sort first would silently
swallow every other shift's inference window for the *entire pool*, not
just around 7am. A test script confirmed this exactly: with the tie
present and unfixed, 17:00 and 23:44 both wrongly resolved to "Shift 1."
Fixed in `lib/shiftInference.ts`: (1) sort ties deterministically by
shift name (`a.shift.name.localeCompare(b.shift.name)` as a tiebreak on
equal `startMin`, since Postgres gives no ordering guarantee among equal
`start_time` rows on its own); (2) each shift's window now extends to
the next **distinct** `start_time`, skipping over any shift sharing its
own start, instead of naively using the next array slot. Re-verified with
a 12-case sweep covering the tie, the original Shift-1-vs-General
examples, and the Security pool — all passed, no regressions.

**Two places updated for the 12h no-checkout default** (a person who
checks into Shift 4 or Shift 5 but never checks out should default to
12h worked, not the generic 8.5h floor meant for 8h shifts):
- `lib/workingHours.ts`'s `defaultHoursForShift()` — `Shift 4`/`Shift 5`
  → `12`, same pattern as the existing `General` → `9` case.
  `MIN_WORKING_HOURS` (the 8.5h short-hours floor) is **unchanged** and
  still applies uniformly — a different question from the no-checkout
  default.
- `scripts/AttendanceReport.gs`'s hand-replicated copy (Apps Script can't
  import the shared lib) — same `Shift 4`/`Shift 5` → `12` case. **Keep
  both in sync by hand if this rule ever changes** — same duplication risk
  already flagged for the IST helpers.

Allowed in both shift-allocation UIs now: `app/(hr-admin)/shifts.tsx`'s
`rotatingShifts` filter and `hooks/useShiftAllocation.ts`'s
`ALLOCATABLE_SHIFT_NAMES` both include `'Shift 4'` and `'Shift 5'`
alongside Shift 1/2/3 (and General, for the new allocator screens).

**HR's master shift screen no longer filters by role at all — decision
from Yash, 29 Sep 2026.** The earlier same-day fix (widening to `role IN
(member,supervisor,security_guard)`) was still wrong: Yash explicitly
said to "remove that logic... follow allocation as per csv even if they
of different role" — and the CSV itself proves the point, since its
Quality group includes VFL5461, whose role is `manager`. Confirmed live:
1 person across all `shift_allocator_id` groups has role `manager`.
`app/(hr-admin)/shifts.tsx`'s employee query is now just `.eq('is_active',
true)` — no role/category filter of any kind. The existing
worker-vs-security section split (by `role === 'security_guard'`) still
works unchanged; it now just draws from a broader pool.

**Verified:** `npx tsc --noEmit` — still exactly 7 errors, the pre-existing
baseline. `node scripts/check-i18n.mjs` — clean (shift names are
data-driven from the DB, not looked up via i18n keys, so none were
needed). `node --check` on the updated `AttendanceReport.gs`. **Not yet
exercised on a real device.** New APK build needed (this touches `app/`,
`hooks/`, `lib/`).

---

## Consultant PIN formula bug — found and fixed 30 Sep 2026 (CON24 could not log in)

**Root cause**: every CON-prefixed (consultant) login was provisioned by
PATCH_35/PATCH_62 with starting PIN `'20' + last 4 digits padded to 4`
(CON24 → `200024`) — deliberately different from the VFL-style formula
(digits padded to 6) used for everyone else. `scripts/HR_reset_pin.sql`
only ever implemented the VFL-style formula. Someone ran it for CON24
(Shriram Pawar) on 30 Sep 2026 (`auth.users.updated_at` moved to that day),
silently overwriting his real starting PIN `200024` with the wrong value
`000024` — he then tried the documented `200024` (correct per CLAUDE.md,
wrong per the DB after the reset) and could not get in.

**Fixed:**
- `PATCH_67_con24_pin_fix_30Sep2026.sql` — restored his password to
  `200024` (safe since `must_change_pin` was still true — he had never
  completed a first login, so nothing of his own was lost).
- `scripts/HR_reset_pin.sql` itself — now branches on emp_code prefix
  (`CON%` → consultant formula, everything else → VFL formula) so this
  cannot silently corrupt a consultant's PIN again. **Any CON-prefixed
  employee reset before 30 Sep 2026 via the old version of this script may
  have the same wrong-PIN problem** — not re-audited against every
  historical run, only confirmed and fixed for CON24, the one Yash
  reported.

## Who has never signed in — active employees, checked live 30 Sep 2026

**Always re-run this before quoting it — do not treat this list as current
the way the headcount-staleness rule above already warns about.**
`SELECT emp_code, name, department FROM employees WHERE is_active = true AND must_change_pin = true;`

As of 30 Sep 2026, 10 active employees had never completed a first login
(`must_change_pin = true`):

| Emp code | Name | Department | Category |
|---|---|---|---|
| CON01 | Chhagan D Dehade | Die Shop | consultant |
| VFL4011 | Banwari Harihar Yadav | Forge Shop | worker |
| VFL4025 | Raghav Harihar Yadav | Forge Shop | worker |
| VFL4026 | Parbhansh Tameshwar Yadav | Forge Shop | worker |
| VFL5272 | Ramesh Narayan Gote | Machine Shop | staff |
| VFL5382 | Vitthal Uddhav Tekale | Machine Shop | staff |
| CON24 | Shriram Pawar | Maintenance | consultant (PIN just fixed — see above) |
| VFL4012 | Kailas Ramdas Darandale | Maintenance | worker |
| VFL5457 | Sandip Tryambak Landage | Maintenance | staff |
| VFL5463 | Manoj Anantrao Wagh | Maintenance | staff (the VFL5337 rejoin) |

## Plant Head monthly form reminder — built 30 Sep 2026

Yash: a new Google Form "for Fazal to be filled by 5th of every month" plus
a notification sent to him from the 1st to the 5th. Registered into
`form_links` (PATCH_66, `department='MANAGEMENT'`, same pattern PATCH_50
used for Overtime Form / Worker Monthly Efficiency — already live in
Fazal's existing Forms tab, no new APK needed). Could not read the form's
own title (docs.google.com blocked by this sandbox's egress proxy, same
restriction as every other Google Forms link this project has handled) —
`form_name` is the placeholder "Plant Head Monthly Form"; **ask Yash to
confirm/rename it** if that doesn't match what the form is actually called.

New edge function `supabase/functions/plant-head-form-reminder/index.ts`:
on the 1st-5th IST of each month, notifies every active `role='plant_head'`
employee for every `form_links` row with `department='MANAGEMENT'` and
`send_in_reminder=true` still outstanding — scoped generally (not
hardcoded to Fazal or this one form) so a second plant_head or a second
monthly MANAGEMENT form later needs only a `form_links` row, not a new
function. De-duplicated against `notifications`
(`related_entity_id = '<form_links.id>:<istDateStr()>'`), the same pattern
`mrm-reminder`'s escalation already uses, so a cron misfire or more-than-
once-daily run cannot double-notify. Deployed live via the Supabase MCP
connector and added to `supabase/functions/deploy.sh`'s `FUNCTIONS` array
(deploy.sh is NOT auto-discovery — a new function must be added there or
CI's Deploy Edge Functions workflow will never pick it up, same lesson as
`send-push-notification` silently staying undeployed for a week).

**Done — Yash ran `PATCH_66_plant_head_monthly_form_30Sep2026.sql`'s
`cron.schedule(...)` block 1 Oct 2026.** The cron job (`plant-head-form-
reminder`, jobid 13) is live; first real fire is the next 09:00 IST window.

## Cron jobs never had real keys — found and explained 1 Oct 2026

**Every pg_cron job in this project (PATCH_18, PATCH_20, and
`plant-head-form-reminder` before Yash fixed it) had the literal string
`'Bearer PASTE_YOUR_KEY_HERE'` as its Authorization header — confirmed live
via `select jobname, command from cron.job`, never actually replaced by
anyone, for any of them, since they were first scheduled.** This did not
break anything and never had: every edge function here is deployed with
`--no-verify-jwt` (`supabase/functions/deploy.sh`), so Supabase's API
gateway never validates that header at all — it's not read inside the
function code either (`supabaseAdmin()` uses the `SUPABASE_SERVICE_ROLE_KEY`
*edge function secret*, set separately in the dashboard, never the inbound
request header). Proof: `mrm-reminder` had 227 successful daily
notification sends on the placeholder text alone before this was noticed.

**Consequence worth knowing, not acted on yet:** because the gateway skips
auth entirely, these 7 function URLs are effectively public —
`POST .../functions/v1/mrm-reminder` (etc.) executes for anyone who calls
it, not just the cron job. Not a data-exposure bug (it only does what the
function already does — no RLS bypass is readable back to the caller), but
it is an unauthenticated trigger surface. Revisit only if Yash wants it
tightened (a shared-secret check inside each function body would close it
without re-enabling `--verify-jwt`, which would also block the cron calls
unless they carry a real key — the two are linked).

**`PATCH_68_cron_keys_01Oct2026.sql`** — cosmetic/hardening hygiene pass,
not a functional fix: replaces the placeholder on the other 6 jobs
(`five-s-challenge-generator`, `forms-due-reminder`, `mrm-reminder`,
`mrm-reminder-escalation`, `nightly-scoring`, `shift-reminder-default`) to
match what Yash already did for `plant-head-form-reminder`, so the header
is correct if `--no-verify-jwt` is ever turned off. **✅ Applied 1 Oct
2026** — verified via `select jobname, command like '%PASTE_YOUR_KEY_HERE%'
...` (boolean only, never selecting the raw `command` column now that a
real key is stored in it): all 7 jobs show `false`, all `active = true`.

**⚠ Incidental key exposure, 1 Oct 2026:** the real key Yash pasted into
`plant-head-form-reminder`'s job appeared in a `select ... from cron.job`
query result run to diagnose this — i.e. it reached this chat transcript,
the same exposure the "never type a key into chat" rule exists to prevent,
just via a query result instead of a direct paste. Flagged to Yash; he may
want to rotate that key. **Lesson for future sessions: never `select
command from cron.job` (or any query that can return a stored
Authorization header) once a real key might be in there — list `jobname`/
`schedule`/`active` only, never `command`, for a job that might hold a live
key.**

---

## 12-point request, 6 Oct 2026 — session summary

Yash sent 12 items in one message. Each one below, with outcome:

1. **60-min early-arrival buffer + overtime** — done. `lib/shiftInference.ts`'s
   `findClosestShift()` now widens the early-arrival window to 60 minutes
   ONLY at the one true zero-gap handoff (Shift 3 ends 07:00 = Shift 1/4's
   start) — every other boundary, including the 08:15/General case fixed
   27 Sep 2026, keeps the original 15-minute buffer untouched. Verified
   with a boundary sweep before shipping. Yash's exact overtime rule —
   *"he could be working 2 hrs overtime also so will not be shift 4 but
   given 2 hrs overtime. if he works 12 hrs or more than 12 hrs. shift
   4/5 plus the extra hrs"* — is `lib/workingHours.ts`'s
   `finalizeShiftAndOvertime()`: under 12h stays on the original shift
   with overtime = hours over that shift's own nominal; at/above 12h the
   day reclassifies to the OT shift (Shift 1→4, Shift 3→5) with overtime
   = hours − 12. Applies regardless of HR-assigned vs inferred. No
   symmetric "under 8.5h → reclassify down" rule (not asked for).
2. **CON24 login + who's pending** — root cause actually found and fixed
   `PATCH_73`, same day, once Yash's hint ("only a problem for him, he's a
   later addition") pointed at it. **Correction to this file's own
   morning entry below**: it wrongly guessed "HR has no self-service way"
   — she does, and always did: `reset_employee_pin()` (`PATCH_45`/`46`,
   26 Sep 2026), wired into `missing-data.tsx`'s "type an emp_code, reset
   their PIN" box, a real shipped feature. It only ever implemented the
   VFL-style formula; CON24 was added 2 days after it shipped (`PATCH_62`)
   and is the only consultant who's needed it since — every time HR used
   it on him, it silently set the wrong PIN. Fixed in `PATCH_73` with the
   same CON%-branch already applied to `HR_reset_pin.sql` on 30 Sep — this
   is the one that actually mattered, since it's the one real humans
   click, not a SQL file only Claude runs. As of 6 Oct only CON24 and
   VFL5457 remained on the never-logged-in list (down from 10 a week
   earlier).
3. **QR scan slowness** — Yash confirmed it's the scan itself, not GPS.
   Root cause found: the QR payload was `plant_code-date-bucket-<full
   48-char salt>` (~70 characters), dense enough to slow down a
   factory-floor phone camera. Fixed in `lib/location.ts`'s
   `buildQrValue()` — only the first 16 hex chars of the salt (64 bits,
   still far more than enough for a 30-minute-rotating code) go into the
   QR now, cutting it to ~38 characters. Single shared function, used
   identically by both `gate-qr.tsx` (generate) and `qr.tsx` (compare).
4/5. **Answered directly in chat** — no DB/code change needed. (4) Nothing
   further needed on CON24. (5) `gate-qr.tsx` already has a manual
   "Refresh" button plus an automatic re-render every minute on bucket
   rollover — this already existed.
6. **Same feature as #1** — see above.
7. **Kajal (VFL1567), Pune** — scoped to just her, per Yash's answer. New
   `employees.default_shift_id` column (general-purpose: the shift to use
   when no `employee_shifts` row exists for a date, checked before the
   generic closest-shift inference) points her at a new "General (Pune)"
   shift (10:00–19:00). New `employees.weekly_off_day` column (nullable,
   0=Sunday..6=Saturday) set to `0` for her. **Real caveat, not silently
   papered over**: storing `weekly_off_day` does not by itself change
   anything she sees — a full-repo search found that **no live code
   anywhere excludes ANY weekly-off day, including the company-wide
   Friday, for ANYONE**, from attendance-percentage denominators or
   lateness flags. `'WO'` status exists only in one-time demo seed data,
   never written by live app or edge-function code. This is a separate,
   pre-existing, company-wide gap — not fixed in this pass, needs its own
   decision from Yash before touching the 6+ dashboards/`nightly-scoring`
   that would need to change.
8. **24h auto-checkout** — new edge function `supabase/functions/
   auto-checkout/index.ts`, hourly cron (`PATCH_72`). Finds any
   `attendance_records` row still open 24h+ after check-in, fills
   `check_out_time`/`hours_worked` via the existing no-checkout
   convention, runs it through the same `finalizeShiftAndOvertime()`
   logic a manual checkout uses. Hand-replicated in Deno (can't import
   `lib/`) — same duplication-accepted pattern as `AttendanceReport.gs`'s
   copy of `defaultHoursForShift()`; keep all three copies in sync by
   hand if the 8.5/9/12 numbers or the 12h threshold ever change.
9. **GPS radius 45m** — done (`PATCH_70`), all 12 real campus points.
   Pune Office untouched at 200m (deliberate, unrelated).
10. **Friday-called-in overtime** — Yash's answer was "just a count for
    now," so this folds into #1/#8's `overtime_hours` column (visibility
    only, never read by payroll). No separate Friday-specific code —
    the hours a person works on their weekly-off day are already counted
    as overtime by the same general mechanism once they check in/out,
    regardless of which day it is.
11. **Shift Check-in Summary screen** — the real screen was never actually
    built before this session (only a mockup artifact shown 1 Oct 2026,
    whose 3 open questions were never answered — found and corrected
    this session). Built now: `hooks/useShiftCheckinSummary.ts` +
    `components/ShiftCheckinSummary.tsx`, thin wrapper screens for
    Owner/Plant Head/HR Admin, reached via More (`href: null` pattern).
    Rows: Shift 1–5, General, Unassigned (never dropped). Security
    Day/Night excluded with a footnote. These 3 defaults were Claude's own
    call (confirmed-by-silence, not re-asked a third time) — correct if
    Yash doesn't say otherwise.
12. **Supabase → Sheets/Excel** — not built this session (would need a
    clear scope: which tables, on-demand vs recurring). Already partly
    solved for attendance specifically — `scripts/AttendanceReport.gs`
    already pushes daily/monthly attendance into the "VFL HR OS 2026 27"
    sheet automatically (28 Sep 2026). For anything else, the same
    Apps-Script-pulls-from-Supabase pattern extends cleanly; needs Yash to
    say which tables/calculations before building it.

**Delegation note**: items 1/6/8 (shift-inference/overtime/auto-checkout)
and item 11 (the dashboard screen) were each built by a separate Sonnet
subagent, given a complete, pre-worked-out design rather than an open brief
— Claude reviewed every diff (including independently re-running
`tsc --noEmit` and `check-i18n.mjs` rather than trusting the agents'
self-reported numbers) before committing either. Both came back clean on
the first pass.

**Verified end-to-end**: `apk-85` (commit `4ba72ee`) built successfully and
contains every code change from this session. Confirmed via
`mcp__github__actions_list`/`get_latest_release`, not assumed from the push.

---

## What Claude must NEVER do

- Commit `.env` or any file containing `service_role` key
- Use `drop schema public cascade`
- Guess employee phone numbers
- Reference `types/database.ts` column names (old schema) — always use `types/index.ts`
- Use `shift_date`, `full_name`, `employee_code`, `department_id`, `reporting_manager_id`, `salary_structure` — these are old schema names that don't exist in FINAL_SCHEMA
- **Compute "today," "this month," or any date-boundary/deadline check from a plain `new Date()`/`.getMonth()`/`.getFullYear()`/`.getDate()`/`.getDay()` call, in frontend or edge-function code.** Always use `lib/istDate.ts` (frontend) or `supabase/functions/_shared/istDate.ts` (edge functions) — see the locked IST rule above. This is not a style preference; it was a live production bug (wrong calendar date, missing attendance data) until the 27 Sep 2026 audit fixed it, and it must never be reintroduced.

---

## Pending from Yash (owner)

0. **SQL — ALL APPLIED as of 23 Aug.** FINAL_SCHEMA, the seeds, PATCH_01 through PATCH_22 and every combined file have been run and confirmed by Yash. Nothing in `scripts/*.sql` is outstanding. Do not re-run any of them.

   **Supabase sync is live (9 Sep 2026).** Script Properties (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) set in the Apps Script editor; `testSupabaseSync()` confirmed: 145 form_submissions + 8160 production_records pushed. Forms tab and production dashboard now have real data.

   **FCM push confirmed (9 Sep 2026).** `FCM_SERVICE_ACCOUNT_JSON` set in Supabase → Edge Functions → Secrets. Android push is now live for employees who have reinstalled after `google-services.json` was wired in.

   **forms_due_reminder cron active.** PATCH_18 applied 13 Aug — pg_cron job fires every 15 minutes. No further dashboard action needed.

1. **Worker → supervisor mapping** — CLOSED 10 Aug (Yash: "that will happen in the app") — this is an in-app assignment flow, not a DB patch task
2. **Rotating supervisor update** — CLOSED 10 Aug (Yash: rotations are decided every Friday by HR/IR, cannot be provided in advance) — the weekly `supervisor_id` UPDATE is HR/IR's own task going forward, not tracked here
3. **VFL1527 phone** — intentionally left NULL; correct number still unknown
4. **Shakeel Sayyad** — confirmed 10 Aug by Yash as a real employee, phone to stay NULL. Still needs a real `emp_code` (and department/designation/salary from the salary sheet) before he can be inserted — not fabricated, per the VFL5463 lesson (see PATCH_09 correction above). Add once Yash provides the code.
5. **Nagnath Kale / Sadashiv Soddy real emp_codes** — CLOSED, stale entry found and fixed 27 Sep 2026. This used to ask Yash to provide codes; both already have real ones (CON09, CON12 — see "Employee data" above), both `is_active=true`, both have completed first login. Nothing outstanding.
6. **Real bundle ID before Play Store submission** — **N/A as of 10 Aug**: Yash confirmed the app will NOT go on Play Store — APK will be distributed as a direct download link to all 129 employees (sideload install). `com.vfpl.forgeos` stays as-is, no further action needed on this.
7. **EAS account for signed/production builds** — not needed given #6 (no Play Store, sideload distribution). The existing debug APK from GitHub Actions is sufficient — Android installs any signed APK (including debug-signed) directly, no Play Store signing required. Only revisit if Yash later decides to publish to Play Store.

---

## App build

**Distribution: direct download link, no Play Store.** Every successful CI run auto-publishes to a GitHub Release. Stable permanent link for WhatsApp/anywhere — always resolves to the newest build:
`https://github.com/erpvarsha-star/forge-os-trial/releases/latest/download/app-release.apk`

**"Download Latest App" row (`components/UpdateAppLink.tsx` + `hooks/useAppVersion.ts`) — mount-once bug found and fixed 28 Sep 2026.** No push-style alert for updates exists or was ever built — the row only checks when its screen gains focus, and the check itself needs no key/token (public, unauthenticated `api.github.com/repos/.../releases/latest`, confirmed working with a plain `curl`). The bug: it used a plain `useEffect`, which fires once on first mount and never again unless the component actually unmounts and remounts. A phone kept backgrounded (not force-closed) never remounts the More screen, so the check could freeze at whatever it saw hours or days earlier and keep showing "Up to date" long after several newer builds shipped — confirmed live: Yash's phone showed "Version 66 · Up to date" with `apk-70` already out. Fixed by switching to `useFocusEffect` (from `expo-router`), so re-visiting any screen with this row re-runs the check — still governed by the existing 6h `AsyncStorage` cache, so this doesn't add extra API calls on fast tab-switching, it just stops the check from going stale indefinitely on a long-lived session.

**Working CI path — set up 10 Aug, confirmed producing a genuinely standalone-installable APK that doesn't crash on launch 11 Aug:**
`.github/workflows/build-apk.yml`. Triggers: manual (`workflow_dispatch` — Actions → Build Android APK → Run workflow, though note the token this repo's Claude sessions run under gets 403 on both `workflow_dispatch` and rerun-run API calls — only the `push` trigger actually works for them) or push to files it cares about (see `paths:` filter). Builds `assembleRelease` (NOT `assembleDebug` — see bug list below), then `softprops/action-gh-release` uploads `app-release.apk` straight from the runner to a GitHub Release (`apk-<run number>` tag, `make_latest: true`). This bypasses both the agent sandbox's network restrictions (Azure Blob Storage, which the artifact-download URL uses, is blocked the same as dl.google.com/expo.dev) and chat file-upload limits — Claude never needs to touch the binary. First run that produced an actually-launchable APK: https://github.com/erpvarsha-star/forge-os-trial/actions/runs/31449330749 (`apk-10`, commit 1f99490) — see the crash-on-launch bug below; every earlier "green" run (including the 10 Aug one previously linked here as "first fully-working") built successfully but crashed to a blank screen on open.

**The `paths:` filter, checked directly rather than assumed, 28 Sep 2026** (needed to answer Yash's "check pending.md for things to club before building the apk" — the answer turned out to be "already automatic," see below): `push:` fires only on `.github/workflows/build-apk.yml`, `app.json`, `google-services.json`, `eas.json`, `assets/**`, `package.json`, `package-lock.json`, `app/**`, `components/**`, `constants/**`, `hooks/**`, `i18n/**`, `lib/**`, `types/**`, `babel.config.js`, `tailwind.config.js`, `tsconfig.json`. **Deliberately not included**: `scripts/**` (SQL patches, `ALERT.gs`/`AttendanceReport.gs`), `supabase/functions/**` (edge functions deploy separately, see the Deploy Edge Functions workflow), `dashboard/**`, and docs (`CLAUDE.md`/`PENDING.md`) — none of these ship inside the APK, so a commit touching only those correctly does **not** trigger a rebuild. **Every run builds a fresh, complete APK off the whole current branch, not an incremental diff** — so there is never a manual "bundle these pending features into one build" step: whatever is committed by the time a build fires is automatically in it. The only thing to check before telling Yash/staff to reinstall is that the latest triggering commit's run actually finished (`status: completed`, `conclusion: success`) — confirmed via `mcp__github__actions_list`/`list_releases`, not assumed from the push alone. Last confirmed: `apk-79` (run #79, commit `fe6d55f`), `success`, published `2026-09-28T15:18:39Z` — contains every app-code change through the shift-allocation feature.

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
