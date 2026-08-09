# Forge OS — Claude Code Project Context

**Company**: Varsha Forgings Pvt Ltd (VFPL), Aurangabad  
**App**: Forge OS — bilingual (EN/HI) React Native attendance + HR system  
**Last full audit**: 09 August 2026  
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
- 120 total; ~95 have phone numbers after PATCH_03
- **VFL1527** Sharwan Singh Jodha — phone TBD (conflict with VFL1520)
- **VFL1528** Bhupendra Kashinath Bharude — phone TBD
- **supervisor_id assignments**: NOT YET done — need org chart from Yash
- Salary sheet (April 2026) uploaded — preserved for future payroll feature

---

## plant_config (key-value table)

Keys: `plant_code`, `plant_name`, `plant_lat`, `plant_lng`, `geofence_radius_meters`, `qr_secret_salt`  
**GPS not yet set to real plant coordinates** — update via SQL after getting exact coordinates from Yash.

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

1. **Org chart** — supervisor → member assignments (needed for PATCH_05 to set `supervisor_id`)
2. **Plant GPS** — exact latitude/longitude of factory gate (for plant_config)
3. **Geofence radius** — metres allowed from gate for GPS check-in
4. **VFL1527 correct phone** — 8955273074 is already used by VFL1520 (conflict)
5. **VFL1528 correct phone** — left blank

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
