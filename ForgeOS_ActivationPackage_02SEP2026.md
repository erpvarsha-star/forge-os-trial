# ForgeOS Activation Package
**Prepared by CODE (Claude Code) — 02 Sep 2026**
**For: Yash Munot (VFL1001) — Owner, Varsha Forgings Pvt Ltd**

This is a complete, step-by-step activation guide for the 4 remaining deploy blockers
and the 5-step physical device verification checklist. Execute in order — each step
is a dependency for the ones that follow.

---

## STATUS BEFORE YOU START

| What | Branch | Status |
|---|---|---|
| Schema (FINAL_SCHEMA through PATCH_18) | — | ✅ Live |
| 129 employees + PIN auth (PATCH_10–12) | — | ✅ Live |
| FCM v1 direct push wiring | — | ✅ Code deployed |
| Shifts seed (PATCH_23) | PR #2 merged 1 Sep | ✅ Live |
| `plant_locations` multi-point geofence | **⏳ PATCH_21+22 not run** | 🔴 BLOCKING |
| `FCM_SERVICE_ACCOUNT_JSON` secret | **⏳ Not set** | 🔴 Push dead |
| ALERT.gs → Script Properties | **⏳ Not pasted** | 🔴 Telegram silent |
| Telegram bot token | **⏳ Not in Script Properties** | 🔴 No DMs |
| PATCH_19 (Maintenance/HR/VMC forms) | **⏳ Not run** | 🟡 Forms incomplete |
| PATCH_20 (Missing crons) | **⏳ Not run** | 🟡 Scoring/MRM won't fire |

Complete the 4 blocking items before running the device test. PATCH_19 and PATCH_20
can wait until after device verification if you want to test immediately.

---

## BLOCKER 1 — Multi-Point Geofence SQL

**File**: `scripts/COMBINED_DEPLOY_21to22_13Aug2026.sql`
**Branch**: `claude/forge-os-backend-setup-7woj4t`
**Expected result**: `plant_locations` table created and seeded with 12 campus points.

### What this does

Without this, check-in validity still uses the old **single-point** `plant_config` geofence
(100m radius around 19.836079, 75.236261). This is fine for the main gate area but blocks
employees checking in from Machine Shop (131m away) and other peripheral locations.

After running, `worker/home.tsx` and `fraud-detector` read from `plant_locations` first —
check-in is valid if within radius of **any** of the 12 points — and fall back to the
single-point only when the table is empty.

### Steps

1. Open Supabase Dashboard → `odfwtdpvpfzdrznvurru` → **SQL Editor**
2. Click **New query**
3. In repo: open `scripts/COMBINED_DEPLOY_21to22_13Aug2026.sql`, copy entire contents
4. Paste into SQL Editor, click **Run**
5. Verify output — you should see:

```
CREATE TABLE
INSERT 0 12
```

### Verification query (run immediately after)

```sql
SELECT name, latitude, longitude, radius_meters, is_active
FROM plant_locations
ORDER BY name;
```

Expected: **12 rows** including:
- Cutting Shop
- Die Shop
- Final Shop
- Forge Shop
- Heat Treatment
- Machine Shop
- Office 1st Floor
- Plant location
- Press Shop
- Raw Material
- Store
- VMC Shop

⚠️ **Known issue to flag to Yash**: "Cutting Shop" and "Final Shop" were received with
identical coordinates in the source sheet. Both are seeded as given — harmless, but
double-check the source sheet for a copy-paste slip. If coordinates differ, run:

```sql
UPDATE plant_locations SET latitude = <correct>, longitude = <correct>
WHERE name = 'Cutting Shop';  -- or 'Final Shop'
```

---

## BLOCKER 2 — FCM Push Notification Secret

**Where**: Supabase Dashboard → Edge Functions → Secrets
**Secret name**: `FCM_SERVICE_ACCOUNT_JSON`
**Without this**: Push notifications are silently skipped. In-app bell still works.
All 4 push-dependent edge functions (`shift-reminder`, `fraud-detector`, `mrm-reminder`,
`send-push-notification`) log a warning and continue without crashing.

### Step 1 — Download the Firebase service account JSON

1. Go to [Firebase Console](https://console.firebase.google.com) → project `gen-lang-client-0072991718`
2. Click the **gear icon** (top-left, next to "Project Overview") → **Project settings**
3. Click the **Service accounts** tab
4. Under "Firebase Admin SDK", click **Generate new private key**
5. Confirm the dialog → a JSON file downloads to your computer

The JSON looks like this (values will be different — do NOT use this example):
```json
{
  "type": "service_account",
  "project_id": "gen-lang-client-0072991718",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@gen-lang-client-0072991718.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/..."
}
```

### Step 2 — Paste into Supabase Edge Function Secrets

1. Open Supabase Dashboard → project `odfwtdpvpfzdrznvurru`
2. Left sidebar → **Project Settings** (gear icon at bottom) → **Edge Functions**
3. Scroll to **Secrets** section → click **Add new secret**
4. **Name**: `FCM_SERVICE_ACCOUNT_JSON` (exact spelling, case-sensitive)
5. **Value**: Open the downloaded JSON file in Notepad/TextEdit, select all, copy, paste the entire content
   - ⚠️ Do NOT wrap it in quotes
   - ⚠️ Do NOT add any extra characters — paste the raw JSON exactly as it is
6. Click **Save**

### Step 3 — Delete the downloaded file

After confirming the secret saved:
- Delete the JSON file from your Downloads folder
- Empty the Recycle Bin / Trash
- This file contains a private key — do not email it, WhatsApp it, or leave it on the desktop

### Step 4 — Verify push is working

After setting the secret and testing Telegram (Blocker 4), trigger a push notification:

```sql
-- In Supabase SQL Editor — sends a test notification to VFL1001 (Yash)
SELECT net.http_post(
  url := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/send-push-notification',
  headers := '{"Authorization": "Bearer <service_role_key>", "Content-Type": "application/json"}',
  body := '{"employee_ids": ["<your_employee_uuid>"], "title": "Test", "body": "Push working!"}'
);
```

Replace `<service_role_key>` with your Supabase service role key and `<your_employee_uuid>`
with your UUID from the `employees` table. Check your phone — the notification should arrive
within ~10 seconds.

---

## BLOCKER 3 — ALERT.gs Setup in Apps Script

**Script file**: `scripts/ALERT.gs` (in repo branch `claude/forge-os-backend-setup-7woj4t`)
**Target**: The Apps Script project bound to **VFPL Operations Dashboard 2026-27**
(Sheet ID: `1GHdhrRtOhQFshsAOCK4n3GiJp-6a03k8bn0V_M04wSY`)

### Step 1 — Open the bound Apps Script project

1. Open the Operations Dashboard Google Sheet
2. Menu: **Extensions** → **Apps Script**
3. The script editor opens. You should see files in the left panel including `Code.gs`

### Step 2 — Replace ALERT.gs content

1. In the left panel, click `ALERT.gs` (or create it if missing: click `+` → Script)
2. Select all existing content in `ALERT.gs` (Ctrl+A)
3. In the repo, open `scripts/ALERT.gs` — copy the entire file
4. Paste into the Apps Script editor, replacing the old content
5. Click **Save** (floppy disk icon or Ctrl+S)

⚠️ **Do NOT change**:
- `var TELEGRAM_BOT_TOKEN_INLINE = '';` — leave the quotes empty, token goes in Script Properties (Step 3)
- `var SUPABASE_SERVICE_ROLE_KEY_INLINE = '';` — same, key goes in Script Properties
- `var TELEGRAM_BOT_TOKEN_INLINE` and `var SUPABASE_SERVICE_ROLE_KEY_INLINE` in git must stay blank — if you accidentally paste keys here, the next git push will commit them permanently into history

### Step 3 — Set Script Properties (secrets)

1. In Apps Script editor: **Project Settings** (gear icon, left panel)
2. Scroll to **Script Properties** → click **Edit script properties**
3. Add these 3 properties:

| Property | Value |
|---|---|
| `SUPABASE_URL` | `https://odfwtdpvpfzdrznvurru.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (starts with `eyJ...`) |
| `TELEGRAM_BOT_TOKEN` | Your `@Form_mgr_bot` token from @BotFather (format: `1234567890:ABCdef...`) |

4. Click **Save script properties**

### Step 4 — Deploy triggers

1. In the editor, click the function dropdown (top toolbar) → select `deployShiftTrackingTriggers`
2. Click **Run** (triangle button)
3. If prompted for permissions: **Review permissions** → Choose your Google account → **Allow**
4. Check the execution log (bottom panel) — it should say:
   - Deleted old triggers (if any existed)
   - Created `runShiftAlerts15min_`
   - Created `runDailyMaintenance_`
   - Total: **2 triggers created**

Verify: **Triggers** (alarm clock icon, left panel) → you should see exactly 2 triggers,
not the old 15. If you see more, something from Code.gs triggers is showing — that's
fine, those belong to Code.gs. The point is ALERT.gs itself created only 2 new ones.

### Step 5 — Test Supabase connection

1. Function dropdown → select `testSupabaseSync`
2. Click **Run**
3. Execution log should show a successful HTTP response (status 200) from Supabase
4. If you see `401 Unauthorized`: check `SUPABASE_SERVICE_ROLE_KEY` in Script Properties
5. If you see `SUPABASE_URL not set`: the property name has a typo — check exact spelling

---

## BLOCKER 4 — Telegram Bot Token Placement + Onboarding

**Bot**: `@Form_mgr_bot` (created 13 Aug 2026 via @BotFather)
**Note**: The token lives ONLY in Script Properties (set in Blocker 3, Step 3 above).
It must NEVER go in the `ALERT.gs` file that is committed to git.

### If you no longer have the bot token

If you lost the `@Form_mgr_bot` token from 13 Aug:

1. Open Telegram → search `@BotFather`
2. Send: `/mybots`
3. Select `@Form_mgr_bot`
4. Click **API Token** → copy the token

If the bot no longer exists:
1. Open Telegram → search `@BotFather`
2. Send: `/newbot`
3. Name: `ForgeOS Forms Manager` (or similar)
4. Username: must end in `bot` — try `ForgeOS_Forms_Bot` or `VFPLFormsBot`
5. BotFather sends the token — copy it immediately

Paste into Script Properties as `TELEGRAM_BOT_TOKEN` (Blocker 3, Step 3).

### Supervisor onboarding (so DMs reach supervisors)

Each supervisor needs to message the bot once — this registers their Telegram chat ID
in the SUPERVISOR_MAP sheet so the bot knows where to send DMs.

**Instructions to forward to supervisors via WhatsApp:**

> "To receive form reminders on Telegram:
> 1. Open Telegram
> 2. Search for @Form_mgr_bot
> 3. Click START
> 4. Type your full name exactly as it appears on your ID card
> The bot will confirm your registration."

The `processTelegramOnboarding()` function (runs every 5 minutes via the deployed trigger)
matches the message to the SUPERVISOR_MAP. It requires an **exact, unique name match** —
if a name returns zero or multiple matches, it logs the error and skips (never guesses).

### Your own Telegram registration (owner/plant-wide reports)

1. Message `@Form_mgr_bot` on Telegram
2. Type: `Yash Munot` (or `owner`)
3. The bot sets `OWNER_TELEGRAM_CHAT_ID` in Script Properties automatically
4. After this, daily summary reports and escalation alerts go to YOUR Telegram

### Verify the bot is live

After setting the token in Script Properties:
1. In Apps Script editor, function dropdown → `processTelegramOnboarding`
2. Click **Run**
3. Execution log should show: `Polling @Form_mgr_bot for new messages...`
4. No errors = bot token is valid and the connection works

---

## STEP 5 — Physical Device Test Checklist

**Do this after all 4 blockers above are complete.**
**Device**: Any Android phone with the latest APK installed.
APK link: `https://github.com/erpvarsha-star/forge-os-trial/releases/latest/download/app-release.apk`

### Test 1 — Photo Capture (5S + Maintenance)

**Expected**: Photos upload to Supabase `submission-photos` storage bucket.

1. Log in as a worker (e.g., emp code + PIN)
2. Navigate to **5S** tab
3. Tap the camera button → take a photo → submit
4. In Supabase Dashboard → **Storage** → `submission-photos` bucket:
   - You should see a new file uploaded with timestamp
5. Repeat for **Maintenance Observation** tab
6. ✅ Pass: file appears in bucket | ❌ Fail: bucket is empty or error shown

### Test 2 — GPS / Geofence Check-In

**Expected**: Check-in valid from within any of 12 campus locations, blocked outside campus.

**From inside campus:**
1. Log in as worker
2. Tap **Check In** (GPS) on home screen
3. App should show "Check-in recorded" (green confirmation)
4. In Supabase: `attendance_records` table → new row with `status = 'P'` and today's date

**From outside campus (use a mobile hotspot, not the plant WiFi):**
1. Enable Location on the test phone
2. Move 500m+ outside plant boundary (or disable GPS and use a mock location app)
3. Tap **Check In**
4. App should show "You are not within the plant area" (red error)

⚠️ If you ran COMBINED_DEPLOY_21to22 (Blocker 1), check-in is valid from any of 12 points.
If Machine Shop workers report "outside campus" even when inside, verify their GPS is on.

### Test 3 — Push Notification

**Expected**: Notification arrives in the phone's notification tray, not just the in-app bell.

1. In Supabase SQL Editor, trigger a leave approval notification:
```sql
-- Approve a pending leave request (or create a test one)
UPDATE leave_requests SET status = 'approved' WHERE status = 'pending' LIMIT 1;
```
OR trigger directly via edge function (see Blocker 2, Step 4 above).

2. Check the test phone — a notification should appear in the system tray within 30 seconds
3. Tap the notification — it should open the app and navigate to the relevant screen
4. ✅ Pass: notification in tray | ❌ Fail: only bell icon lights up, no system notification

If push doesn't arrive:
- Confirm `FCM_SERVICE_ACCOUNT_JSON` is set in Supabase → Edge Functions → Secrets
- Confirm the employee has `push_tokens` rows (they appear after login on a real device)
- Check Supabase → Edge Functions → `send-push-notification` → Logs for errors

### Test 4 — Nightly Scoring

**Expected**: `monthly_scores` row updated for an employee after a day of attendance + form submissions.

1. Ensure the test employee has: at least one `attendance_records` row for today, one `5s_submissions` row
2. In Supabase SQL Editor, manually invoke nightly scoring:
```sql
SELECT net.http_post(
  url := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/nightly-scoring',
  headers := '{"Authorization": "Bearer <service_role_key>", "Content-Type": "application/json"}',
  body := '{}'
);
```
3. Wait 10-15 seconds, then check:
```sql
SELECT emp_code, on_time_score, task_completion_score, five_s_score
FROM monthly_scores
WHERE month = TO_CHAR(NOW(), 'YYYY-MM')
ORDER BY updated_at DESC
LIMIT 10;
```
4. ✅ Pass: rows present with non-zero scores | ❌ Fail: empty or function errors

Check edge function logs: Supabase → Edge Functions → `nightly-scoring` → Logs

### Test 5 — Manager Report View

**Expected**: Manager sees department-scoped data (not all departments, not an empty screen).

1. Log in as a manager:
   - VFL1545 (Mujahed Ahmed — manager) — emp code: VFL1545, PIN starts as `154515` → forced change on first login
   - OR VFL1389 (Tushar — manager) — PIN starts as `138913`
2. Navigate to **Reports** tab
3. Verify the report shows data for their department ONLY
4. Navigate to **Dashboard** — should show department attendance %, not plant-wide
5. Tap **Approvals** — should show leave/advance requests from their department members only

If you see "empty" reports: check that the manager's `department` field in `employees` matches
actual employee `department` fields exactly (same spelling — 'Heat Treatment', not 'HT').

If you see ALL departments: the RLS policy on the `manager` role is not filtering correctly —
check PATCH_12 was applied (`COMBINED_DEPLOY_11to12_11Aug2026.sql`, confirmed by Yash 11 Aug).

---

## OPTIONAL — Run Remaining Patches (after device tests pass)

### PATCH_19 — Maintenance/HR/VMC Forms

**File**: `scripts/PATCH_19_dept_expansion_13Aug2026.sql`
**Adds**: 7 more form_links rows (Maintenance check sheet, electricity logs, oil log, HR manpower forms, VMC daily form)
**Run**: Supabase SQL Editor → New query → paste → Run
**Expected**: `INSERT 0 7`

### PATCH_20 — Missing Crons

**File**: `scripts/PATCH_20_missing_crons_13Aug2026.sql`
**Adds**: pg_cron schedules for `nightly-scoring`, `mrm-reminder`, `five-s-challenge-generator`, shift-reminder (default mode), and `mrm-reminder-escalation` (10th at 17:00 IST)
**Run**: Supabase SQL Editor → New query → paste → Run

⚠️ Before running PATCH_20: check Supabase Dashboard → **Database** → **Extensions** → confirm `pg_cron` is enabled. If not, enable it first.

After running, verify:
```sql
SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
```
You should see 5+ new jobs added.

---

## SUMMARY — Yash's Execution Checklist

| # | Action | Where | Time |
|---|---|---|---|
| 1 | Run `COMBINED_DEPLOY_21to22_13Aug2026.sql` | Supabase SQL Editor | 5 min |
| 2 | Download Firebase service account JSON | Firebase Console | 5 min |
| 3 | Paste JSON as `FCM_SERVICE_ACCOUNT_JSON` | Supabase → Edge Functions → Secrets | 2 min |
| 4 | Delete downloaded JSON from Downloads | Your computer | 1 min |
| 5 | Open ALERT.gs in Apps Script | Operations Dashboard → Extensions | 2 min |
| 6 | Replace ALERT.gs content from repo | Apps Script editor | 5 min |
| 7 | Add 3 Script Properties (URL, key, token) | Apps Script → Project Settings | 5 min |
| 8 | Run `deployShiftTrackingTriggers()` | Apps Script editor | 2 min |
| 9 | Run `testSupabaseSync()` | Apps Script editor | 1 min |
| 10 | Message `@Form_mgr_bot` with "Yash Munot" | Telegram | 1 min |
| 11 | Physical Device Test 1 — Photo capture | Test phone | 5 min |
| 12 | Physical Device Test 2 — GPS check-in | On campus + outside | 10 min |
| 13 | Physical Device Test 3 — Push notification | Test phone | 5 min |
| 14 | Physical Device Test 4 — Scoring | Supabase SQL Editor | 5 min |
| 15 | Physical Device Test 5 — Manager view | Test phone (manager login) | 5 min |
| 16 | Run PATCH_19 (optional, after tests pass) | Supabase SQL Editor | 2 min |
| 17 | Run PATCH_20 (optional, after tests pass) | Supabase SQL Editor | 2 min |

**Total estimated time: 60 minutes**

---

## CONTACTS AND REFERENCES

- **Supabase project**: `https://odfwtdpvpfzdrznvurru.supabase.co`
- **Firebase project**: `gen-lang-client-0072991718`
- **Telegram bot**: `@Form_mgr_bot`
- **Repo branch**: `claude/forge-os-backend-setup-7woj4t`
- **APK download**: `https://github.com/erpvarsha-star/forge-os-trial/releases/latest/download/app-release.apk`
- **Operations Dashboard Sheet ID**: `1GHdhrRtOhQFshsAOCK4n3GiJp-6a03k8bn0V_M04wSY`
- **Expo project**: `@erp.varsha/forge-os`

---

*Generated by CODE (Claude Code) — 02 Sep 2026*
*For questions: resume the Claude Code session or tag CODE in the council thread*
