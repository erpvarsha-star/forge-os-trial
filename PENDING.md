# Forge OS — Pending Work Tracker

Living checklist. Updated at the end of every work session, before the final
push. `[x]` only when verified, not merely written.

**Last updated:** 12 Aug 2026, after the admin view-as and the plant dashboard.

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
- [x] **Phone numbers — CLOSED 12 Aug.** Yash: "you dont need phone numbers."
      Not asked for again.

- [ ] **Several `SUPERVISOR_MAP` rows have a blank Telegram Chat ID** (e.g.
      Pravin Sonavane, Machine). Those supervisors get no direct message — the
      alert falls back to the group chat. Lower stakes now that the in-app
      Forms tab exists as a second route.

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
- [ ] **Cron entry for `forms_due_reminder`** — needs adding in the Supabase
      dashboard: every 15 minutes, POST body `{"mode":"forms_due_reminder"}`.
      Mode inference deliberately never picks this one, so without the cron
      entry it never runs.
- [x] **Pending-forms status on the tab — BUILT 12 Aug.** Forms → Supabase went
      with option (a), the Apps Script push, as recommended. `syncOpsDashboardToSupabase()`
      in ALERT.gs pushes DATA_SUBMISSION_LOG into `form_submissions` every 15
      minutes, and the tab shows a submitted/pending chip per shift.
      ⚠ **Per shift, not per form** — the RAW tabs record that a department
      submitted for a shift, never which of its 3-6 daily forms it was. Per-form
      ticking needs each form's own response sheet wired up; not started.
- [x] **Department production on the dashboards — BUILT 12 Aug.**
      `production_records` (PATCH_15) + `components/ProductionSummary.tsx`,
      mounted on manager → Reports (scoped to their shop, grouped by machine)
      and owner → KPI (all shops). Renders nothing until the sync has run, so
      it is safe to ship before Yash sets the Script Properties.
- [ ] **Script Properties for the sync — THE REMAINING BLOCKER for both
      features above.** Apps Script editor → Project Settings → Script
      Properties → `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, then run
      `testSupabaseSync()` once. The SQL side is done; this is what actually
      moves data. The service role key must never be pasted into chat.
- [ ] Telegram escalation already exists in ALERT.gs and needs nothing new.

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

## 🔵 Known gaps still in the code

- [ ] **QR check-in secret** — `plant_config.qr_secret_salt` was never set.
      PATCH_06 left it commented out deliberately (must not be committed to git).
      Generate with `python3 -c "import secrets; print(secrets.token_hex(24))"`
      and set it directly in the Supabase SQL Editor.
- [ ] **Alert/notification copy in Hindi** — several `Alert.alert()` calls in
      `worker/home.tsx`, `qr.tsx`, `5s.tsx`, `observation.tsx`, `payslip.tsx`
      still use hardcoded English strings instead of `t()`.
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
