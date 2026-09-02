# ForgeOS Activation Runbook — 02 Sep 2026

**Project**: Varsha Forgings Pvt Ltd — Forge OS  
**Supabase Ref**: `odfwtdpvpfzdrznvurru`  
**Prepared by**: CODE (Claude Code Agent)  
**Status**: READY TO RUN — 4 blockers, each ~5 minutes

---

## OVERVIEW

Four blockers prevent ForgeOS from going fully live. Each section below is
self-contained. Run them in order. Estimated total time: **25–30 minutes**.

| # | Blocker | Time |
|---|---------|------|
| A | Multi-point geofence SQL (COMBINED_DEPLOY_21to22) | 5 min |
| B | FCM push notification secret | 5 min |
| C | ALERT.gs paste into Apps Script | 10 min |
| D | Telegram @Form_mgr_bot token | 5 min |

---

## A — SQL MIGRATION: Multi-Point Geofence

**File**: `scripts/COMBINED_DEPLOY_21to22_13Aug2026.sql`  
**What it does**: Creates 12 campus check-in points (replaces single 100m circle).  
**Risk**: LOW — app already falls back to old geofence if table is empty; this is additive only.

### Pre-flight (30 seconds)

Run in Supabase SQL Editor → **New Query**:

```sql
-- Confirm PATCH_21/22 are NOT yet run
SELECT COUNT(*) AS location_count FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'plant_locations';
-- Expected: 0  (table does not exist yet)
-- If 1: table exists — check row count before re-running
```

```sql
-- Confirm other patches are in place (attendance_records must exist)
SELECT COUNT(*) FROM attendance_records LIMIT 1;
-- Expected: any number — confirms FINAL_SCHEMA is applied
```

### Rollback (if needed — run BEFORE the migration)

```sql
-- Snapshot current plant_config geofence settings (for reference only)
SELECT key, value FROM plant_config
WHERE key IN ('plant_lat','plant_lng','geofence_radius_meters');
```

If something goes wrong after running, rollback is:

```sql
DROP TABLE IF EXISTS plant_locations CASCADE;
-- This re-enables the old single-point fallback — no other changes needed
```

### Run the migration

1. Open **Supabase Dashboard** → `odfwtdpvpfzdrznvurru` → **SQL Editor**
2. Click **New query**
3. Paste the entire contents of `scripts/COMBINED_DEPLOY_21to22_13Aug2026.sql`
4. Click **Run** (Ctrl+Enter)

### Expected output (verify each line)

```
plant_locations table created, 0 rows (expected — see header comment)   | 0
```
Then immediately after (PATCH_22):
```
 name             | latitude    | longitude   | radius_meters | is_active
 Cutting shop     | 19.836111   | 75.236750   | 100           | true
 Die shop         | 19.836139   | 75.236611   | 100           | true
 Final Shop       | 19.836111   | 75.236750   | 100           | true
 Forge shop       | 19.836306   | 75.236500   | 100           | true
 HT shop          | 19.836139   | 75.236556   | 100           | true
 Machine shop     | 19.835944   | 75.237472   | 100           | true
 Office 1st Floor | 19.835928   | 75.236184   | 100           | true
 Plant location   | 19.836056   | 75.236222   | 100           | true
 Press Shop       | 19.836222   | 75.236444   | 100           | true
 Raw Material     | 19.836083   | 75.236833   | 100           | true
 Store            | 19.836109   | 75.236702   | 100           | true
 VMC shop         | 19.836167   | 75.236472   | 100           | true
```
**12 rows total.** If you see fewer, check for a unique-constraint error on "Cutting shop"/"Final Shop" (same coordinates — harmless, but worth flagging to Yash).

### Post-run confirm

```sql
SELECT COUNT(*) FROM plant_locations WHERE is_active = true;
-- Expected: 12
```

---

## B — FCM Push Notification Secret

**What it does**: Enables Android push notifications via Firebase Cloud Messaging.  
Without this, in-app notifications work but no push is delivered to phones.

### Step 1 — Generate Firebase Service Account Key

1. Go to **Firebase Console** → [console.firebase.google.com](https://console.firebase.google.com)
2. Select project: `gen-lang-client-0072991718` (package `com.vfpl.forgeos`)
3. Click **Project Settings** (gear icon) → **Service accounts** tab
4. Click **Generate new private key** → **Generate key**
5. A `.json` file downloads automatically (e.g. `gen-lang-client-0072991718-firebase-adminsdk-*.json`)

### Step 2 — Paste into Supabase

1. Open **Supabase Dashboard** → `odfwtdpvpfzdrznvurru`
2. Left sidebar → **Edge Functions** → **Secrets**
3. Click **Add new secret**
4. Name: `FCM_SERVICE_ACCOUNT_JSON`
5. Value: **paste the entire contents** of the downloaded `.json` file (all of it, including the outer `{ }`)
6. Click **Save**

### Step 3 — Delete the downloaded file

The `.json` file is a private key. After pasting:

```
Right-click the downloaded file → Move to Trash → Empty Trash
```

**Never commit this file to git. Never paste it into chat.**

### Verify

After the next employee check-in attempt, open Supabase Dashboard → **Edge Functions** → `send-push-notification` → **Logs**. You should see `FCM token sent` (or similar) instead of `FCM_SERVICE_ACCOUNT_JSON not set — push skipped`.

---

## C — ALERT.gs: Apps Script Setup

**File**: `scripts/ALERT.gs` in this repo  
**What it does**: Sends shift-form reminders and daily summaries to supervisors via Telegram.

### Step 1 — Open Apps Script

1. Open the **Operations Dashboard** Google Sheet (`1GHdhrRtOhQFshsAOCK4n3GiJp-6a03k8bn0V_M04wSY`)
2. **Extensions** → **Apps Script**
3. In the left panel, click the file currently named `ALERT` (or create it)

### Step 2 — Paste the script

Copy the entire contents of `scripts/ALERT.gs` from this repo and paste it into the Apps Script editor, replacing everything.

**Required variables to fill in the LIVE copy only** (do NOT put real values in git):

```javascript
// Line ~6 in ALERT.gs — fill these in the live Apps Script editor ONLY:
var SUPABASE_SERVICE_ROLE_KEY_INLINE = '[YASH_FILLS_THIS]';
// ↑ Get from Supabase Dashboard → Project Settings → API → service_role key
//   Starts with: eyJ...

var TELEGRAM_BOT_TOKEN_INLINE = '[YASH_FILLS_THIS]';
// ↑ Get from @BotFather — see Section D below
//   Format: 1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ

var OWNER_TELEGRAM_CHAT_ID_INLINE = '';
// ↑ Leave blank — you'll get this automatically after messaging @Form_mgr_bot
//   (the bot's onboarding flow writes it for you)
```

### Step 3 — Add Script Properties (alternative to inline paste)

Instead of pasting secrets inline, you can use Script Properties (more secure):

1. Apps Script → **Project Settings** (gear icon) → **Script Properties**
2. Add property: `SUPABASE_URL` = `https://odfwtdpvpfzdrznvurru.supabase.co`
3. Add property: `SUPABASE_SERVICE_ROLE_KEY` = `[your service role key]`
4. Add property: `TELEGRAM_BOT_TOKEN` = `[your bot token from Section D]`

Script Properties override the inline variables — the script checks Properties first.

### Step 4 — Test the Supabase connection

In Apps Script editor → **Run** → select `testSupabaseSync` → **Run**.  
Check **Executions** → should show "Completed" with no errors.

### Step 5 — Set up time triggers

Run `deployShiftTrackingTriggers()` once:
1. Apps Script editor → **Run** → select `deployShiftTrackingTriggers` → **Run**
2. Check **Triggers** (clock icon in left panel)
3. You should see exactly 2 triggers:
   - `runShiftAlerts15min_` — every 15 minutes
   - `runDailyMaintenance_` — daily (morning)

**Note**: This script shares the Apps Script project with `Code.gs` (the Operations Dashboard script), which has 11 triggers of its own. Total will be 13 — well within Google's 20-per-project limit.

---

## D — Telegram @Form_mgr_bot Setup

**Bot**: `@Form_mgr_bot` (created 13 Aug 2026)

### Step 1 — Get the bot token from @BotFather

If you need to retrieve the existing token (or create anew):

1. Open Telegram → search **@BotFather** → Start
2. Send: `/mybots`
3. Select: `ForgeOS Forms Manager` (`@Form_mgr_bot`)
4. Click **API Token** → copy the token shown

**Exact @BotFather command sequence for a NEW bot** (only if token is lost):
```
/start
/newbot
ForgeOS Forms Manager
ForgeOS_Forms_Bot
```
BotFather replies with the token. Copy it.

### Step 2 — Configure `telegram_config.json`

The file `telegram_config.json` in the repo root is a placeholder. In the **live Apps Script editor**, paste the token into `TELEGRAM_BOT_TOKEN_INLINE` (Section C above) or the `TELEGRAM_BOT_TOKEN` Script Property.

The `telegram_config.json` file in the repo shows the structure only — no real token in git:

```json
{
  "_comment": "Paste token into ALERT.gs TELEGRAM_BOT_TOKEN_INLINE or Script Properties. Never in git.",
  "bot_username": "@Form_mgr_bot",
  "bot_name": "ForgeOS Forms Manager",
  "token_location": "Apps Script Script Properties → TELEGRAM_BOT_TOKEN",
  "onboarding": "Each supervisor messages the bot with their name. Bot auto-matches and registers their chat_id.",
  "owner_onboarding": "Yash messages the bot with 'Yash Munot' or 'owner' to register OWNER_TELEGRAM_CHAT_ID."
}
```

### Step 3 — Supervisor onboarding

Once the token is pasted and `deployShiftTrackingTriggers()` is run, the bot polls every 5 minutes for supervisor registrations:

1. Tell each supervisor: "Message `@Form_mgr_bot` on Telegram with your full name"
2. The bot matches their name against this week's supervisor list (case-insensitive, exact match required)
3. Their chat ID is registered automatically — they'll receive a confirmation message
4. Yash: send `Yash Munot` (or `owner`) to register yourself for daily summary reports

---

## E — Device Test (Non-Technical Checklist)

Run after all four sections above are complete. Use one Android phone with the ForgeOS APK installed.

Download APK: `https://github.com/erpvarsha-star/forge-os-trial/releases/latest/download/app-release.apk`

**Step 1 — Login**
- Open app → enter employee code (e.g. `VFL1001`) + PIN (`001001` if never logged in before)
- Should reach Home screen without errors
- ✅ PASS if home screen loads | ❌ FAIL if login errors or blank screen

**Step 2 — GPS Check-in**
- On Home screen, tap "Check In"
- Allow location permission if prompted
- Should show "Check-in successful" (within campus) or "Outside geofence" (if tested from home)
- ✅ PASS if one of these two messages appears | ❌ FAIL if app crashes

**Step 3 — Push Notification**
- Ask Pallavi (HR Admin, VFL5440) to log in on another device
- From any management dashboard, trigger a test notification
- Or wait for the next shift reminder (runs every 15 min after ALERT.gs is set up)
- ✅ PASS if phone shows a notification | ❌ FAIL if nothing appears (FCM secret may not be set)

**Step 4 — Scoring**
- Log in as VFL1001 (Yash) → tap Score tab
- Should show composite score breakdown (On Time / Task / 5S)
- ✅ PASS if scores load | ❌ FAIL if empty or error (run `nightly-scoring` edge function manually once)

**Step 5 — Manager Report**
- Log in as a manager (e.g. plant_head VFL1386 Fazal)
- Dashboard → should show department attendance %
- ✅ PASS if data loads | ❌ FAIL if blank (check RLS — must be manager+ role)

---

## PENDING AFTER THIS RUNBOOK

| Item | Status |
|------|--------|
| PATCH_19 (Maintenance/HR/VMC forms) | ⏳ Not yet run |
| PATCH_20 (missing cron jobs) | ⏳ Not yet run |
| `FCM_SERVICE_ACCOUNT_JSON` Supabase secret | ⏳ Yash to paste after Section B |
| Supervisor Telegram onboarding | ⏳ After Section D |
| `shift-reminder` cron for `forms_due_reminder` mode | ⏳ In Supabase Dashboard (every 15 min, body `{"mode":"forms_due_reminder"}`) |

---

*Runbook generated by CODE (Claude Code Agent) | 02 Sep 2026 | Forge OS v1.0*
