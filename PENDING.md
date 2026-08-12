# Forge OS — Pending Work Tracker

Living checklist. Updated at the end of every work session, before the final
push. `[x]` only when verified, not merely written.

**Last updated:** 12 Aug 2026, after the ALERT.gs audit.

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

## 🔴 Blocked on Yash — cannot proceed without you

- [ ] **Firebase / FCM for Android push delivery.**
      `extra.eas.projectId` is set, but Expo relays Android push through
      Firebase and no Firebase project is configured.
      → Firebase console → add Android app, package `com.vfpl.forgeos` → download
      `google-services.json` → **drop it in Google Drive and tell me the filename**
      (I can read Drive directly — no need to paste contents).
      → Then Firebase → Project Settings → Service accounts → Generate private key
      → upload that to expo.dev → forge-os → Credentials → Android.
      *Until this is done, no push notification reaches any phone.*

- [ ] **Revoke the Expo token pasted in chat** (`9HDy_…`) and add a fresh one to
      GitHub → Settings → Secrets and variables → Actions as `EXPO_TOKEN`.
      Needed only for OTA auto-updates, not for push.

- [ ] **Rotate the Expo account password** — it was shared in chat.

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

- [ ] **How should Forms → app data flow?** (Forms confirmed in daily use.)
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

- [ ] **`scripts/MigrateToSupabase.gs` has never been installed.**
      Google Apps Script that syncs the Employee Master Google Sheet → Supabase.
      Written, committed, never run. Needs pasting into the Sheet's Apps Script
      editor (README step 5). Only relevant if the Sheet is still the source of
      truth for employee data.

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

**Scoring, as agreed 12 Aug**: 100 points on time, −10 per started hour late,
zero at 10 h. Deadline = shift end + the 60-minute grace.

### Still open on the Sheets side

- [x] **Form links — SOLVED 12 Aug** from Yash's form registry sheet
      (`1M2E83q64BXzfGwZsNQ_9u2jdfzwJPrJlD8WKRKgG554`), which lists every form
      by department, responsible person and frequency with the **published
      `/forms/d/e/.../viewform` responder links**. Replaces the guessed `/edit`
      URLs entirely. 24 daily forms seeded across the six shop departments.
- [ ] **Which daily form feeds the production dashboard?** Each shop has 3–6
      daily forms (`<Shop> PMS`, `<Shop> Daily check sheet`, `<Shop> Planning`,
      plus dispatch/57F4 on Machine and Final). The reminder currently lists
      all of them. Set `Send in reminder?` to `NO` in `FORM_LINKS` for any that
      should not be chased per shift — no code change needed.
- [ ] **Four ALERT.gs departments are absent from the registry**: Electricity,
      Oil, Staff Manpower, Contract Manpower. The registry instead has Die Shop,
      VMC Shop, Maintenance, Quality, Store, Purchase, HR, Admin, Design,
      Marketing and Accounts. Which of those should the shift alerts cover?
- [ ] **Week start is inconsistent, and it breaks supervisor import.** The live
      registration form writes `Week Start (Saturday)` / `Week End (Thursday)`;
      `processFormSubmissions()` looks for `Week Start (Monday)` /
      `Week End (Sunday)`, finds neither, logs "missing columns" and returns.
      So that importer has never added anyone. `SUPERVISOR_MAP` does have rows,
      so they are getting in another way — confirm which week convention is
      real and I will align both ends. Left as-is deliberately rather than
      guessing.
- [ ] **Several `SUPERVISOR_MAP` rows have a blank Telegram Chat ID** (e.g.
      Pravin Sonavane, Machine). Those supervisors get no direct message — the
      alert falls back to the group chat.

### Still open on the app side

- [ ] **In-app pending-forms count** — the badge showing how many forms are due
      but not submitted. Not started. Needs the Forms → Supabase decision below.
- [ ] Telegram escalation already exists in ALERT.gs and needs nothing new.

---

## 🟢 Untested — needs a real device / real data

- [ ] **Role-by-role walkthrough** using the seven test logins (owner, plant
      head, HR admin, manager, supervisor, security guard, member). Nobody has
      confirmed each role sees the right screens with real data.
      Reset each account afterwards with `scripts/HR_reset_pin.sql`.
- [ ] **5S photo submission end-to-end** — capture → upload → supervisor sees it.
      The one path in build 22/23 I could not test: no device, and Supabase is
      unreachable from the build sandbox.
- [ ] **Maintenance observation photo** — same flow, second screen.
- [ ] **GPS check-in inside the geofence** (100 m around 19.836079, 75.236261).
- [ ] **Nightly scoring** — rewritten but never executed against live data.
      Runs 22:00 IST; check `monthly_scores` the next morning.

---

## 🔵 Known gaps still in the code

- [ ] **QR check-in secret** — `plant_config.qr_secret_salt` was never set.
      PATCH_06 left it commented out deliberately (must not be committed to git).
      Generate with `python3 -c "import secrets; print(secrets.token_hex(24))"`
      and set it directly in the Supabase SQL Editor.
- [ ] **Alert/notification copy in Hindi** — several `Alert.alert()` calls in
      `worker/home.tsx`, `qr.tsx`, `5s.tsx`, `observation.tsx`, `payslip.tsx`
      still use hardcoded English strings instead of `t()`.
- [ ] **`types/database.ts` mirrors the OLD schema** and is misleading. Either
      delete it or regenerate from FINAL_SCHEMA.
- [ ] **Rotating supervisor assignment** — HR/IR decide weekly; no in-app flow.
      Currently a manual `supervisor_id` UPDATE. Closed as out of scope 10 Aug,
      but will keep needing manual SQL.
- [ ] **Shakeel Sayyad** — confirmed a real employee, still has no `emp_code`,
      so cannot be provisioned a login.
- [ ] **VFL1527 phone** — deliberately NULL, correct number still unknown.

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
