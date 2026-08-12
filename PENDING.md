# Forge OS — Pending Work Tracker

Living checklist. Updated at the end of every work session, before the final
push. `[x]` only when verified, not merely written.

**Last updated:** 11 Aug 2026, after build 23.

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
- **Shift master**: S1 08:30-15:30, S2 15:30-23:30, S3 23:30-08:30, 60 min break, 15 min grace

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

## 🎯 NEXT BUILD — form-compliance scoring + reminders (defined 12 Aug)

**The score is about filling the form on time for your shift** — not production
output. That is a different feature from anything currently built, and it replaces
my earlier guess that scoring should track production quantity.

What it needs:

1. **Responsibility roster** — who must fill which department's form, per shift.
   Many-to-many (Todmal → Cutting + HT; Ashok Sharma → Cutting). The dashboard's
   first tab already captures this weekly (Department, Supervisor Name, Phone,
   Telegram Chat ID, Week Start Sat → Week End Thu), which also solves the
   long-standing "rotating supervisor" problem listed further down.
2. **Expected-submission schedule** — one row per (responsible person, department,
   shift, date) that is due.
3. **Actual submissions** — imported from the Forms/Sheet, matched to the expected
   row, with the submission timestamp.
4. **On-time determination** — submitted before the shift's end
   (S1 15:30, S2 23:30, S3 08:30 next day), using the 15-min grace already in the
   shift master.
5. **Scoring** — feeds `monthly_scores`. Replaces the removed production component
   for supervisors with something they actually control.
6. **In-app pending count** — a badge/count of forms due-but-not-submitted.
7. **Telegram escalation** — final reminder only, after in-app is ignored.

⚠ Open questions blocking the build are in the decisions section above.

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
