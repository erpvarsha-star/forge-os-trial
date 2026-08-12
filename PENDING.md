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

## 🟡 Needs a decision from Yash

- [ ] **Google Forms per department — is this actually wanted?**
      The README frames the app as the *replacement* for "disconnected Google
      Forms", and `supervisor/shift-report.tsx` → `data_collection_submissions`
      is that replacement. So no Forms are linked, by design.
      If you still want Forms feeding the database, the **Zapier connector** can
      bridge Google Forms → Supabase without new app code. Say the word.

- [ ] **`scripts/MigrateToSupabase.gs` has never been installed.**
      Google Apps Script that syncs the Employee Master Google Sheet → Supabase.
      Written, committed, never run. Needs pasting into the Sheet's Apps Script
      editor (README step 5). Only relevant if the Sheet is still the source of
      truth for employee data.

- [ ] **OTA silent updates (EAS Update)** — deferred by agreement. Needs
      `EXPO_TOKEN` above. Changes how the APK is built; recommend after the trial.

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
