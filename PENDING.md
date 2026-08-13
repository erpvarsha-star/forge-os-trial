# Forge OS — Pending Work Tracker

Living checklist. Updated at the end of every work session, before the final
push. `[x]` only when verified, not merely written.

**Last updated:** 13 Aug 2026, after Maintenance/HR/VMC department expansion, the Saturday week-start fix, the gate-QR screen and Telegram onboarding.

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

- [ ] **Firebase / FCM — HALF DONE 13 Aug.** `google-services.json` is in and
      wired into `app.json`; the remaining half is the FCM V1 service account
      key, which only Yash can upload (it is a secret and must not pass through
      chat): Firebase → Project Settings → Service accounts → Generate new
      private key → upload at expo.dev → forge-os → Credentials → Android.
      SUPERSEDED 13 Aug — Expo is out of the push path. The server now sends
      to FCM v1 directly (`supabase/functions/_shared/fcm.ts`), so no Expo
      credentials and no keystore wizard are involved. What remains is one
      paste: Supabase → Edge Functions → Secrets → `FCM_SERVICE_ACCOUNT_JSON`.
      Reinstall is still required, because the Firebase config and the native
      token request are compiled in at build time.

      Original note:
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
- [x] **RESOLVED 13 Aug — verified against the live registry, not guessed.**
      Electricity + Oil are Maintenance-department forms (4 real Daily forms:
      check sheet + 2 electricity forms + oil). Both manpower forms are listed
      under Security AND HR Dept in the registry (same 2 forms, different
      responsible people) — marked "As & When Required" by the registry
      itself, not Daily. `PATCH_19_dept_expansion_13Aug2026.sql` seeds all of
      it into `form_links`; ALERT.gs's `DEPT_RESPONSIBILITY_FALLBACK` routes
      compliance-supervisor lookups for the 4 pseudo-departments to
      Maintenance / Security / HR. Also added: VMC Shop's real "VMC Daily
      check sheet" form — this is the VMC per-shift output tracking asked
      for. ⚠ VMC has no RAW tab on the dashboard yet (checked — genuinely
      absent), so it gets the form + reminder but not on-time/late/missing
      compliance tracking until one exists.
- [x] **RESOLVED 13 Aug.** Yash: the work week is Saturday-to-Thursday,
      Friday off, "unless we have urgent production Friday is working — 90% of
      the time Friday is off." Matches the live form exactly. Fixed on both
      ends: `weekStartFor_()` in ALERT.gs now computes Saturday (was Monday),
      and `shift-reminder`'s weekly notify window is now Saturday-Thursday
      (was Monday-Sunday — this one is real app code, not just the dashboard
      script, and was simply wrong before). The prefix-match column fix from
      12 Aug already made `processFormSubmissions()` work with the Saturday
      header regardless. No schema change needed for the Friday exception
      itself — `employee_shifts` is already per-date, so a working Friday is
      just a Friday HR assigns shifts for.
- [x] **Phone numbers — CLOSED 12 Aug.** Yash: "you dont need phone numbers."
      Not asked for again.

- [ ] **Several `SUPERVISOR_MAP` rows still have a blank Telegram Chat ID**
      (e.g. Pravin Sonavane, Machine). The onboarding flow (13 Aug) is the fix
      — they message @Form_mgr_bot with their name and it fills in
      automatically — but nobody has done it yet. *Correction to what this
      line said before: there is no group-chat fallback.* When a supervisor
      has no chat ID, `sendGentleReminder` now tells the OWNER directly
      instead ("no Telegram registered for X"), not a group. Lower stakes
      regardless, now that the in-app Forms tab is a second route needing no
      chat ID at all.

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
- [ ] **Cron entry for `forms_due_reminder`** — now a SQL file rather than a
      dashboard click: `scripts/PATCH_18_forms_reminder_cron_13Aug2026.sql`.
      One blank to fill (the key) and run. Without it the reminder is built,
      deployed and never fires.
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
- [x] **Telegram onboarding — BUILT 13 Aug.** `processTelegramOnboarding()`
      in ALERT.gs polls the bot every 5 minutes; a supervisor messages their
      name, it's matched against this week's SUPERVISOR_MAP and the chat ID is
      written in automatically — no more typing a Telegram numeric ID into the
      registration form by hand. Matching is deliberately conservative: exactly
      one name match required, or it's logged and skipped, never guessed.
      Owner uses the SAME flow — message the bot with "Yash Munot" (or
      "owner") and it sets `OWNER_TELEGRAM_CHAT_ID` instead of a sheet row.
      **New bot created 13 Aug** — @Form_mgr_bot, token in `TELEGRAM_BOT_TOKEN`.

- [x] **`sendTelegramAlert()` DID NOT EXIST — found and fixed 13 Aug.** Called
      from 7 places (sendGentleReminder's fallback, sendDMEDeadlineAlert,
      sendFollowUpAlert, sendDailySummary, 2 registration confirmations) and
      defined nowhere. Every call threw `ReferenceError`. Worse than one
      broken alert: Apps Script does not catch a throw inside a `forEach`
      callback, so in `sendGentleReminder()` the first department with no
      registered chat ID (which, before today, was every department) killed
      every department AFTER it in that same run too — even ones with a
      working chat ID. `sendDMEDeadlineAlert`/`sendFollowUpAlert`/
      `sendDailySummary` called it unconditionally, so those three have never
      delivered a single message, ever.
      Fixed by defining it: it now delivers to `OWNER_TELEGRAM_CHAT_ID`. Those
      three functions already compose a plant-wide, every-department report —
      that's what "an entire report" was always going to be — so no new
      report format was needed, just a working delivery path. Individual
      per-supervisor reminders (`sendGentleReminder`) also hardened with a
      per-department `try`/`catch` so this class of bug cannot recur.
      Verified with isolated Node tests, not just the syntax check: confirmed
      `sendTelegramAlert` no-ops (does not throw) with no owner registered,
      delivers correctly once one is, and that a chat-id-less department no
      longer blocks the departments after it.

- [x] **"Too many triggers" — found the real cause and fixed 13 Aug.** Not an
      ALERT.gs bug on its own: this script shares its Apps Script PROJECT
      (and therefore its 20-trigger-per-project quota) with `Code.gs`, the
      Operations Dashboard's own pull/alert script, which Yash pasted in for
      review. Code.gs already runs 11 triggers of its own (6 `runDashboardPull`
      + 4 `checkShiftEnd_*` + 1 `refreshCache15min`). `deployShiftTrackingTriggers()`
      used to create 15 more — 26 total, over Google's ceiling.
      Every alert function already no-ops safely when there is nothing to do
      right now (`getShiftToCheck_()` returns null outside a shift's window),
      so the fix was fewer triggers, not different code: `deployShiftTrackingTriggers()`
      now creates exactly 2 — `runShiftAlerts15min_()` (everything shift-
      boundary-shaped, every 15 min) and `runDailyMaintenance_()` (everything
      end-of-day-shaped, once daily). 2 + Code.gs's 11 = 13, comfortable
      headroom rather than sitting on the ceiling. Verified in Node: exactly 2
      triggers created, and the deletion pass — which only ever removes
      ALERT.gs's own stale trigger names — never touches `runDashboardPull`,
      `checkShiftEnd_*`, or `refreshCache15min`.

- [x] **Telegram token — inline slot added 13 Aug, same pattern as Supabase's.**
      `TELEGRAM_BOT_TOKEN_INLINE` and `OWNER_TELEGRAM_CHAT_ID_INLINE` at the top
      of the file, both blank in git for the same reason `SUPABASE_SERVICE_ROLE_KEY_INLINE`
      is: a live bot token lets anyone send as the bot and read everything sent
      to it, and a secret committed once is in the repository's history
      permanently even after a later commit removes it. Paste the token and
      (optionally) your numeric chat id into the LIVE Apps Script copy only —
      Script Properties still win if set there instead. Verified in Node: both
      inline values are used when no Script Properties are set, and Script
      Properties correctly override them when present.

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

- [x] **QR check-in secret — CONFIRMED SET 13 Aug.** `is_set=true, length=48`.
- [x] **QR gate mechanism — DECIDED 13 Aug ("a+c").** Build the real display
      (a) while accepting the current loose check as an interim gap (c), not
      removing it until (a) is proven in daily use. `app/(security)/gate-qr.tsx`
      now shows the real salted daily code on the guard's phone (new
      `react-native-qrcode-svg` dependency, no native module — just SVG,
      matching `react-native-svg` already in the project). `worker/home.tsx`'s
      loose match (accepts anything merely containing the plant code, ignoring
      the salt) is UNCHANGED and now explicitly documented in code as
      deliberate, not forgotten — removing it before gate-qr.tsx is actually in
      use at the gate would lock out all 129 people at shift change. Next step:
      confirm gate-qr.tsx is working at the gate, then drop the loose branch in
      qr.tsx.
- [x] **Alert copy in Hindi — VERIFIED DONE 12 Aug.** All 38 `Alert.alert()`
      calls already use `t()`. Audited properly with `scripts/check-i18n.mjs`:
      Hindi covers 100% of English, and one key used on two dashboards
      (`common.overview`) had no entry at all — it was rendering the literal
      text "common.overview" as a section heading. Now added.
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
