# Forge OS — Production Activation Runbook
**File**: CODE_ForgeOS_Runbook_03SEP2026.md  
**Generated**: 03 Sep 2026 by CODE  
**Version**: 1.0  
**Estimated time**: 45–60 minutes end-to-end (with all credentials ready)

---

## BEFORE YOU START — Checklist

Gather these before opening any dashboard:

| Item | Where to get it | Status |
|---|---|---|
| Supabase dashboard login | supabase.com → sign in as `yashjmunot@gmail.com` | |
| Firebase service account JSON | Firebase Console → Project Settings → Service Accounts → Generate New Key | |
| Telegram bot token | Already created: `@Form_mgr_bot` — retrieve from BotFather if lost | |
| Apps Script editor URL | Google Drive → `scripts/ALERT.gs` → open in Apps Script | |
| GitHub Actions access | github.com/erpvarsha-star/forge-os-trial/actions | |
| Employee WhatsApp group | For distributing the APK download link | |

---

## STEP 1 — Run the Pending SQL Patches

**Where**: Supabase Dashboard → Project `odfwtdpvpfzdrznvurru` → SQL Editor  
**File**: `scripts/COMBINED_DEPLOY_19to23_31Aug2026.sql` in the GitHub repo

This single file contains PATCH_19 through PATCH_23. It is **idempotent** — safe to run even if some patches already ran.

### What each patch does
| Patch | Effect |
|---|---|
| PATCH_19 | Adds Maintenance (4 forms), HR (2 forms), VMC Shop (1 form) to `form_links` |
| PATCH_20 | Schedules `nightly-scoring`, `mrm-reminder`, `five-s-challenge-generator`, and `shift-reminder` via pg_cron. Also adds `mrm-reminder-escalation` pinned to the 10th at 17:00 IST |
| PATCH_21 | Creates `plant_locations` table (multi-point geofence, 0 rows — safe) |
| PATCH_22 | Seeds 12 campus locations with real coordinates from Yash's sheet |
| PATCH_23 | Seeds Shift 1/2/3 (08:30/15:30/23:30) into `shifts` table + adds `UNIQUE(name)` constraint |

### How to run
1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/odfwtdpvpfzdrznvurru/sql)
2. Click **New query**
3. Copy the entire contents of `scripts/COMBINED_DEPLOY_19to23_31Aug2026.sql` from GitHub
4. Paste and click **Run**
5. Verify no red errors in the output panel

### Verify it worked
Run this check query:
```sql
SELECT 
  (SELECT COUNT(*) FROM plant_locations) AS location_count,
  (SELECT COUNT(*) FROM shifts) AS shift_count,
  (SELECT COUNT(*) FROM form_links) AS form_count,
  (SELECT COUNT(*) FROM cron.job) AS cron_job_count;
```
Expected: `location_count=12`, `shift_count=3`, `form_count≥31`, `cron_job_count≥5`

---

## STEP 2 — Add Shift-Reminder Cron Entry (forms mode)

**Where**: Supabase Dashboard → SQL Editor

The `shift-reminder` edge function has a `forms_due_reminder` mode that fires 15 minutes before each shift's form deadline. It needs its own cron job (the function's standard hourly trigger does NOT pick up this mode).

Run this:
```sql
SELECT cron.schedule(
  'forms-due-reminder',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/shift-reminder',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '"}'::jsonb,
    body:='{"mode":"forms_due_reminder"}'::jsonb
  );
  $$
);
```

> **Note**: If `current_setting('app.service_role_key', true)` is not set in your Supabase config, replace it with the actual service role key inline — but only in the Supabase SQL Editor (never commit this to git).

---

## STEP 3 — Set FCM Service Account Secret

**Where**: Supabase Dashboard → Edge Functions → Secrets  
**Purpose**: Enables Android push notifications via FCM v1 (direct, not via Expo)

### Steps
1. Go to [Firebase Console](https://console.firebase.google.com) → Project `gen-lang-client-0072991718`
2. Settings → Service Accounts → **Generate new private key** → Download JSON
3. Open Supabase → [Edge Functions → Secrets](https://supabase.com/dashboard/project/odfwtdpvpfzdrznvurru/functions)
4. Click **Add new secret**
5. Name: `FCM_SERVICE_ACCOUNT_JSON`
6. Value: paste the entire contents of the downloaded JSON file (single line or multi-line both work)
7. Save

### Verify
After setting the secret, trigger a test push from `send-push-notification` edge function — if the secret is missing the function logs `FCM secret not configured` and skips push (in-app notifications still work).

---

## STEP 4 — Set Up ALERT.gs (Telegram + Form Reminders)

**Where**: Google Apps Script editor (same project as Code.gs)

### 4a — Paste the script
1. Open the Apps Script project that contains `Code.gs`
2. Add a new script file named `ALERT`
3. Copy the entire contents of `scripts/ALERT.gs` from the GitHub repo
4. Paste into the new file and save

### 4b — Set Script Properties
Click **Project Settings** (gear icon) → **Script Properties** → Add:

| Property | Value |
|---|---|
| `SUPABASE_URL` | `https://odfwtdpvpfzdrznvurru.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (your Supabase service role key — never paste this in chat) |
| `TELEGRAM_BOT_TOKEN` | Token for `@Form_mgr_bot` from BotFather |

Leave `TELEGRAM_BOT_TOKEN_INLINE` and `OWNER_TELEGRAM_CHAT_ID_INLINE` **blank** in the code — Script Properties override them.

### 4c — Deploy triggers
In the Apps Script editor, run this function once:
```
deployShiftTrackingTriggers()
```
This creates exactly 2 triggers (the old per-function triggers are deleted first):
- `runShiftAlerts15min_()` — every 15 minutes
- `runDailyMaintenance_()` — daily

**Check trigger count**: Project Settings → Triggers. Total triggers (Code.gs + ALERT.gs combined) must be ≤ 20. Expected after this step: 13 (11 from Code.gs + 2 from ALERT.gs).

### 4d — Onboard supervisors to Telegram
Each supervisor messages `@Form_mgr_bot` with their full name (e.g. "Fazal Ilahi Khan"). The bot matches it to `SUPERVISOR_MAP` and records their chat ID automatically. Yash messages his own full name or "owner" to set `OWNER_TELEGRAM_CHAT_ID`.

### 4e — Test
Run `testSupabaseSync()` once — should return a success response from Supabase (confirms service role key is working and form_submissions/production_records sync is live).

---

## STEP 5 — Distribute the APK

**Permanent download link** (always the latest build):  
`https://github.com/erpvarsha-star/forge-os-trial/releases/latest/download/app-release.apk`

### How to install (Android sideload)
1. Share the link above via WhatsApp to all 129 employees
2. Employees tap the link → Chrome will download the APK
3. Before installing: Settings → "Install unknown apps" → Chrome → Allow
4. Tap the downloaded APK → Install
5. Open Forge OS → log in with employee code + PIN

### Default PINs
Every employee's starting PIN = their numeric emp_code digits, zero-padded to 6:  
- `VFL1001` → PIN `001001`  
- `VFL5440` → PIN `005440`

The app forces a PIN change on first login.

### If a new APK build is needed
Go to GitHub → Actions → **Build Android APK** → **Run workflow** (or push to a path the workflow watches). The new APK automatically publishes to the latest release — the permanent link above always resolves to it.

---

## STEP 6 — Employee Onboarding

### Priority order
1. **Yash (VFL1001)** — log in first, confirm owner dashboard loads
2. **Pallavi (VFL5440, hr_admin)** — confirm HR dashboard and shift assignment work
3. **Fazal (VFL1386, plant_head)** — confirm plant-head dashboard and approval flows
4. **All supervisors** — assign shifts via HR dashboard before workers start checking in
5. **All workers** — distribute APK link via WhatsApp

### HR must do before launch day
- [ ] Open HR Admin → Shifts → assign each supervisor's team their shifts
- [ ] Confirm all 129 employees have correct `emp_code` visible on their ID card or communicated via WhatsApp
- [ ] Send the default-PIN formula to supervisors so they can help workers who can't figure it out

### First-login troubleshooting
| Symptom | Fix |
|---|---|
| "Invalid credentials" | Check `emp_code` spelling — no spaces, exact case (e.g. `VFL1001`) |
| Login succeeds but blank screen | Auth user not provisioned — run `PATCH_10_pin_auth_11Aug2026.sql` partial re-run for that emp_code |
| Employee forgot new PIN | HR runs `HR_reset_pin.sql` (in scripts/) for that emp_code — resets to starting PIN and re-arms forced change |
| App crashes on open | APK from before 11 Aug build — re-download from the permanent link |

---

## STEP 7 — Set Up Monitoring

### What's already monitoring itself
- **Fraud detector**: called on every GPS check-in — logs to `fraud_alerts` and `fraud_flags`
- **Nightly scoring**: runs at 22:00 IST daily — updates `monthly_scores`
- **MRM reminder**: runs daily 09:00 IST + 10th at 17:00 IST
- **Shift reminder**: hourly check-in mode + every 15 min forms-due mode (after Step 2)
- **5S challenge generator**: daily — uses Gemini to generate challenge

### Manual checks (first week after launch)
Each morning, open the plant dashboard (`dashboard/index.html` — download and open in browser):
- Today's present count should update within 30 min of shift start
- Pending approvals should reflect overnight submissions
- Open fraud alerts: review and close false positives

### Supabase edge function logs
[Edge Functions → Logs](https://supabase.com/dashboard/project/odfwtdpvpfzdrznvurru/functions) — check each function after its first scheduled run:
- `nightly-scoring`: next day after 22:00 IST
- `mrm-reminder`: next day after 09:00 IST
- `shift-reminder`: within 1 hour and within 15 min

### pg_cron job status
```sql
SELECT jobname, active, jobid FROM cron.job ORDER BY jobname;
```
All jobs should show `active = true`.

---

## STEP 8 — Admin Interface for Workers, Shifts, Locations

The app already has:
- **HR Admin → Shifts** (`app/(hr-admin)/shifts.tsx`): assign shifts per employee, create new shifts
- **HR Admin → Missing Data** (`app/(hr-admin)/missing-data.tsx`): find employees with missing phone/dept/supervisor
- **Owner → View As** (`app/view-as.tsx`): inspect app as any role without logging in as that employee

### What's NOT yet built (future sprints)
- Bulk shift assignment (currently one employee at a time)
- Employee photo/ID card management
- Bulk employee import UI (currently SQL only)

---

## STEP 9 — Production Deployment Checklist

Run through this on launch day:

- [ ] STEP 1: COMBINED_DEPLOY_19to23 SQL run — verified ✅
- [ ] STEP 2: forms-due-reminder cron entry added ✅
- [ ] STEP 3: FCM_SERVICE_ACCOUNT_JSON secret set ✅
- [ ] STEP 4: ALERT.gs deployed, triggers set, testSupabaseSync() passed ✅
- [ ] STEP 5: APK link shared with all 129 employees ✅
- [ ] STEP 6: Yash + Pallavi + Fazal logged in and dashboards verified ✅
- [ ] STEP 7: Edge function logs checked next morning ✅
- [ ] Supervisors have completed Telegram onboarding ✅
- [ ] All supervisor teams have shifts assigned ✅
- [ ] plant_config GPS (19.836079, 75.236261) + qr_secret_salt confirmed set ✅

---

## STEP 10 — SPARK Alert Integration

SPARK delivered: **ForgeOS Alerts Deployment Guide + Activation Package**

Locate these docs in the YJM_AI_TeamHub Google Drive folder. The key integration point between SPARK's work and Forge OS is:

1. **`ALERT.gs`** — already in `scripts/ALERT.gs` in this repo, incorporating SPARK's alert logic
2. **`SUPERVISOR_MAP` sheet** — SPARK maintains this in Google Sheets; column layout is frozen (coordinate with SPARK before adding/removing columns)
3. **Telegram bot** — `@Form_mgr_bot` — set up per SPARK's onboarding guide

Any new alert types SPARK wants to add → SPARK proposes → CODE implements in `ALERT.gs` → Yash deploys.

---

## KNOWN GAPS — Require Future Action

| Gap | Who | When |
|---|---|---|
| VFL1527 (Sharwan Singh Jodha) — phone intentionally NULL | Yash to provide correct number | When known |
| Shakeel Sayyad — no emp_code yet | Yash to provide real emp_code | When known |
| Bulk shift assignment UI | CODE to build | Next sprint |
| Owner KPI screen wired to live `production_records` | CODE to build | Next sprint |
| Play Store distribution (currently sideload) | Yash decision | When needed |
| PATCH_19–22 status unconfirmed | Yash to run verification SQL | Before launch |

### Verification SQL for Yash
Run in Supabase SQL Editor to confirm PATCH_19–22 ran correctly:
```sql
-- Check plant_locations and form counts
SELECT 
  (SELECT COUNT(*) FROM plant_locations) AS location_rows,
  (SELECT COUNT(*) FROM form_links WHERE department IN ('Maintenance','Human Resource','VMC Shop')) AS new_dept_forms;

-- Check cron jobs
SELECT jobname, active FROM cron.job 
WHERE jobname IN ('nightly-scoring','mrm-reminder','five-s-challenge-generator','shift-reminder','mrm-reminder-escalation')
ORDER BY jobname;
```
Expected: `location_rows=12`, `new_dept_forms=7`, all 5 cron jobs `active=true`.

---

## QUICK REFERENCE

| Resource | URL / Value |
|---|---|
| Supabase project | https://supabase.com/dashboard/project/odfwtdpvpfzdrznvurru |
| GitHub repo | https://github.com/erpvarsha-star/forge-os-trial |
| APK permanent link | https://github.com/erpvarsha-star/forge-os-trial/releases/latest/download/app-release.apk |
| Plant dashboard | `dashboard/index.html` — download from repo, open in Chrome |
| Supabase URL | https://odfwtdpvpfzdrznvurru.supabase.co |
| Firebase project | gen-lang-client-0072991718 |
| Expo project | @erp.varsha/forge-os |
| Telegram bot | @Form_mgr_bot |
| Plant GPS | 19.836079, 75.236261 |
| Geofence radius | 100 m (single-point) → 12 named points (after PATCH_22) |

---

*Generated by CODE (Claude Code) — 03 Sep 2026*
