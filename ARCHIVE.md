# Forge OS — Archived History

Fully resolved/closed/superseded sections moved out of CLAUDE.md on 10 Nov 2026 to reduce active context size. Nothing here governs current behavior — if you're looking for an active rule or decision, it's still in CLAUDE.md. This file is historical record only.

Contents:
- Daily + month-end attendance to Google Sheet + email — built 28 Sep 2026 (superseded)
- Daily attendance in Google Sheets — Whalesync, not Apps Script (6 Oct 2026) (superseded)
- RLS — all known holes closed (PATCH_12, confirmed 11 Aug)
- Screen-level issues — none open (found stale while re-auditing 13 Aug)

---

## Daily + month-end attendance to Google Sheet + email — built 28 Sep 2026

Yash: wants attendance visible outside the app, so a Sheet that stays
updated + email, not just the in-app dashboards. Confirmed via
`AskUserQuestion`: both Sheet and email; the Sheet is his own existing
**"VFL HR OS 2026 27"** spreadsheet (`10-OpV86Gvi_TlBPQ6zKQC6y7MLWqietELGU3G06exIM`),
not a new one; email recipients TBD ("I will give you the email addresses
when you need them").

**`scripts/AttendanceReport.gs`** (new file, lives in the SAME Apps
Script project as `ALERT.gs` — reuses its `SUPABASE_URL`/
`SUPABASE_SERVICE_ROLE_KEY` Script Properties and `getSupabaseCredentials_()`,
zero new credentials). Not yet pasted into the live Apps Script editor —
that one-time paste + running `installAttendanceReportTrigger()` once is
still Yash/HR's step.

- **"Daily Attendance" tab**: one row per *every active employee* per
  day, not just those who checked in — an absent employee gets a blank
  row rather than being dropped, matching this session's own "never
  silently drop people from the denominator" fix for the in-app
  dashboards. Columns: Date, Emp Code, Name, Department, Check In,
  Check Out, Working Hrs, Late Mins.
- **"Monthly Attendance Summary" tab**: rebuilt on the 1st of each month
  for the month that just closed. Columns: Month, Emp Code, Name,
  Department, Total Present Days, Avg Working Hrs/Day, Times Late
  (>grace). **"Total Present Days" is read as days present (P/L/HL),
  not calendar days in the month — an assumption, not confirmed by
  Yash**, since his spec paired it with "average working hrs per day,"
  which only makes sense per-present-day.
- **Late Mins reuses existing data, no new math**: `attendance_records.late_minutes`
  is already grace-adjusted at write time (`hooks/useAttendance.ts`'s
  `checkIn()`), so "only shown if crossed grace" just means "blank when
  null/0" — nothing new to compute.
- **No-checkout rule applied, same as the app** (28 Sep decision above):
  if someone checked in but `hours_worked` is null, the row gets the
  shift's default (General=9h, else 8.5h floor) — but ONLY when they
  actually checked in; a true absence (no check-in at all) stays blank,
  not defaulted. `lib/workingHours.ts`'s logic is hand-replicated since
  Apps Script can't import it — **keep both in sync by hand if that rule
  ever changes**, same duplication risk already flagged for the IST
  helpers.
- **Trigger design, fixed after an independent review caught a real
  bug**: v1 used `.timeBased().atHour(8).inTimezone('Asia/Kolkata')` —
  `.inTimezone()` does not exist on Apps Script's `ClockTriggerBuilder`
  and would have thrown at install time. Fixed to the same pattern this
  project's own `runShiftAlerts15min_` already uses: an **hourly**
  trigger whose handler explicitly checks `Utilities.formatDate(now,
  'Asia/Kolkata', ...)` before doing real work (gated to the 07:00-07:59
  IST hour, deduped via Script Properties so it only fires once per IST
  day) — never relying on the Apps Script project's own timezone
  setting, which nothing in this repo confirms is set to IST.
- **07:00 IST, reporting on "yesterday," self-healing "day before
  yesterday" too**: chosen because Shift 3 (00:00-07:00) belongs to the
  *previous* working day (see "Shift 3 belongs to the previous working
  day" above) — 07:00 is right after that window closes. Re-processing
  the day before yesterday every run means a Shift-3 checkout landing
  slightly late (e.g. 07:15-07:45, after this run already fired) gets
  corrected automatically the next morning, via upsert-in-place —
  without any special-case code.
- **Idempotent by upsert-in-place**, not delete-then-append: each row
  carries a hidden `_key` column (date+employee, or month+employee); a
  re-run overwrites the matching row instead of duplicating it.
- **Failure handling**: a Supabase read failure aborts before touching
  the Sheet or sending the real report — Yash still gets alerted, via
  `MailApp` to `OWNER_EMAIL` (already defined in `ALERT.gs`) plus
  whatever `ATTENDANCE_REPORT_RECIPIENTS` holds, so a broken job is
  never silent (this project's own `sendTelegramAlert` incident is the
  cautionary precedent).

**Still open, not decided — needs Yash before/around first real use:**
1. Email recipient addresses (he'll provide).
2. "Total Present Days" definition (see assumption above).
3. Whether this should start running now (test mode until 1 Oct) or
   stay installed-but-inert until go-live — harmless either way since
   it's read-only, but confirm.
4. The "VFL HR OS 2026 27" spreadsheet has more tabs than could be
   enumerated from here (confirmed at least "Overtime_Form", ~25k
   rows) — worth a glance that "Daily Attendance"/"Monthly Attendance
   Summary" don't collide with anything already there before the first
   real run.

**⚠ SUPERSEDED 6 Oct 2026 — Apps Script approach abandoned, see below.**
Yash: "your code .gs for pulling from supabase into sheet is not working."
(Root cause was almost certainly that the one-time paste-into-editor +
`installAttendanceReportTrigger()` step above was never done, not a bug in
the script — but Yash wants a different method either way, so this file
no longer tracks `AttendanceReport.gs` as the live path forward. The file
itself is left in `scripts/` but should not be pasted into Apps Script
going forward; the sections above are kept only as a record of what was
built and why, not as a to-do.)

## Daily attendance in Google Sheets — Whalesync, not Apps Script (6 Oct 2026)

**⚠ SUPERSEDED same day — Whalesync dropped, too expensive (Yash's own
words).** See "Self-serve data review" below for the final answer: Table
Editor + SQL views directly in Supabase, no sync tool at all. The
`daily_attendance_report` view this section built is still live and still
useful — just browsed directly, not synced anywhere.

**Decision from Yash, 6 Oct 2026**: no Apps Script, no Claude-orchestrated
automation tool (Make/Zapier) either — "you need connectors that supabase
can use and not you," i.e. a tool that connects directly to Supabase and
Google Sheets on its own, continuously, rather than Claude scripting a
daily batch job through a third-party automation platform.

**Chosen tool: Whalesync** (not a Supabase product, but a well-known
third-party continuous-sync tool many Supabase users pair with it for
exactly this — DB table/view → Google Sheet, kept live, no cron needed).

**What's ready on the Supabase side, done 6 Oct 2026**: Whalesync syncs
tables/views as-is — it cannot run custom SQL — but the daily attendance
report is a computed join (formatted check-in/out times, default hours
for a no-checkout day, department sort), not a raw table. So
`PATCH_74_daily_attendance_report_view_06Oct2026.sql` adds a Postgres
**view**, `public.daily_attendance_report`, with exactly that shape —
Date, Emp Code, Name, Department, Check In, Check Out, Working Hrs, Late
Mins, Overtime Hrs, one row per active employee per day (absent employees
get a blank row, never dropped, same "never silently drop people" rule as
the in-app dashboards) — so Whalesync has one clean source to point at.
Re-evaluates `now()` on every read, so "today" is always actually today in
IST, no stored/stale date. **Not granted to `anon`/`authenticated`** —
only readable via the `service_role` key, same key this project's other
admin-side integrations already use, never the app's own client queries.
Verified live: 99 rows on creation, matching the active headcount that day.

**Still Yash's own step, not done yet**: sign up at whalesync.com, connect
Supabase (needs the project's `service_role` key — pasted directly into
Whalesync's own connection form, never into this chat, same rule as every
other key in this file), connect the Google account that owns the "Forge
OS - Daily Attendance - 2026-10-06" sheet (OAuth, no key to paste), then
create a one-way sync: source = `daily_attendance_report` view → that
sheet's "Daily Attendance" tab. Whalesync keeps it continuously current
after that — no daily cron, no scenario to maintain, nothing further for
Claude to build unless Yash wants the Monthly Attendance Summary tab done
the same way (a second view, same pattern, not yet built — ask before
building it).

**Abandoned for this**: the Make.com scenario (scheduler → Postgres query
→ Google Sheets bulk-write) that was mid-build before Yash's "connectors
that supabase can use and not you" clarification — no Make credential
request was created, nothing to undo.

---

## RLS — all known holes closed (PATCH_12, confirmed 11 Aug)

This section used to list 6 open holes. **Stale — found while re-auditing
13 Aug.** All 6 were closed by `PATCH_12_rls_hardening_11Aug2026.sql`, which
has been applied and confirmed by Yash since 11 Aug (see the patches table
above). Keeping the record of what was fixed, since it explains why several
policies look stricter than a first read of FINAL_SCHEMA suggests:

1. `employees` INSERT — was `is_management() OR auth.role() = 'authenticated'`
   (the second branch made it trivially true for any signed-in user); now
   `is_management()` only.
2. `notifications` INSERT — was `with check (true)`; now `is_management()`
   only, plus a UPDATE policy scoped to `user_id = current_employee_id()` so
   the bell can be cleared.
3. `fraud_alerts` / `fraud_flags` INSERT — were unscoped for any authenticated
   user; now scoped to the reporting employee.
4. `attendance_records` write — now scoped to a supervisor's own team.
5. `leave_requests` UPDATE — now scoped to a supervisor's own team.
6. `mrm_reviews` SELECT — was readable by every authenticated user; now
   manager-and-above only.

No DELETE policies on any table remains intentional — audit trail.

---

## Screen-level issues — none open (found stale while re-auditing 13 Aug)

Every row this table used to list is fixed. Kept as a record, not a to-do:

| Screen | Was | Status |
|---|---|---|
| `worker/home.tsx` | `Constants.deviceId` doesn't exist in Expo SDK 51 — buddy-device fraud check compared a fresh `sessionId` every launch, could never match | ✅ Fixed 12 Aug — `lib/deviceId.ts`, persisted per install |
| `worker/5s.tsx` | Camera `takePhoto()` wrote a hardcoded placeholder URL | ✅ Wired to `PhotoCapture` — verified in code, not just claimed |
| `worker/observation.tsx` | Camera not wired | ✅ Same `PhotoCapture` component wired in |
| `supervisor/casual-workers.tsx` | Upsert conflict key `supervisor_id,date` — unverified against schema | ✅ Verified 13 Aug — matches `unique (supervisor_id, date)` in FINAL_SCHEMA exactly |
| All screens | No auth guard in individual route layouts | ✅ Fixed 13 Aug — `components/RoleGate.tsx` on all seven groups |

---
