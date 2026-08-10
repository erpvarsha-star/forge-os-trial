# Forge OS — Claude Code Project Context

**Company**: Varsha Forgings Pvt Ltd (VFPL), Aurangabad  
**App**: Forge OS — bilingual (EN/HI) React Native attendance + HR system  
**Last full audit**: 10 August 2026  
**Branch**: `claude/forge-os-backend-setup-7woj4t`

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
| Auth | Supabase Phone OTP |
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
| `notifications` | `user_id` (not employee_id), `read` (not is_read) |
| `push_tokens` | `user_id` (not employee_id), `token`, `platform` |
| `leave_balances` | `earned_leave`, `casual_leave`, `sick_leave` |
| `advance_requests` | `employee_id`, `amount`, `reason`, `repayment_months`, `status`, `outstanding_balance` |
| `mrm_reviews` | `department` TEXT (not department_id FK), `month` TEXT zero-padded |
| `fraud_alerts` | `type` CHECK('mock_location','buddy_punching','bulk_confirm'), `employee_id`, `severity`, `status` |
| `fraud_flags` | `employee_id`, `flag_type` TEXT, `description`, `reviewed` |

### Tables that DO exist (FINAL_SCHEMA)
`employees`, `departments`, `plant_config`, `attendance_records`, `shifts`, `employee_shifts`, `leave_balances`, `leave_requests`, `advance_requests`, `payroll_records`, `monthly_scores`, `maintenance_observations`, `"5s_challenges"`, `"5s_submissions"`, `casual_workers`, `data_collection_submissions`, `mrm_reviews`, `fraud_alerts`, `fraud_flags`, `vehicle_log`, `eod_confirmations`, `email_tasks`, `notifications`, `push_tokens`

### Tables that do NOT exist (referenced in old code)
`tasks`, `hourly_production`, `shift_reports`, `salary_advances`, `five_s_challenges`, `five_s_challenge_completions`

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
- 120 original + 4 (PATCH_08) + 6 (PATCH_09) = 130 total once all patches run
- ~95 of the original 120 have phone numbers after PATCH_03
- **VFL1527** Sharwan Singh Jodha — phone intentionally left NULL (number given was duplicate of VFL1520)
- **VFL1528** Bhupendra Kashinath Bharude — phone +918805698127 (fixed in PATCH_05)
- **VFL5450** Sayed Uzaif Ali — full name in payroll is "Sayed Uzaif Ali Syed Altaf Ali"; confirmed same person, no DB change needed
- **PATCH_08 (real emp_codes, confirmed against contact list + salary sheet 10 Aug 2026)**:
  VFL5462 Bharat Vasantrao Salve (Manager, Accounts), VFL5458 Shaikh Irfan (Supervisor, Forge Shop, Week 3 rotating), VFL5459 Vaibhav Mali (Supervisor, Press Shop, Week 1 rotating), VFL5460 Ashok Kumar (Supervisor, Final Shop)
  ⚠ Supersedes an earlier PATCH_08 committed 09 Aug that used fabricated codes VFL5463/5465/5466/5467 — see correction note in the patch file.
- **Nagnath Kale / Sadashiv Soddy**: confirmed NOT in payroll (contact list or salary sheet) — genuine outside consultants, no emp_code exists. Not added to DB. Only add if Yash provides a real emp_code and confirms app login is needed.
- **PATCH_09 (confirmed 10 Aug 2026)**: VFL5461 Shaikh Hafizuddin Tamizuddin (Manager, Quality), VFL5452 Bholanath Das (Forge Shop QA), VFL5453 Shaikh Zaker Abdul Quayyum (Press Shop QA), VFL5457 Sandip Tryambak Landage (Maintenance), VFL5454 Shaikh Tohid Yunus (Purchase) — plus bonus VFL5463 Manoj Anantrao Wagh (Maintenance, found in payroll but not previously tracked)
- **supervisor_id**: partial assignments done in PATCH_05 (Final/Die/Maintenance/Forge); rotating departments need weekly update or a supervisor_rotation table
- Salary sheet (Jul 2026 payroll template) — used as source for dept/designation/salary of PATCH_08/09 new hires; contact list (not salary sheet) is the source of truth for phone numbers — several salary-sheet mobile numbers are misaligned/shifted
- **PATCH_07 corrections**: VFL1463→Press Shop, VFL1556→Press Shop+supervisor, VFL1545→manager, VFL1389→manager, VFL1557→HR dept, VFL5447→Admin dept
- **Vijay Kumar Yadav**: removed from org chart — never in DB, no action needed

---

## plant_config (key-value table)

Keys: `plant_code`, `plant_name`, `plant_lat`, `plant_lng`, `geofence_radius_meters`, `qr_secret_salt`  
**GPS set to 19.836079, 75.236261 (confirmed by Yash, 09 Aug 2026). Geofence = 100 m.**  
QR salt: PATCH_06 has a commented-out UPDATE — Yash must generate his own secret (`python3 -c "import secrets; print(secrets.token_hex(24))"`) and run it directly in Supabase SQL Editor. Never commit this value to git.

---

## SQL Patches applied (run in Supabase SQL Editor in order)

| File | Purpose | Status |
|---|---|---|
| `FINAL_SCHEMA_02Aug2026.sql` | Full schema | ✅ Applied |
| `EMPLOYEE_SEED_03Aug2026.sql` | 81 staff | ✅ Applied |
| `WORKER_SEED_04Aug2026.sql` | 39 workers | ✅ Applied |
| `PATCH_01_hrAdmin_03Aug2026.sql` | Pallavi role fix | ✅ Applied |
| `PATCH_02_plantHead_phone_04Aug2026.sql` | Fazal plant_head + Yash phone | ✅ Applied |
| `PATCH_03_phones_09Aug2026.sql` | 95 employee phones | ⏳ Run this |
| `PATCH_04_schema_fixes_09Aug2026.sql` | Rename 5s_score → five_s_score, add indexes | ⏳ Run this |
| `PATCH_05_supervisor_ids_09Aug2026.sql` | VFL1528 phone fix + supervisor/manager/plant_head IDs | ⏳ Run this |
| `PATCH_06_plant_config_09Aug2026.sql` | Real GPS (19.836079, 75.236261) + QR secret salt | ⏳ Run this |
| `PATCH_07_org_corrections_09Aug2026.sql` | Dept/role fixes: Dinkar→Press, Shyambabu→Press/sup, Mujahed→manager, Tushar→manager, Milind→HR, Sarang→Admin | ⏳ Run this |
| `PATCH_08_new_employees_09Aug2026.sql` | **CORRECTED 10 Aug** — 4 new employees with real emp_codes: Bharat Salve(VFL5462), Irfan Shaikh(VFL5458), Vaibhav Mali(VFL5459), Ashok Kumar(VFL5460) | ⏳ Run this |
| `PATCH_09_qa_purchase_maintenance_10Aug2026.sql` | 6 new employees: Tamizuddin(VFL5461), Bholanath Das(VFL5452), Shaikh Zaker(VFL5453), Sandip Landage(VFL5457), Tohid Shaikh(VFL5454), Manoj Wagh(VFL5463) | ⏳ Run this |

---

## App screen map (50 screens, 7 role groups)

```
app/
├── index.tsx              — role router (the only auth guard; no guards in layouts)
├── (auth)/login.tsx       — Phone OTP login
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
│   ├── shift-report.tsx   — submit shift production data
│   ├── casual-workers.tsx — log casual worker counts
│   ├── 5s-verify.tsx      — approve/reject 5S submissions
│   └── more.tsx
├── (manager)/
│   ├── dashboard.tsx      — department attendance %
│   ├── team.tsx           — list supervisors under this manager
│   ├── approvals.tsx      — approve escalated leave/advance
│   ├── mrm.tsx            — submit MRM review
│   ├── reports.tsx        — (placeholder, not implemented)
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
    └── eod-lock.tsx       — EOD vehicle count reconciliation
```

---

## Edge functions (6, all Deno)

| Function | Purpose | Cron |
|---|---|---|
| `nightly-scoring` | Composite monthly score for all members/supervisors/managers | Nightly 22:00 IST |
| `fraud-detector` | GPS + bulk-confirmation fraud checks | Called by app on check-in/supervisor confirm |
| `mrm-reminder` | Ensure MRM rows exist; remind managers 8th-10th; escalate to plant_head | Daily |
| `shift-reminder` | Weekly shift notify (Thursday) + daily check-in reminder (hourly) | Thursday + hourly |
| `5s-challenge-generator` | Generate daily 5S challenge via Gemini | Daily |
| `send-push-notification` | HTTP dispatcher — write notification row + Expo push | On-demand |

**Shared helpers** (`supabase/functions/_shared/`):
- `push.ts` — `notifyEmployees()` inserts `notifications` rows (`user_id` column) + Expo push batch
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
| `worker/home.tsx` | `employee_shifts` join syntax incorrect; `Constants.deviceId` deprecated |
| `worker/5s.tsx` | Camera `takePhoto()` uses placeholder URL — not wired to expo-camera |
| `worker/observation.tsx` | Camera not wired |
| `supervisor/approvals.tsx` | Advance approve button is a no-op `onPress={() => {}}` |
| `supervisor/casual-workers.tsx` | Upsert conflict key uses `date` — check if `CasualWorkersRow` matches FINAL_SCHEMA |
| `manager/reports.tsx` | Entirely static placeholder — not implemented |
| `owner/kpi.tsx` | All chart data hardcoded — not wired to DB |
| `(all roles)/payslip.tsx` | No null check on payroll_records — crashes if record absent |
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

1. **Worker → supervisor mapping** (still on paper) — which workers go under which specific supervisor within Heat Treatment (VFL1066 vs VFL1568 for 3 workers), Machine Shop (3 supervisors VFL1272/1290/1327), Cutting Shop
2. **Rotating supervisor update** — Week 2 (11-17 Aug): Forge = VFL1516 Subhash Palve, Press = update to next supervisor. Run UPDATE on `supervisor_id` each week.
3. **VFL1527 phone** — intentionally left NULL; correct number unknown
4. **Shakeel Sayyad** — on Supervisor_Map (Press, Week 2, ph:7378426599) but NOT in org chart, contact list, or salary sheet — confirm if he's an actual employee before adding
5. **Nagnath Kale / Sadashiv Soddy real emp_codes** — confirmed as genuine outside consultants (not in contact list or salary sheet). Provide a real emp_code from your master register only if they need app logins.
6. **EAS build config** — no `eas.json` in repo; `app.json` has placeholder bundle ID `com.yourcompany.forgeos` — needed before any app build/deploy

---

## App build

```bash
# APK (Android)
eas build --platform android --profile preview

# Or via dashboard:
# expo.dev → erp.varsha → forge-os → Builds → New Build
```

No `eas.json` in repo — needs to be created before EAS build will work.  
`app.json` has placeholder bundle ID `com.yourcompany.forgeos` — update before production build.
