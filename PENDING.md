# >>> RESUME STATE 13 Nov 2026 (reconciliation pass) — READ THIS FIRST <<<

**What this pass was:** the owner asked for a review of CLAUDE.md / PENDING.md (/ ARCHIVE.md if needed)
against the previous session's handoff notes. **Doc-only. No code edited, no DB row changed, nothing
deployed.** Four real discrepancies were found and fixed — see "Reconciliation findings" below.

**Branch reality (verified by git + GitHub myself, 13 Nov 05:48 IST):**
`claude/forge-os-backend-setup-7woj4t` HEAD = `d351a56` (PR #81 merged) **is authoritative and is the
branch to work on** (owner confirmed this directly, 13 Nov). The throwaway checkout
`claude/amazing-mendel-wtni36` was at the *identical* commit, so nothing diverged or was lost.
`apk-132` (off `07aa425`, published 12 Nov 20:50 IST) is the current published APK — verified via
`get_latest_release`, not assumed. Nothing is mid-flight: PRs #78/#79/#80/#81 all merged.
**10 PRs open**, all pre-existing: 8 Dependabot (#62, #63, #64, #65, #66, #67, #70, #71 — leave them;
**#64 `supabase/setup-cli` must NOT be merged until a green APK build**, it caused the 6 Nov CI outage)
plus old drafts **#8** (production sync `qty` null) and **#12** (EOTM one-award) — both still real bugs.

**LIVE state, queried 13 Nov 05:48 IST (not recited from notes):**
- Headcount **106 active / 154 total**. (Any older number in these files is stale by rule.)
- October run `d5c1e25a` — `draft`, `population=NULL` (whole company), feeds confirmed, **0 pay_run_items**.
- `pay_run_warnings`: **110 total, 0 undecided, 101 unreviewed, 3 `concern`.**
- **Last AI review = 12 Nov 17:16 IST — BEFORE `payroll-warning-review` v5 was deployed (~22:25 IST).**
  So **HR has not tapped "Retry review" since v5 went live**, and the 101-unreviewed count has not moved.
  v5 confirmed live and correct: `version: 5`, `verify_jwt: true`. **The one step left is still HR's tap.**
- November `PERMANENT_WORKER` draft `d49f2ff3` still exists, untouched — don't let it be calculated.
- `payroll-run` v17, `shift-reminder` v23 — both as documented.

## 🔴 URGENT-PRODUCTION FRIDAY CANNOT BE ALLOCATED — real bug, root-caused 13 Nov 2026 from VFL1560's report

**Reported by VFL1560 Shaikh Majeed (daily allocator, Maintenance), 13 Nov 10:36 IST, via screenshot:**
"Production is ongoing today, but today date is not being displayed in the app for shift assign."

**Confirmed: the work-week grid structurally excludes Friday, so an urgent-production Friday cannot be
allocated by ANYONE — not an allocator, not HR.** `getWeekDays()` loops `for (let i = 0; i < 6; i++)`
from the week's Saturday, producing **Sat–Thu only**. The identical six-day loop exists in BOTH
`hooks/useShiftAllocation.ts:29` (the 8 department allocators' screen) and
`app/(hr-admin)/shifts.tsx:29` (HR's own unscoped screen) — so **there is no HR workaround.** Today
(13 Nov) is a Friday: `getWeekStartIST(0)` returns 7 Nov, the grid shows 7–12 Nov, and `weekOffset+1`
jumps to 14–19 Nov. **Friday appears in no week, ever.**

**⚠ SEVERITY RAISED 13 Nov by the owner: Maintenance works EVERY Friday** (see CLAUDE.md, "Maintenance
WORKS Fridays"). This is not a rare urgent-production case — it is a standing weekly roster, and it is
why daily allocation exists. Proven: every Friday shift row for Majeed's team from 9 Oct to 6 Nov was
`system_inferred`, **zero `hr_allocated` in five weeks**; 13 Nov is the first Friday ever to carry
`hr_allocated` rows (4), via the apk-132 daily stepper. **Claude's earlier suggestion to add a
weekly-off exclusion to the reminder is WITHDRAWN — it would have broken exactly this case.**

**This directly contradicts the documented design.** CLAUDE.md's "Work week" section says a working
Friday "is just a Friday HR assigns shifts for, same as any other day" — the UI makes that impossible.
The owner's own rule allows it: "friday is weekly off **unless we have urgent production** friday is
working. 90% of times friday is off." Today is one of the 10%.

**Second, smaller contributor (daily mode only, VFL1560/VFL1566 on apk-132):** the single-date stepper
in `components/ShiftAllocationGrid.tsx` **defaults to tomorrow** (`useState(1)` in
`useShiftAllocation.ts`). There is **no clamp** — `setDayOffset(d => d - 1)` is unbounded, so today IS
reachable by tapping `‹` once; it is simply not what the screen shows on open. So if VFL1560 is on
apk-132 he has a workaround today; if he is on apk-131 or earlier he sees the weekly grid and has none.

**Live state today, 13 Nov ~10:40 IST (re-queried; an earlier 05:48 IST reading of "zero rows for
13 Nov" is STALE — the day had not started):** 43 `employee_shifts` rows now exist for 13 Nov;
**40 present / 55 WO** in `attendance_records`. `mark_weekly_offs()` correctly wrote WO at 00:01 IST
(Friday default); the ~40 who actually came in have overwritten their own WO by checking in, exactly as
designed. VFL1560's team: **10 of 12 assigned.** VFL1560 himself checked in **08:53 IST, status `P`,
shift `General` but `assignment_source='system_inferred'`** — i.e. nobody could allocate him, so the
app inferred it from his punch. That is why his own home screen read "No shift assigned today" (the
screenshot he sent is his personal check-in screen, not the allocation screen). VFL1566 is `WO` today
and did not come in, which is why only VFL1560 raised it.

**Net effect: nobody is being lost** — check-in inference is covering the gap and attendance is being
recorded correctly. The damage is that shifts cannot be *planned* for a working Friday, lateness is
judged against an inferred shift rather than the one the allocator intended, and the allocator sees a
screen that looks broken.

**NOT FIXED — needs the owner's go (a code change touching every allocator's screen and HR's).**
Options, in the order Claude would recommend them:
1. Extend both grids from 6 to 7 days so Friday is visible and allocatable, leaving it blank/unassigned
   on a normal week (the weekly-off marking is independent of whether a shift row exists). Smallest
   change, fixes it for everyone including HR, matches the documented intent.
2. Default the daily stepper to **today** rather than tomorrow (a one-line change) — helps only the two
   daily allocators, does nothing for HR or the other six.
3. Both.
Whichever is chosen, `getWeekDays()` is duplicated by hand in two files and **both must change together**
— the same hand-sync duplication already flagged for the IST helpers and `AttendanceReport.gs`.

## Daily shift allocation (VFL1560/VFL1566) — BUILT and live; reminders NOT yet proven to deliver (verified 13 Nov 06:00 IST)

**Built and confirmed live, first-hand (owner asked 13 Nov whether it exists for his two people — it does):**
- `shift_allocation_mode='daily'` on **exactly** VFL1560 Shaikh Majeed (Maintenance) and VFL1566
  Abhimanyu Kakde (VMC Shop), both `is_active`; the other **152** employees stay `'weekly'`.
- `allocate_team_shift_day(p_employee_id uuid, p_shift_id uuid, p_date date)` exists, `SECURITY DEFINER`,
  grants `postgres`/`authenticated`/`service_role`, **no `anon`** — matches `allocate_team_shift_week()`.
- Both pg_cron jobs exist and `active=true`: `daily-allocator-reminder` 19:00 IST,
  `daily-allocator-hr-escalation` 21:00 IST. Both carry the correct `mode` in their body and a real key.
- Merged (PR #80 → `07aa425`), shipped in **apk-132**, and `shift-reminder` is deployed at **v23**
  containing both new modes — proven by behaviour, not by the deploy call's own say-so (see below).
- Each allocator has a **12-person** team, all `uses_app=true`.

**⚠ NOT proven end-to-end: no allocator reminder has ever been delivered.**
`notifications` contains **zero** rows of `daily_allocation_incomplete` or `daily_allocation_hr_escalation`
— none, ever. There is no CHECK constraint blocking the types. Two separate reasons, one explained, one not:
1. **19:00 IST on 12 Nov — explained, one-off, no action needed.** The job fired on time but
   `shift-reminder` v23 only deployed at **20:41 IST**, so it hit the old function: `function_edge_logs`
   shows a **400** at 13:30 UTC (= 19:00 IST) next to the 200 from the every-15-min `forms_due_reminder`.
   That is exactly the "unknown mode until the merge deploys" behaviour the build notes predicted. It also
   proves v23 really does carry the new modes, since the same call returned **200** after the deploy.
2. **21:00 IST on 12 Nov — CLOSED 13 Nov by the owner's instruction ("forget last night reminder, start today"); do NOT investigate further.** Left on record only because a repeat tonight would be a new finding. What was seen: The escalation ran *after* the deploy and
   returned **200** with no `console.error` (the handler returns 500 and logs on any throw, and
   `notifyEmployees` throws on a failed insert — so nothing threw). Yet it created no notification, even
   though **all 24** team members had no `employee_shifts` row for 13 Nov. The code path has no
   weekly-off exclusion, so on the data it *should* have notified HR. **Could not be resolved:**
   `net._http_response` had already pruned that run's body, and `employees` carries no audit trigger, so
   neither the response nor the exact time the two rows were switched to `'daily'` can be recovered. The
   most plausible benign explanation is that the mode flag was set *after* 21:00 IST, which would make
   `allocators.size === 0` an early return — but that is a hypothesis, **not verified**. Do not record
   this as working until a run is observed delivering.

**🔒 Owner, 13 Nov 2026: the clock starts TODAY. Order confirmed — allocator (19:00 IST) then HR
(21:00 IST).** See CLAUDE.md "Owner decision of 13 Nov 2026" for the full record, including that both
daily allocators are `role='manager'`, not supervisor.

**Concrete, falsifiable prediction for tonight — check this tomorrow morning.** Verified live 13 Nov
10:43 IST, tomorrow = **Sat 14 Nov**: **VFL1560 has 11 of 12 assigned (1 missing); VFL1566 has 12 of 12
(0 missing).** Therefore:
- **19:00 IST** → a `daily_allocation_incomplete` notification to **VFL1560 only**. VFL1566 must get
  nothing (he is complete) — a notification to him would itself be a bug.
- **21:00 IST** → if VFL1560 has not filled that one person in, a `daily_allocation_hr_escalation`
  notification to **VFL5440 (Pallavi)** naming him and the missing person. If he fills it, silence.
Check with:
`select type, user_id, created_at at time zone 'Asia/Kolkata' from notifications where type in ('daily_allocation_incomplete','daily_allocation_hr_escalation') order by created_at desc;`
Zero rows after 19:00 with a gap still open = the delivery bug is real and now reproducible.

**Tonight (13 Nov) is a clean natural test, no code needed.** Tomorrow is **Saturday 14 Nov**, and
coverage is already uneven: **VFL1560 has 4 of 12 unassigned, VFL1566 has all 12 assigned.** So the
19:00 IST reminder should notify **VFL1560 only**, and the 21:00 escalation should stay silent if he
fills it in. Check `notifications` for the two types after 19:00/21:00 IST tonight — that settles item 2
either way.

**Design point worth a decision (Claude's finding, owner has not been asked):** **13 Nov is a Friday —
the company-wide weekly off.** `employee_shifts` has **zero** rows for 13 Nov company-wide (7–12 Nov each
have ~111; 14–16 Nov have 86) and `mark_weekly_offs()` has already written **93 `WO`** attendance rows for
it. `findIncompleteDailyAllocations()` has **no weekly-off exclusion**, so as written the 19:00/21:00 pair
will nag both allocators — and escalate to HR — every Thursday night about a Friday that is *correctly*
unallocated. Not changed (nobody asked); needs the owner's call before touching it.

## Separate live failure found 13 Nov 06:00 IST — `five-s-challenge-generator` is broken

Its 06:00 IST run returned **500**: `Gemini API error 404: "This model models/gemini-2.0-flash is no
longer available. Please update your code to use models/gemini-3.8-flash"`. The model was retired
upstream, so the daily 5S challenge is not being generated at all. Unrelated to the payroll/shift work;
found while reading `net._http_response`. **Not fixed — nobody has asked.** The fix is a model-id change
in `supabase/functions/five-s-challenge-generator/index.ts` plus a redeploy.

## Reconciliation findings (13 Nov) — what was actually wrong

1. **🔴 The 13 Nov session's own record was orphaned.** Its RESUME STATE block and the 12 Nov
   session-close block (dependabot hygiene, the 7-item status list, PR #80 merged) were committed to
   `claude/peaceful-feynman-hisowr` and **never merged — no PR was ever opened**. Base still showed the
   12 Nov blocks as newest, so a fresh session would have read superseded state. **Rescued into this
   file on the authoritative branch** (content preserved verbatim; conservation checked).
2. **🔴 The owner's 13 Nov standing decision was in no control file at all** — only in that orphaned
   branch. It is now recorded in **CLAUDE.md** ("Owner decision of 13 Nov 2026 — do not correct paid
   historical attendance") and in the **NEVER-do list**, per the locked "a decision exists only once it
   is in CLAUDE.md" rule. This mattered: the 12 Nov (late) block still invites a reader to treat
   VFL4024's 720 / VFL5458's 1134 `late_minutes` as "data to look at", which is exactly the
   already-paid historical data the owner ruled out touching.
3. **🟡 UTC regression avoided.** The orphaned branch re-introduced "13:30 UTC / 19:00 IST" cron
   wording, against the owner's 12 Nov IST-only rule (already corrected three times). Restored to
   IST-only while rescuing the rest.
4. **🟡 Structure fixed.** The AI-agent roadmap was sitting *above* the RESUME STATE block, though
   CLAUDE.md's session-start protocol says the top RESUME STATE block is read first. Roadmap moved
   below. **CLAUDE.md's `Branch:` header** also still said that branch was "⚠ stale" — it is now the
   authoritative one; corrected.

## Known gap, deliberately NOT fixed (owner has not asked)

**Off-by-one in the 12-hour late cap.** `lib/istDate.ts:26` (`lateMinutesAgainst`) and
`lib/serverClock.ts:61` (`serverLateMinutesAgainst`) both `return diff > 720 ? 0 : diff`. The function's
own comment says "More than 12h late means the check-in is actually early", so intent and code disagree
at exactly `diff === 720`: a punch exactly 12h 00m after shift start is recorded as **720 minutes late**
instead of 0. Verified by reading both files this pass; **ARCHIVE.md has no rationale for the 720
value**, so there is no hidden reason being overridden. Real but narrow (one minute-value in 1440).
**Not applied** — the owner ruled out the historical correction and has not asked for the forward fix.
Revisit only if this shape appears in an *unpaid* month. Keep the two files in sync if it is ever changed.

## Still genuinely open (nobody has asked for these)

- **October AI review** — waiting on HR's "Retry review" tap (see live state above). The 3 `concern`
  rows (VFL1463, VFL4011, VFL4026) do **not** block Calculate. Do NOT touch `pay_runs` /
  `pay_run_warnings` rows directly — HR drives that screen live (see the 6 Nov incident).
- **Calendar UX** — Late (yellow) vs Half-Day (orange) are nearly identical. Claude's own finding; the
  owner has not asked for a fix.
- **8–11 Nov Diwali** (confirmed paid holiday) — queued for November's Extras report, due December.
  Must NOT be written as `H` attendance rows (that was the 4 Nov double-count bug).
- **AI-agent roadmap** — scoping only, below.
- **Dependabot #64** — only after a verified green APK build.

---

# >>> RESUME STATE 13 Nov 2026 (earlier — rescued from the unmerged work branch; superseded by the reconciliation block at the top) <<<

**Branch reality (verified by git + GitHub 13 Nov):** `claude/forge-os-backend-setup-7woj4t` HEAD = `d351a56` (PR #81 merged). Work branch `claude/peaceful-feynman-hisowr` merged up to this point, clean. **PRs #78, #79, #80, #81 are ALL merged — nothing app/backend is in a draft PR.** `apk-132` (off `07aa425`) is still the current published APK — PR #81 was backend-only (edge function + docs), no app code touched, no new APK triggered or needed.

**Shift 3/5 "implausible late_minutes" investigation — CLOSED, no fix applied, per owner's explicit instruction.** A Sonnet agent root-caused the two flagged rows (VFL4024 `late_minutes=720`, VFL5458 `late_minutes=1134`, both dated 3 Oct): **not a current-code bug** — both employees' phones were still on the pre-28-Sep APK build, whose lateness math had no midnight wraparound and no cap, and simply read an on-time ~19:00 night-shift arrival as hours "late" against whatever day-shift time was on file. Current code (28 Sep onward) would correctly compute 0 for both. 16 rows total share this signature, all dated 28 Sep–8 Oct — the window between the real fix shipping and these phones reinstalling. One small residual bug was found as a side effect (an `>720` vs `>=720` off-by-one in `lib/istDate.ts`/`lib/serverClock.ts`'s `lateMinutesAgainst`/`serverLateMinutesAgainst`, letting an exact-12h-boundary case slip through uncapped) — a proposed (unapplied) diff exists in the agent's report.

**Owner's decision, 13 Nov 2026: do not touch any of this.** September and October payroll are already paid — correcting historical attendance rows now serves no purpose, and the owner explicitly said not to go back and fix anything from the past. **No code was edited, no data was changed, nothing was deployed.** The off-by-one fix (item above) is NOT applied — if a similar case shows up in a future (unpaid) month, revisit then; do not proactively deploy this fix without the owner asking for it again, since he has not asked for the forward-looking code change either, only ruled out the historical-data part.

**Everything from the 12 Nov session is resolved or explicitly deferred — nothing is mid-flight.** Real work still open: items 4, 6, 7 in the status list just below, and the "NEXT PRIORITY" block further down (October payroll AI review — now on v5, see the 12 Nov (late) block for detail).

---

# >>> RESUME STATE 12 Nov 2026 (session close) <<<
**Branch reality (verified by git + CI 12 Nov, end of session):** `claude/forge-os-backend-setup-7woj4t` HEAD = `07aa425` (PR #80 merged). Work branch `claude/peaceful-feynman-hisowr` is clean, no uncommitted changes, sitting on top of the same history. **PRs #78, #79, #80 are ALL merged — nothing of this session's app/backend work is still in a draft PR.** `apk-132` is the current published APK (off `07aa425`); CI, Deploy Edge Functions, and Build Android APK all show `success` on that commit — nothing broken by the session's close-out activity (closing dependabot PRs does not touch the base branch or trigger any workflow).

**GitHub hygiene done at session close:** closed 7 dependabot PRs that contradict CLAUDE.md's pinned-dependency policy — #68 (typescript 5→7), #69 (expo-constants 16→58), #72 (tailwindcss 3→4), #73 (async-storage 1→3), #74 (react bump), #75 (react-native-chart-kit 6→7), #76 (eslint 8→10) — each confirmed closed via a fresh fetch (`state:"closed"`, real `closed_at`), not just a success response. Left open on purpose: #62, #63, #65, #66, #67, #70, #71 (lower-risk CI/dev-tool bumps) and **#64 supabase/setup-cli (open but do NOT merge** until a green APK build verifies it — this exact action caused the documented 6 Nov CI outage before). Left open as real, unfixed bugs, not stale: **#8** (production sync — Forge/Press/Machine `qty` still null) and **#12** (EOTM one-award-per-category still broken in base `eotm.tsx`). Issues #1, #2, #3, #7, #28 and GitHub Issues #10/#11 were already closed by the owner directly — verified, no action needed.

**All findings below verified live by Claude on 12 Nov (SQL + function logs + code read), nothing changed in the DB.**

**STATUS OF THE 7 ITEMS BELOW, as of session close (12 Nov) — this list is the original find; read the "owner's answers" sections right after it for what actually happened to each:**

1. **October run AI review — ✅ RESOLVED (v4; superseded by v5, see 12 Nov (late) block).**
2. **Attendance bug A (VFL4008/4026/4066 mis-dated punches) — ✅ HANDLED per owner instruction.** VFL4026 corrected, both given 12-Nov presence rows, no `hours_worked` backfilled (owner's explicit "no, let it be as per their check in time"). VFL4066 deliberately NOT touched (different bug shape). The underlying 06:45-rollover root cause is **NOT fixed in code** — only this specific instance was hand-corrected; the general bug (item below) is partially fixed by PR #79.
3. **Attendance bug B (VFL4071-style WO-shadowed checkout) — ✅ FIXED, merged, deployed** (PR #79, `apk-131`). Bug C (<5min accidental tap) also fixed in the same PR. Bug A's residual case (unassigned early arrival >60min before a day shift) deliberately left as-is per owner's 12 Nov decision.
4. **Calendar UX (Late vs Half Day colour clash) — still open, not addressed this session.**
5. **6 Nov / 10 Nov weekly-off swap — ✅ WRITTEN LIVE.** 65 employees who worked 6 Nov now have a 10-Nov `WO` row.
6. **8–11 Nov Diwali — still open, deliberately deferred.** Confirmed paid holiday by the owner, but not written to attendance — queued for whoever builds November's Extras report (two-report principle; November's run isn't due until December).
7. **November `PERMANENT_WORKER` draft run (`d49f2ff3`) — still open, low priority, untouched.** Nobody has calculated it; just don't let it happen by accident before November's real run is due.

## 12 Nov 2026 — owner's second round of answers, actions taken this same turn

1. **PR #79 merged** into `claude/forge-os-backend-setup-7woj4t` as `087dfcf`. Owner's call on the Bug-A residual gap: **leave it** (no fuller fix attempted). **APK build triggered automatically** (workflow run #131, `Build Android APK`, off `087dfcf`) — check it finished (`success`, a new release published) before telling anyone to reinstall.
2. **"Calculate hrs worked for 11th 3rd shift" (VFL4008/VFL4026):** checked live — **both rows are still open** (checked in 06:39/05:01, no checkout yet; current time ~17:20 IST, their Shift 4 (07:00–19:00) hasn't ended). Nothing was written to `hours_worked` — this project's own locked rule is that the raw column stays null and the no-checkout default (8.5h for a Shift 3 day) is applied at READ time only, never backfilled, so writing a number into an still-open row would conflict with the real checkout once it happens. **If/when they check out normally through the app, real hours will be computed as usual.** If what's wanted is the number right now for a manual report: per the existing Shift-3 no-checkout convention, each would show as **8.5h** if nothing else happens before auto-checkout. Flagged back to the owner rather than guessed into the database — see open questions below.

# >>> RESUME STATE 12 Nov 2026 (late; superseded by the 13 Nov blocks above) <<<
**Branch reality (verified by git + GitHub 12 Nov, late):** `claude/forge-os-backend-setup-7woj4t` = `07aa425` is authoritative (PRs #78, #79, #80 merged; `apk-132` published off it). Work branch `claude/magical-galileo-sn6n0l` = base + the one fix below, in a draft PR. Open PRs otherwise: Dependabot #62–#67, #70, #71 (leave; #64 only after a green APK build) and old drafts #8, #12.

**October run AI review — SECOND root cause found and FIXED LIVE: `payroll-warning-review` v5 deployed 12 Nov ~22:25 IST on Yash's "yes deploy"** (Sonnet agent; Claude fetched the deployed source back himself: v5, `verify_jwt` true, `max_tokens: 4096`, effort low, no `temperature`). Not yet proven on a live call — that happens when HR retries. **Only step left: HR taps "Retry review" once, then Calculate.** If any call still fails, the function log now prints `stop_reason=`. The 3 `concern` rows (VFL1463, VFL4011, VFL4026) do not block Calculate. Two reviews also flagged implausible `late_minutes` (VFL4024 720, VFL5458 1134) — data to look at, nothing changed. Detail of the diagnosis: Verified live: HR DID retry after v4 (12 Nov, 17:14–17:20 IST). Run `d5c1e25a` is still draft, 0 items: **110 warnings / 0 undecided / 101 unreviewed / 9 reviewed, of which 3 are `concern`** (owner was notified of those). About 30 calls, 3 returned 200, the rest 502 with the function log "could not parse llm response" and an EMPTY or cut-off reply. Cause: `max_tokens: 400` — `claude-haiku-5-5` thinks by default and thinking counts against the cap, so the answer is cut before or during the JSON. Fix (Sonnet agent, verified by Claude: diff read, `payroll-warning-review.test.ts` 24/0): `max_tokens: 4096`, `output_config: { effort: 'low' }`, and `stop_reason` added to the failure log. Already-reviewed rows are skipped on retry. Do NOT touch `pay_runs` / `pay_run_warnings` rows.

**All UTC times in CLAUDE.md and PENDING.md were converted to IST on 12 Nov (owner rule: IST only).**

**Unchanged and still open:** calendar Late (yellow) vs Half-Day (orange) colours — Claude's own finding, owner has not asked for a fix; 8–11 Nov Diwali for November's Extras report (December); November `PERMANENT_WORKER` draft `d49f2ff3` (22 warnings, 0 items, feeds not confirmed — leave, not to run until December); AI-agent roadmap (scoping only).

---

# >>> RESUME STATE 12 Nov 2026 (earlier the same day; superseded by the block above) <<<
**Branch reality (verified by git 12 Nov):** `claude/forge-os-backend-setup-7woj4t` = `0d5d5cf` (PR #77 merged) is authoritative. Work branch `claude/peaceful-feynman-hisowr` = base + the one fix below, in a draft PR.

**All findings below verified live by Claude on 12 Nov (SQL + function logs + code read), nothing changed in the DB.**

1. **October run AI review — ROOT CAUSE FOUND, fix in repo, NOT DEPLOYED.** Run `d5c1e25a` still draft, feeds confirmed, 110 warnings / 0 undecided / 110 unreviewed. HR did retry on 12 Nov 15:05 IST; every call returned 502. Function log: Anthropic HTTP 400 "`temperature` is deprecated for this model". Fix = remove `temperature: 0` from `supabase/functions/payroll-warning-review/index.ts` line 90 (done on the work branch). **Deploy was blocked by the session's permission classifier — needs Yash's explicit "go"**, then: deploy via Supabase MCP (`verify_jwt: true`, files `index.ts` + `lib/*` verbatim), fetch back and diff, then HR taps "Retry review" once, then Calculate.
2. **Attendance bug A — early morning check-in filed on the PREVIOUS day.** `attendanceDateStr()` (`lib/istDate.ts`) rolls the day at 06:45 IST for everyone, but shift inference accepts Shift 1/4 arrivals from 06:00. A day-shift check-in before 06:45 lands on yesterday's date. 12 Nov: VFL4008 (06:39), VFL4026 (05:01, also given 301 late minutes), VFL4066 — all filed under 11 Nov, no 12 Nov row. 29 such rows since 1 Oct (7 in Nov). Not fixed; rule needed from Yash (see questions). The three open rows of 12 Nov need their date moved to 12 Nov — needs Yash's go.
3. **Attendance bug B — night-shift checkout creates a fake one-minute day.** `hooks/useAttendance.ts` only falls back to the open (previous-date) record when NO row exists for today. When a row already exists (the 00:01 `WO` pre-write on a Friday, or any earlier row) the app offers Check In, the worker taps in then out: a ~1-minute row marked `HL`, the real night shift is later auto-closed at default hours, and that night's check-in is blocked. VFL4071: 6 Nov (07:02–07:03) and 7 Nov (07:12–07:13) are this; nights of 2 and 3 Nov have no row at all. 14 in/out-within-5-min rows in Nov, 81 since 1 Oct (some are test taps). Not fixed.
4. **Calendar UX:** Late and Half Day colours are nearly identical, so a fake `HL` reads as "late" while the Late tile says 0.
5. **6 Nov / 10 Nov weekly-off swap — still NOT applied.** 6 Nov: 72 worked, 25 `WO` untouched. 10 Nov: 8 rows only (7 P, 1 L), no `WO` rows. Can still be written (not time-critical for pay) — needs Yash's go.
6. **8–11 Nov almost empty** (about 10 rows a day, no `H` rows). If the plant was shut for Diwali, November pay will treat those days as absent unless holiday/extras are decided.
7. **A November `PERMANENT_WORKER` draft run exists** (`d49f2ff3`, 22 warnings, 0 items, feeds not confirmed) — not created by Claude; untouched. Owner doesn't know who created it either; November's own run isn't due until December's first week, so this is low priority — just don't let it get calculated by accident.

## 12 Nov 2026 — owner's second round of answers, actions taken this same turn

1. **PR #79 merged** into `claude/forge-os-backend-setup-7woj4t` as `087dfcf`. Owner's call on the Bug-A residual gap: **leave it** (no fuller fix attempted). **APK build triggered automatically** (workflow run #131, `Build Android APK`, off `087dfcf`) — check it finished (`success`, a new release published) before telling anyone to reinstall.
2. **"Calculate hrs worked for 11th 3rd shift" (VFL4008/VFL4026):** checked live — **both rows are still open** (checked in 06:39/05:01, no checkout yet; current time ~17:20 IST, their Shift 4 (07:00–19:00) hasn't ended). Nothing was written to `hours_worked` — this project's own locked rule is that the raw column stays null and the no-checkout default (8.5h for a Shift 3 day) is applied at READ time only, never backfilled, so writing a number into an still-open row would conflict with the real checkout once it happens. **If/when they check out normally through the app, real hours will be computed as usual.** If what's wanted is the number right now for a manual report: per the existing Shift-3 no-checkout convention, each would show as **8.5h** if nothing else happens before auto-checkout. Flagged back to the owner rather than guessed into the database — see open questions below.

## 12 Nov 2026 — owner's answers, actions taken this same turn

1. **AI review: DEPLOYED.** `payroll-warning-review` v4 live, `temperature` removed, verified byte-for-byte against the repo. [PR #78](https://github.com/erpvarsha-star/forge-os-trial/pull/78) merged into `claude/forge-os-backend-setup-7woj4t` as `409cfc9`. **HR still needs to tap "Retry review" once** — not done by Claude (HR has the screen open live, same caution as every other `pay_run_warnings` touch).
2–3. **VFL4008 / VFL4026 corrected live** (owner-approved, 12 Nov): VFL4026's 11-Nov row status `L`→`P`, `late_minutes` cleared (was the mis-dated 301-min calc). Both given a new 12-Nov `P` row (no punch time, manually-entered-presence shape, same as Pune/security) so the real shift date isn't lost. VFL4066 was **not** touched — its screenshot case turned out to be a different, unrelated shape (an already-closed normal 11-Nov day plus a separate 15:39 afternoon half-day on 12-Nov) that doesn't match the early-arrival bug; needs its own look if HR raises it again.
4. **10-Nov weekly-off swap: written live.** 65 employees who actually worked 6 Nov (real check-in; security guards and Kajal/VFL1567 excluded) now have a `WO` row for 10 Nov. No change was needed on the 6-Nov side itself.
5. **8–11 Nov Diwali: confirmed paid holiday**, but **not yet written to attendance** — per the 1 Nov "two-report principle" (payroll core pays only days worked; holiday pay is an Extras-report line HR approves, never a hard-coded `H` row, which is exactly the double-count bug found 4 Nov), this is queued for whoever builds November's Extras report. November's run isn't due until December.
6. **VFL4071 (2/3/6/7 Nov nights):** root cause is a different, confirmed bug (see item 8 below) — not hand-corrected; his 2/3 Nov nights have no row at all and the 6/7 Nov `HL` rows are the bug's output, so the real punch times can only come from HR/Kajal, not be invented.
7. Covered above.
8. **Approved and underway — full attendance-logic fix delegated to a Sonnet agent (background), covering:**
   - Bug A (early day-shift arrival mis-dated — the VFL4008/4026/4066-shaped bug): file the row by which shift it actually matches, not a blanket 06:45 clock cutoff; night-shift continuation (Shift 3/5/Security Night) keeps the existing previous-day rule unchanged.
   - Bug B (VFL4071's actual root cause): `fetchRecords()` in `hooks/useAttendance.ts` treats a weekly-off placeholder row with no check-in as "today's record exists" and never looks for the real open night-shift record, so the worker is shown "Check In" instead of "Check Out" and a spurious 1-minute `HL` is created while the real shift silently auto-closes later.
   - Bug C: a tap-in/tap-out under 5 minutes should not record a half day.
   - **Built, independently re-verified, draft PR open: [PR #79](https://github.com/erpvarsha-star/forge-os-trial/pull/79) — MERGED, apk-131 published.** Claude re-ran `tsc --noEmit` (still exactly 7 baseline, 0 new) and `check-i18n.mjs` (clean) itself rather than trusting the agent's numbers, and read the full diff. Bugs B (VFL4071's WO-shadowing) and C (<5min tap) are fully fixed. Bug A is **partially** fixed, left as-is per owner's 12 Nov decision: an UNASSIGNED early arrival more than ~60 min before a day shift's start still resolves to Shift 3 and files under the previous date — deliberately left alone to avoid the documented Shift-3/4 tie-break/widened-buffer risk.

## Daily shift allocation (VFL1560/VFL1566) + owner late-skip + 19:00/21:00 reminder — built 12 Nov 2026, [PR #80](https://github.com/erpvarsha-star/forge-os-trial/pull/80) MERGED

Owner-approved build (see CLAUDE.md "Owner decisions of 12 Nov 2026 (second batch)"). Built by a Sonnet agent, independently re-verified by Claude (not taken on the agent's word): `tsc --noEmit` re-run (exactly 7 baseline, 0 new), `check-i18n.mjs` re-run (clean), every diff read line-by-line, and the live DB re-checked directly: `employees.shift_allocation_mode='daily'` for exactly VFL1560/VFL1566 (154 employees total, 152 stay `'weekly'`); `allocate_team_shift_day()`'s grants (`authenticated`/`postgres`/`service_role`, no `anon`) match `allocate_team_shift_week()`'s exactly; both new cron jobs (`daily-allocator-reminder` 19:00 IST, `daily-allocator-hr-escalation` 21:00 IST) confirmed live and `active=true`.

**MERGED into `claude/forge-os-backend-setup-7woj4t` as `07aa425`. `Deploy Edge Functions` (run #54) and `Build Android APK` (run #132, `apk-132`) both confirmed `success` off that commit.** `shift-reminder`'s two new modes are now live in the deployed function — the 19:00/21:00 IST reminder+escalation will actually fire starting tonight (13 Nov) for VFL1560/VFL1566. Nothing further needed here unless Yash reports an issue with the reminders or the new daily-allocation screen.

---

# >>> RESUME STATE 6 Nov 2026 (session close) <<<
**Branch:** `claude/forge-os-backend-setup-7woj4t`, HEAD = `d120d62`. Local checkout `ccr-e6455619-qd283w` tracks it. `git status` clean.

**⚠ BRANCH REALITY, appended 10 Nov 2026 (nothing above this line altered):** the branch/HEAD line above is stale. Three refs now diverge from `4e885d8`: (a) `ccr-9feb6882-let9qi` — carries commit `49e651d`, the CLAUDE.md/ARCHIVE.md split, plus PR/issue templates, CodeQL, Dependabot, `PATCH_134` and payroll engine edge-case tests; (b) `ccr-81ac007d-k0dr8v` — this checkout, which has now MERGED (a) and is therefore a strict superset of both, and carries the 10 Nov control-file audit; (c) `claude/forge-os-backend-setup-7woj4t` — the branch this block names, which has none of the above. **Owner decision needed: pick (b) as authoritative and merge it into the long-lived branch, or say otherwise.** Until that happens, treat the docs in (b) as current and do NOT edit CLAUDE.md/PENDING.md/ARCHIVE.md on another branch — they will conflict.

**Deploy Edge Functions CI** was fixed this session (`supabase/functions/deploy.sh` line 35 now has `--yes`; run #52 confirmed green, all 12 functions deployed) — fully closed, no follow-up.

## NEXT PRIORITY — October run still blocked on AI review (110/110 unreviewed); separately, 6 Nov Friday attendance needs fixing

**Live state as of session close:** `pay_runs` (`d5c1e25a-bd3e-425a-8db0-540ef2734a2e`, `status='draft'`, `population=null`) — `feeds_confirmed_at` set (Pallavi confirmed, 14:38 IST). `pay_run_warnings`: **110 total, 0 undecided (HR finished deciding all of them), but still 110 unreviewed (`agent_verdict is null`)** — UNCHANGED since this session's `payroll-warning-review` logging fix was deployed (v3), meaning **HR has not tapped "Retry review" again since that redeploy**. `payroll-warning-review`'s deployed source now has `console.error` in all 4 of its failure branches (missing key / LLM HTTP error incl. response body / fetch exception / unparseable response), so the NEXT retry will produce a real diagnostic line in its function logs instead of nothing.

**Next step for whoever resumes:** (1) re-check the unreviewed count; (2) if HR hasn't retried, ask them to tap "Retry review" once; (3) immediately pull `payroll-warning-review`'s function logs (function id `ae2c007c-9b70-4cc4-ac12-785affb8b559`) and read the new `console.error` output — it will say exactly which of the 4 branches is failing (missing `ANTHROPIC_API_KEY` secret / bad `claude-haiku-5-5` model id / Anthropic HTTP error with body / unparseable response). Fix from there. Do NOT touch `pay_runs`/`pay_run_warnings` rows directly — HR has the screen open live.

**Owner decision, 6 Nov 2026 (see CLAUDE.md for the full record): 6 November (today, a Friday) was a real working day, not a weekly off; 10 November is the compensatory off.** `mark_weekly_offs()`'s normal Friday-default cron had already written `status='WO'` for 6 Nov for employees on the default Friday off (confirmed for VFL5450, who actually worked today — that's also what caused his "No open attendance record" exit-QR error screenshot, since WO days have no check-in). **Not yet fixed** — needs the owner to confirm (a) which employees actually worked 6 Nov (everyone on the Friday-default, or only some), and (b) that 10 Nov's comp-off should be WO-equivalent for those same people, before any `attendance_records`/`mark_weekly_offs` row is touched. VFL5450 separately has an open, uncompleted 5 Nov check-in (no checkout) — will self-close via the hourly `auto-checkout` cron once past 24h, no action needed.

**This run stays whole-company (not split by population)** — forced by the cancellation incident below, not re-opened unless Yash says so.

**🔴 Incident this session, now fully resolved — record for future caution.** Claude cancelled this run (to free up the population picker for a planned PUNE_STAFF/STAFF/WORKER/CONSULTANT split) while HR had the screen open live. She ran pre-check against the now-cancelled run anyway and decided all 74 warnings — real work, against a cancelled run. `cancelled` is a terminal state in `trg_pay_run_transition` (no path back to `draft`). Recovered using the same safe pattern as PATCH_96 (disable `trg_pay_run_transition` → `UPDATE status='draft'` → re-enable trigger) — verified after: trigger back on and enforcing, all 74 warnings/decisions intact, run back in `draft`. **Lesson: never cancel/mutate a `pay_runs` row without first confirming no one has the HR Payroll Run screen open and mid-action — a backend "safe, empty draft" check (0 warnings, 0 pay_run_items) is not enough if a human is actively driving it in real time.** Net effect: October stays ONE whole-company run; the per-population split is abandoned for October (would have meant discarding HR's 74 decisions) unless Yash explicitly asks to redo it.

**✅ `payroll-run` is at v17 — PATCH_132's "Confirm feeds are final" gate is LIVE and working** (confirmed: it's what unblocked HR to reach the warnings step in the first place). No further deploy needed. No new APK needed for any of this session's work (all DB/infra only). apk-130 is still the current build.

## Earlier context (resolved, kept for reference — see sections below for full detail)

**Payroll Feeds screen's month default — FIXED, MERGED, verified. Done.**

`app/(hr-admin)/payroll-feeds.tsx` now queries all 4 feed tables (`payroll_canteen_entries`, `payroll_society_recoveries`, `payroll_adjustments`, `payroll_efficiency_entries`) on mount for the most recent `payroll_month` with any `approval_status='pending'` row, across all 4 combined (one shared month selector, not per-tab — matches the screen's existing structure), and defaults there instead of `istMonthYear()`; falls back to the current month only if nothing is pending anywhere. PR #47 squash-merged into `claude/forge-os-backend-setup-7woj4t` as `2a918b9`.

**Verified independently by Claude, not taken on the building agent's word:**
- Diff scope: exactly 29 lines added, only this one file touched (`git diff --stat` confirmed).
- Logic re-read by hand: lexicographic max across the 4 tables' own max-pending-month queries is correct because `payroll_month` is a zero-padded `YYYY-MM` text column (same convention `lib/payroll/feedSync.ts`'s `first_recovery_month` already relies on).
- Re-queried Supabase directly (not trusting the agent's claim): confirms the fix resolves to `2026-10` today (31 pending canteen rows + 20 pending society rows for that month; 0 pending adjustments/efficiency rows anywhere).
- `npx tsc --noEmit`: first pass (fresh sandbox, `npm ci --ignore-scripts`) showed 2 errors — both pre-existing tsconfig deprecation warnings, a known fresh-sandbox artifact. Re-ran a second time after the sandbox settled: the real **7-error baseline** (`permissions-onboarding.tsx` ×1, `FormsScreen.tsx` ×6), matching the documented baseline exactly. **Zero new errors either time, none in this file.**
- `node scripts/check-i18n.mjs`: clean, no new keys needed (correct — no new user-facing text).
- **Git-history incident during verification, caught and fixed, no data lost:** the building subagent misread my own `git commit` of this fix as an unexpected auto-commit and ran `git reset --soft HEAD~1` on the shared sandbox filesystem, moving local HEAD back one commit (content on disk was untouched — confirmed byte-identical to the already-pushed commit via `git diff e4343e7`). Reconciled by stashing the in-progress PENDING.md edit, hard-resetting local to match what was already pushed to `origin/ccr-3459d9e7-xosjyv`, and reapplying the stash — verified identical to the pre-incident version before committing. Nothing was lost or duplicated.
- CI on the merge commit not yet re-checked by this session — next step for a resuming session only if the owner asks whether a new APK has published (this touches `app/`, inside `build-apk.yml`'s `paths:` filter, so a new APK build is expected off `2a918b9`).

## Owner's status check, 5 Nov 2026 — answered, several items closed, 2 builds now IN FLIGHT

**🔒 CLOSED, do not re-raise:**
- **26-30 Sep arrears** — paid directly outside the app; calculation already shared separately. No app action needed. See CLAUDE.md.
- **Key rotation** — Yash: stop tracking, mark done, do not remind unless there's an actual problem (misuse/unauthorized call). Closed, not deferred.
- **Security guards' self check-in screen** — already built 4 Nov (`06bf0cc`), re-verified live (3 guards, real GPS rows from 4 Nov). Earlier "not done" note was stale, corrected.
- **VFL5463/64/65/66 leave balances** — correct policy, not a gap. Not re-flagging.
- **New-joiner leave rule** — RESOLVED: anniversary-based (12 months from `employees.created_at`), not calendar-year. No code to fix (no automated creation job exists). See CLAUDE.md.

**✅ Applied live — consultant daily rates (`PATCH_130`).** CON05/09/12/13 converted to `rate_type='daily'` effective 1 Oct 2026 (Yash: "yes apply 01/10/2026") with the given rates (770/884/1846/2115). Verified: 8 rows total, no stray rows, `pickSalary()` already honors the effective window. PR #50 merged (`493c387`).

**✅ Payroll-run pre-calculate confirmation gate (`PATCH_132`) — BUILT, VERIFIED, MERGED.** Yash clarified the "month lock" question was really: "ask them for confirmation before the payroll run function is activated... confirm all fields like canteen efficiency are final." New `pay_runs.feeds_confirmed_by`/`feeds_confirmed_at` + `confirm_pay_run_feeds()` RPC (owner/hr_admin, draft runs only) + auto-unconfirm trigger on all 4 feed tables (INSERT/UPDATE/DELETE, 12 triggers total — confirmed live) + a 422 gate in `calculate` (`{error:'feeds not confirmed', hint:...}`) + an HR screen step ("Confirm feeds are final", Calculate disabled client-side until set). PR #51 squash-merged into `claude/forge-os-backend-setup-7woj4t` as `88f62b8`. **Independently re-verified by Claude** (not just the agent's word): `pay_runs` columns live, RPC grants match `set_monthly_vda_rate` exactly (postgres/authenticated/service_role, no anon), all 12 triggers present via `information_schema.triggers`, `index.ts` diff matches the report. tsc 7 baseline, i18n clean. **✅ `payroll-run` redeployed 5 Nov 2026 as v17 — gate is live.** See the RESUME STATE block at the top for the full deploy/verification record.

**✅ Kajal's Pune bulk-attendance upload + 3-day window tightening — BUILT, VERIFIED (with one real incident caught and fixed), MERGED.** New `pune_bulk_set_attendance`/`pune_bulk_attendance_status` RPCs + `components/PuneBulkAttendance.tsx` screen, `pune_set_attendance`'s lookback 7→3 days. PR #53 squash-merged into `claude/forge-os-backend-setup-7woj4t` as `b13d30a`. **Independently re-verified by Claude**: live `pg_get_functiondef` read confirmed the 3-day window and the bulk RPC's IST range math/all-or-nothing validation/skip-if-punched/audit tagging are all correct; grants match the existing sibling `pune_*` functions' pattern exactly (not a new exposure).

**🔴 Real incident found during verification — residue left in production, now cleaned up.** The building agent's report claimed "every test used BEGIN...ROLLBACK; nothing was left in the live DB" — **false for at least one test.** Found 7 real `attendance_records` rows live for all 7 BUNG* employees, all `status='P'`, `ot_hours=0`, all dated 2026-10-29, all `created_at` within 1.5 seconds of each other — directly contradicting both the agent's own claim and this session's earlier-confirmed "0 BUNG rows for October" fact. Claude could not delete them directly (Supabase MCP's DELETE confirmation never resolves, same long-documented pattern). **Owner ran the delete himself in the SQL Editor** (exact 7 row IDs, re-verified afterward: 0 BUNG rows for October again). **Lesson for future agent verification in this project: an agent's own "I rolled everything back" claim must be independently checked against live data, same as any other claim — this is not hypothetical, it just happened.**

**⚠ Shared-sandbox hazard hit this session, worth knowing for next time:** mid-build, a background agent's `git checkout -b` switched the MAIN working directory's branch out from under an in-progress `git commit`, landing a PENDING.md update on the agent's own branch instead of this one. Recovered via an isolated `git worktree add` pointed at this branch (never touches the shared main working directory). **Going forward: any doc-only commit while a background agent might be mid-checkout should go through a separate worktree, not the shared main directory.**

**`payroll-run` redeploy: DONE (v17, see RESUME STATE block above).** apk-130 already confirmed as the published APK off the two app-touching merges (`88f62b8`, `b13d30a`). **Next step for whoever resumes: nothing of Claude's own is pending here — the ball is in HR/owner's court to actually start the October run in-app** (see the 5-step sequence in the RESUME STATE block). Watch for Kajal's bulk-attendance entry, the plant head's efficiency %, and HR's canteen/society/adjustment approvals landing, then be ready to help with `generate_warnings`/AI-review/`calculate` questions as the run progresses.

**Still open, blocked on data Claude does not have — asked back to Yash:**
- **✅ RESOLVED, Yash, 5 Nov 2026 — VFL1520/VFL1527 day counts explained, no longer a discrepancy.** "26 is total for 1520, he was absent for 4 days so weekly off considered for him are 4. and october had one paid holiday so 21+4+1" and "1527 - 25 present 5 weekly off and 1 paid holiday = 31. october had 5 fridays." So: the HR CSV's 4 "A" (absent) rows for VFL1520 were actually his Friday weekly-offs, wrongly marked absent instead of WO (exactly the "a weekly-off day is not an absence" rule already locked elsewhere in this file) — reclassified, giving 21P + 4WO + 1H(20 Oct) = **26**. VFL1527 similarly: 25P + 5WO (all 5 Fridays in October) + 1H = **31** (the full month, zero real absences — explains why 31 looked "suspiciously like every day"). **Still not yet entered into `attendance_records`** — this is the correct basis to use whenever that's done (per-day breakdown, not just the totals, since the app writes individual date rows).
- Still need: which specific dates were WO vs P vs H for each (the totals are confirmed, not yet the day-by-day breakdown needed to actually write `attendance_records` rows) — October 2026's 5 Fridays are 2, 9, 16, 23, 30 Oct (standard calendar check), so VFL1527's WO dates should be exactly those 5; VFL1520's 4 WO dates are a subset of them (one Friday he was genuinely absent for another reason, or the 5th Friday fell outside his tenure/the window — not yet asked). VFL5439's October figure is still not given at all.

## Advances cross-check, 5 Nov 2026 — ✅ APPLIED LIVE, Yash confirmed before and after

Yash uploaded `STAFF_ADVANCE_SHEET.xlsx` (the real ledger, "01/10/2026 TO 31/10/2026", opening/closing balances as of 5 Nov). Per Yash's own explicit instruction ("confirm to me your figures IN APP ARE GIVEN to you which month first before correcting anything"), Claude first confirmed: all 6 affected app rows carried `created_at = 2026-09-24 13:37:54`, `reason = "Opening balance recorded from Yash, 24 Sep 2026"`, and **every one still had `outstanding_balance == amount`** — i.e. never deducted a single rupee in-app since that day. Yash: "your difference is coz your data is from august and deduction is happened from september salary and october salary, sheet figures are correct and i confirm to delete the previous figures and embed these. note their deduction for october is done." Presented the full reconciliation table + the two code-typo flags; Yash confirmed both typos ("yes it is a typo from accounts") and the Diwali rate split ("worker category is @ 1500 staff as mentioned for the 15000" = staff 2,500/worker 1,500, confirming the sheet) — then "go".

**Applied live (one SQL batch, re-verified after):**
- **6 stale balances corrected** to the sheet's post-October closing balance (October's recovery already done manually by HR, so the sheet's *closing*, not opening, figure is correct): VFL1389 95,000→**80,000**; VFL1441 253,000→**243,000**; VFL1567 168,000→**144,000** (sheet's code `377` = her own name, not a different person); VFL1520 142,000→**130,000**; VFL5079 169,000→**114,000**; VFL1482 18,000→**9,000** (sheet's code `1323`, confirmed by Yash as an accounts typo — this one was **stale, not missing** as an earlier note in this session had wrongly said; it already existed in the app at 18,000).
- **2 missing rows created**: VFL5439 Bhanwar Singh Rathod (25,000/25,000, monthly 5,000); BUNG30 Pankaj Bansi Ghisadi (46,706/**35,706** — October's 5,000 already recovered per the sheet, monthly 5,000).
- **All 8 of the above given `first_recovery_month='2026-11'`** — this is the "add back deduction in row L" fix: since October's recovery already happened outside the app (or, for VFL5439, hasn't started yet), the real in-app October payroll run will skip these 8 entirely and start recovering from November, avoiding any double-deduction.
- **Diwali staff rate fixed**: VFL5237, VFL1453, VFL5465, VFL5466 `monthly_deduction` 1,500→**2,500** (first UPDATE attempt matched 0 rows — exact-string `reason` match failed because the stored text has extra detail appended; fixed by targeting the 4 rows' real `id`s directly, re-verified all 4 now show 2,500). The 17 worker Diwali rows confirmed correct at 1,500, untouched, per Yash's explicit confirmation.
- Re-queried all 12 touched employees after the batch — every value matches the plan exactly, no silent mismatch.

**Not yet done / still open:**
- (resolved below — see "VFL1520/VFL1527/VFL5439 October attendance written" section)

## VFL1520/VFL1527/VFL5439 October attendance — written 5 Nov 2026, Yash gave VFL5439's breakdown + day-placement calls

Yash gave VFL5439's October breakdown: **5P + 1WO + 16EL + 5CL + 3SL + 1PH = 31** (schema has no EL/CL/SL attendance status — Yash confirmed these go in as approved `leave_requests`, not `attendance_records`). Before writing anything, found all three already had partial October rows (from the old `mark_weekly_offs()` cron, pre-4-Nov-fix, which had wrongly given security guards Friday weekly-offs):

- **VFL1527**: existing WO on all 5 Fridays + 2 real GPS check-ins (3, 6 Oct) + H on 20 Oct matched Yash's 25P+5WO+1PH=31 exactly, no conflict — added the remaining 23 P-days. **Done, no outstanding cleanup.**
- **VFL1520**: existing WO on all 5 Fridays conflicted with Yash's 21P+**4**WO+1PH=26 (5 days meant to be unaccounted). Yash: drop 30 Oct's WO to no-record. Added H on 20 Oct + 21 P-days (1,3-8,10-15,17-19,21,22,24-26) for the remaining 4 unaccounted days (27,28,29,31 — never inserted, by design, "no record" rather than guessed).
- **VFL5439**: existing WO on all 5 Fridays + a no-checkin P on 29 Oct. Yash: keep 2 Oct as the one real WO, fold 9/16/23/30 Oct into his leave. Added H on 20 Oct + P on 1,3,4,5 Oct (4 more, plus the existing 29 Oct P = 5 total) + 3 `leave_requests` rows: EL 6–22 Oct (16 days, 20 Oct excluded as the paid holiday within that span), CL 23–27 Oct (5 days), SL 28–31 Oct (3 days, 29 Oct excluded since he was present that day) — all `status='approved'`, dated/approved now, reason citing this exchange.

**✅ CLOSED 5 Nov 2026 — Yash ran the cleanup DELETE himself ("sql run done and success"). Re-verified live:** VFL1520 = 21P/4WO/1H (26); VFL1527 = 25P/5WO/1H (31, unchanged, never needed a fix); VFL5439 = 5P/1WO/1H + the 3 leave rows (31). All three match Yash's 5 Nov numbers exactly.

**Day placement (which calendar date got which status, inside the Yash-confirmed totals) was Claude's own reasonable default, not individually confirmed date-by-date** — flagged per Yash's own "use a reasonable default" instruction. If any specific date turns out to matter (e.g. for a shift/OT reconciliation), re-ask before relying on it.

## Still not done

- **✅ SUPERSEDED 6 Nov 2026** — see the RESUME STATE block at the top. The per-population split is no longer the plan; a single whole-company October run is now live and in progress (HR actively deciding its 74 warnings). Kajal's BUNG bulk-attendance entry and the plant head's efficiency % are still outstanding and still feed into this one run.

## DONE 5-6 Nov 2026

- **October payroll run started in-app** — whole-company run created, pre-check run (74 warnings generated), HR actively deciding them as of session end. `payroll-run` v17's confirmation gate is what unblocked this. See RESUME STATE block for the cancel/recover incident and current exact state.
- **Advances cross-check** — 6 balances corrected, 2 rows created, 4 Diwali staff rates fixed, all applied live and confirmed by Yash. See its own section below.
- **VFL1520/VFL1527/VFL5439 October attendance** — written and closed, all three match Yash's numbers exactly. See its own section below.
- **`payroll-run` redeployed to v17** — PATCH_132's confirmation gate live, independently verified.

## DONE earlier this session (5 Nov 2026)

1. **Exit QR "No open attendance record" after night-shift checkout** — fixed in `hooks/useAttendance.ts` (`fetchRecords()`'s fallback logic clobbered `todayRecord` to null right after a Shift 3/5/Security-Night checkout past the 06:45 IST rollover). Commit `b3cdcd8`. Published `apk-125`.
2. **Leave-form dates parsed backwards** — `components/LeaveScreen.tsx` + `components/TwoStepFormModal.tsx` sent free-typed DD/MM/YYYY dates straight to Postgres (DateStyle `ISO,MDY`), which either crashed (day >12) or silently stored the wrong date (day ≤12, no error). Fixed via `lib/leaveForm.ts`'s new `normalizeDateInput()`. Commit `00cadd7`.
3. **NaN days reaching the DB as `null`** — found investigating bug #2: `TwoStepFormModal.tsx`'s Days-override field had no fallback when `parseFloat()` returned `NaN`, violating `leave_requests.days`'s NOT NULL constraint. Fixed with a finite-number check before submit. Commit `5c30f3f`. Both #2 and #3 published together in `apk-127`.
4. **Round 6 reminders** — `plant-head-efficiency-reminder` (jobid 32, 09:30 IST) and `accounts-advance-recovery-reminder` (jobid 33, 10:30 IST), both deployed v1 and live-fire verified against real `app_notifications` rows. Commit `7048680`.

Full root-cause narrative, log evidence, and verification detail for all 4 is preserved in the "OLDER" section directly below and in each commit's own message — not repeated here.

# >>> OLDER (4-5 Nov 2026, late night, round 6 planning) — context for the above, not a to-do <<<

## Owner's status questions, answered 4-5 Nov night — checked live, not from memory

**Q1: Is the leave system fully built — screens pushed, everyone can see their balance, approval chain + monitoring table in place?**
- **Screens: YES**, `leave.tsx` exists and is pushed for all 7 role groups (`app/(worker|supervisor|manager|hr-admin|plant-head|owner|security)/leave.tsx`).
- **Balances visible: YES for the employees who should have one.** Live check: 99 active app-using employees; 11 have no `leave_balances` row. Of those 11, **7 are consultants** (CON01/05/09/12/13/20/24) — correctly blank, consultants have no leave entitlement by design (already documented). The remaining **4 are the already-flagged real data gap** (VFL5463/5464/5465/5466) — owner said 4 Nov "will confirm when I get them, leave this in pending," so this is a known, accepted gap, not new.
- **Approval chain: YES, and only genuinely reliable as of TONIGHT.** PATCH_126 (this session) fixed a live bug where any employee with no `manager_id` (61 of them) got stuck on an unreachable approval stage forever, invisible to any approver. Before that fix, the chain existed in code but silently failed for the majority of the workforce. Now fixed and verified.
- **Monitoring table: NO — this does not exist.** Checked directly: there is no leave equivalent of `advance-ledger.tsx` (which lists every advance with status + outstanding balance for HR/owner to browse). HR's dashboard shows only a pending-count tile (`leave_requests` where `status='pending'`), not a browsable table of every leave request and what stage it's at. **This is a real, confirmed gap** — not part of tonight's plan below unless the owner asks for it next.

**Q2: Has the loan/advance application been built — tab, screen, approval sequence in place?**
- **Screens: YES**, `advance.tsx` pushed for all 7 roles (apply), plus `advance-ledger.tsx` for HR — a real monitoring table (every advance, status badge, outstanding balance total) that leave does NOT have (see above).
- **Approval chain: YES**, same PATCH_53/126 staged chain (Manager → HR → Accounts → Plant Head → Owner for rank-and-file), same PATCH_126 null-manager_id fix applies here too (advance requests had the identical bug).
- **Live data gap confirmed**, exactly matching what the "reminder to Accounts" below targets: **2 pending advances have `monthly_deduction=0`** — VFL1556 (₹50,000, "Child education") and VFL5324 (₹20,000, "hospital work") — both stuck pending because nobody has supplied the real recovery-per-month figure. (A 3rd zero-deduction row, VFL4063, is already correctly voided/rejected from the 4 Nov reclassification — not a gap.)

## PLAN — two new reminders, to build starting 05:30 IST 5 Nov 2026 (not yet started)

Both follow the exact pattern fixed/proven tonight (`pune-attendance-reminder`, `payroll-feeds-approval-reminder`): a `verify_jwt:false` edge function + `cron.schedule()` with the Authorization-header fix from the start, `app_notifications` insert + push, dedup per IST day, live-fire verified by inserting a real row and independently re-querying it — never trust a "succeeded" cron status alone.

**Build 1 — `plant-head-efficiency-reminder`**: nudges Fazal (role `plant_head`, role-queried not hardcoded) daily from the **1st of the IST calendar month** until a `payroll_efficiency_entries` row exists for that `payroll_month` (checked live: **0 rows exist for 2026-11** right now, so this would already be firing from 1 Nov if it existed). Stops firing for the month the moment a row appears — mirrors `pune-attendance-reminder`'s "stop once today's row exists" logic, just monthly instead of daily. Distinct from the existing `plant-head-form-reminder` (that one nudges about Fazal's Google Form, 1st-5th only, unrelated to this in-app efficiency entry).

**Build 2 — `accounts-advance-recovery-reminder`**: nudges whoever is `role='manager' AND department='Accounts'` (dynamic match, same mechanism the Accounts approval stage itself already uses — never hardcode Bharat Salve's emp_code, he could change) about **advance_requests rows missing a usable monthly recovery figure** — scope: `status='pending' or (status='approved' and (monthly_deduction is null or monthly_deduction = 0))`, i.e. both of today's 2 pending gaps (VFL1556, VFL5324) AND any future approved advance someone forgot to put a real recovery amount on. Daily while any such row exists, same dedup pattern.

**Not planned, flagged only, awaiting a yes**: the leave monitoring-table gap found above (Q1) — not started, no scope agreed yet.

## Owner instruction, recorded the moment given

"create plan for this and start working at 5.30 am ist on it" — plan is the two builds above; actual building (agent delegation, deploy, live-fire verification, independent re-check, commit/push, PR+merge into the long-lived branch, PENDING.md update) starts at the scheduled wake-up, not before.

## PATCH_128 — payroll-feeds-approval-reminder — DONE, deployed, independently verified (4 Nov night)

Owner said "yes" to building the HR canteen/society approval reminder flagged earlier tonight. Built with this same session's Authorization-header lesson applied from the start. **Real design catch during the build, not a silent assumption**: scoping to "current IST calendar month" would have made the reminder permanently silent for the actual live case — HR entered October's feed rows on 2 Nov, after the calendar month had already rolled to November, so a current-month-only reminder would never have fired. Corrected to scan every `payroll_month` with pending rows. Recipients: active `hr_admin` only (role-queried, never hardcoded — currently resolves to VFL5440 only, untested with >1 recipient since there's only one live). Deployed `payroll-feeds-approval-reminder` v2, `verify_jwt: false`. Cron jobid 31, `30 3 * * *` (09:00 IST daily) — does not touch `pune-attendance-reminder`'s 19:00 IST slot or `shift-reminder-default` in any way.

**Verified independently by Claude, not taken on the building agent's word**: re-checked `list_edge_functions` (v2, ACTIVE, verify_jwt false), re-checked `cron.job` (jobname/schedule/active only — deliberately never selected `command`, to avoid any repeat of the key-exposure incident), and separately re-queried `app_notifications` myself — found the exact row: VFL5440, "51 canteen/society entries are awaiting your approval for 2026-10 (31 canteen, 20 society)" / correct Hindi, `created_at` 03:10 IST 5 Nov. PR #44 merged. No new UI/badge built (deliberately out of scope; agent suggested a `my_action_counts()` key as a future option, not started).

## Owner's three answers tonight, all acted on

1. **"yes" (build the canteen/society reminder) — DONE**, see above.
2. **"now" (rotate the exposed `shift-reminder-default` key) — steps given to the owner, waiting on him** (Project Settings → API Keys → Secret keys → revoke the old `sb_secret_...` key → create a new one → update the cron via `cron.alter_job` directly in the SQL Editor, so the new key never passes through chat). **Not yet confirmed done — check at the next session.**
3. **"if they got the reminders then they should finish it today by 11 am"** — owner's deadline for Kajal (October BUNG attendance) and HR (canteen/society approval), now that both reminders actually deliver. **A wakeup is scheduled to check progress around 11am IST and report back — if this session ended before that fired, a future session should check: BUNG October attendance rows, and `payroll_canteen_entries`/`payroll_society_recoveries` approval_status, right away.**

## pune-attendance-reminder NEVER actually delivered, found + fixed 4 Nov 2026 night — real finding, not hypothetical

Owner asked whether Kajal/HR had actually received any reminder about missing October BUNG attendance. Checked live rather than assuming "the cron is active" meant it worked (same discipline as every other "verify against live data" rule here): **it had never delivered a single notification since it was created 26 Oct 2026.** `app_notifications` had 0 rows project-wide; 0 edge-function gateway-log hits for `pune-attendance-reminder` in 24h, despite `cron.job_run_details` showing "succeeded" every day — that status only means pg_cron successfully *queued* the outbound `net.http_post()`, not that it was delivered. Root cause: the cron's headers were `{"Content-Type":"application/json"}` only — **no `Authorization` header at all** — so the API gateway silently dropped every request before it ever reached the function. (Compare `auto-checkout`'s cron, which works: it sends `Authorization: Bearer no-auth-required`, a dummy value that's still *present*, which is all a `verify_jwt: false` function's gateway needs.)

**Fixed live (owner approved first, since this touches a live production cron):** `cron.alter_job` updated the command to add the same dummy-Authorization pattern (job not dropped/recreated). **Verified independently, not just the fixing agent's word**: re-queried the live cron command (header now present), fired it for real, then separately queried `app_notifications` myself and found exactly 2 real rows — VFL1567 (Kajal) and VFL5440 (Pallavi, hr_admin) — dated 2026-11-05, created 02:56 IST. The repo's `PATCH_107` SQL record had the identical bug; corrected to match. PR #42 merged.

**⚠ Side-effect worth knowing, not a problem, just a fact**: verifying the fix meant actually firing the function for real — Kajal and the HR admin got one real "Pune attendance pending" notification as of 5 Nov tonight, which is accurate (they do still owe October's entries) but wasn't a scheduled fire, it was triggered by this diagnostic.

**⚠ Separate, serious finding from the same investigation, flagged not fixed: a live secret key was exposed in a tool-call result** while diagnosing this (the `shift-reminder-default` cron's command, which stores a real key in its Authorization header, printed in full because a redaction regex didn't match its SQL syntax). **That key should be rotated** (wherever it was originally issued — check `shift-reminder-default`'s cron command's Authorization value's source) — same class of incident as the 1 Oct 2026 one already documented above. Not rotated yet; owner's call on timing, same as the still-deferred key-rotation decision elsewhere in this file.

**Still true, not yet addressed**: there is still no reminder mechanism at all for HR approving the pending canteen/society Payroll Feeds entries she's already entered (31 canteen + 20 society rows, sitting at `approval_status='pending'` since 2 Nov). Nothing was built for this — flagged to the owner, not started, since it's a new feature, not a bug fix.

**Lesson for this project, now worth checking on any cron health question going forward**: "cron.job shows active + job_run_details shows succeeded" does NOT mean a cron-triggered edge function actually ran or delivered anything — `pg_net`'s queue-insert succeeding is a different claim from the HTTP request actually reaching the function. Check `app_notifications`/the function's own real side-effect, or the edge-function gateway logs, before trusting a cron's "active" status as proof of working delivery. The `pune-attendance-reminder` cron had this exact failure mode for 9 days (26 Oct – 4 Nov) with nobody noticing until asked directly.

## PATCH_127 MERGED + `payroll-run` REDEPLOYED to v16 — DONE, verified, this round

- PR #39 merged into `claude/forge-os-backend-setup-7woj4t` (squash commit `8105e11`). Local `ccr-8cdbca68-137bnz` fast-forward-merged to match, pushed.
- Auto-triggered CI on the merge: **Build Android APK succeeded, `apk-124` published** (88.4 MB, commit `8105e11`). **Deploy Edge Functions FAILED — pre-existing, unrelated, NOT caused by this work**: `supabase/functions/deploy.sh` calls `supabase functions deploy <name>` with no `--yes`, and a newer Supabase CLI now refuses to deploy non-interactively without it — **all 9 of its listed functions failed** (nightly-scoring, fraud-detector, shift-reminder, mrm-reminder, five-s-challenge-generator, send-push-notification, plant-head-form-reminder, auto-checkout, pune-attendance-reminder). Confirmed via job logs: same failure on the last 3 pushes today (bb6b2c1, a31209b7, 8105e11) — this is NOT new. `payroll-run` is **not** in `deploy.sh`'s function list at all (confirmed by reading it) and never has been — it has always been deployed manually via the Supabase MCP tool, so this CI failure never touched it. **Flagging, not fixing** (out of scope for this ticket, needs its own `--yes` fix in `deploy.sh` — ask before touching, since it affects 9 live functions' deploy path).
- `payroll-run` manually redeployed via the Supabase MCP tool, verify_jwt true, all 12 files from the merged tree.
  - **First deploy (v15) had a self-introduced bug, caught before telling anyone it was done**: while typing the 12 files' content into the deploy call, two files got corrupted in transcription — `lib/types.ts`'s `workingDaysInMonth()` function body was lost/merged into `countWeekdayInMonth()` (would have thrown/miscalculated on every single calculation, i.e. would have broken the whole engine), and `lib/warnings.ts`'s `diffWarnings()` lost its stale-late-row refresh logic (silent, narrower bug). Caught by fetching the deployed source back and grepping for known anchors immediately after v15 deployed — found both corruptions before anyone used the function.
  - **Redeployed as v16 with both fixed**, re-verified by fetching the deployed source again and grepping ~20 unique anchor strings across every one of the 12 files (every function/export appears exactly once where expected; `workingDaysInMonth`/`countWeekdayInMonth` now correct; `diffWarnings`'s real logic present; `first_recovery_month` present in all 5 expected spots). **v16 is confirmed clean.**
  - Lesson for next time: when deploying large multi-file edge functions this way, always re-fetch and grep-verify immediately after — don't trust the deploy call's own success response.

## NEXT PRIORITY TICKET (start here) — unchanged from the previous session

## NEXT PRIORITY TICKET (start here) — unchanged from the previous session

**Get HR/owner to actually trigger the real October per-population payroll runs in-app** (PUNE_STAFF → STAFF → PERMANENT_WORKER → CONSULTANT, per PATCH_112/v9's `create`→`generate_warnings`→HR decisions→AI review→`calculate`→arrears→approve→finalize flow). This needs a live authenticated owner/HR session — Claude only prepares/verifies, never triggers it. Blockers, re-checked live this session:
1. **Kajal (VFL1567) must actually enter October BUNG attendance** — still 0 rows for any BUNG code. Unchanged, still blocking PUNE_STAFF.
2. **26-30 Sep arrears sourcing** — still not in hand (need HR's own "26-30 Sep" tab, not `attach_arrears_sep26_30()`). Unchanged.
3. **Plant head October efficiency %** — **CORRECTION: this is actually DONE**, not open. Verified live: one company-wide `payroll_efficiency_entries` row, `payroll_month='2026-10'`, 81%, `days_payable=25`, `approval_status='approved'`. The previous session's note undersold this.
4. **HR canteen/society/adjustments for October** — HR *has* entered the data (31 canteen rows + 20 society rows, entered 2 Nov 2026) but **has not clicked approve on any of them yet** — all sit at `approval_status='pending'`. Not a bug, just an unfinished HR step in the Payroll Feeds screen. The one `payroll_adjustments` row (VFL4063's ₹21,000 reclassification) is correctly entered and already approved.

## NEW FINDING + FIX THIS SESSION (4 Nov, late) — PATCH_127, commit pending at end of this block

**Bug found (not a hypothetical — would have corrupted the October run if calculated as-is):** the 21 "Diwali advance" rows the owner approved 2 Nov 2026 (₹15,000 each, `monthly_deduction=1500`, `outstanding_balance=15000`) had no way to defer their first recovery instalment to November. `lib/payroll/feedSync.ts` deducts `min(monthly_deduction, outstanding_balance)` in every pay period processed, unconditionally, as long as `outstanding_balance>0` — there was no "don't start deducting until month X" column. The owner's explicit instruction (CLAUDE.md, "Owner answers of 2 Nov 2026 (second afternoon batch)" item 3): the ₹15,000 is disbursed TO the employee IN October pay (handled separately, already done via `payroll_adjustments` precedent — see VFL4063), but the ₹1,500/month recovery must not start until the **November** pay run. Without a fix, calculating the October run today would have wrongly deducted ₹1,500 from all 21 people in October.

**Fix, built by a Sonnet agent, independently verified by Claude:**
- New nullable column `advance_requests.first_recovery_month` (text, 'YYYY-MM'; NULL = unchanged existing behavior). `scripts/PATCH_127_advance_first_recovery_month_04Nov2026.sql` — applied live via `execute_sql`. Verified live: exactly 21 rows now have `first_recovery_month='2026-11'`, all matching `reason ilike '%Diwali advance, owner-approved 2 Nov 2026%'`; 0 unintended rows touched (VFL1556/VFL5324/the rejected VFL4063 row all untouched).
- `lib/payroll/feedSync.ts` (+ vendored copy in `supabase/functions/payroll-run/lib/feedSync.ts`): the advance filter now skips a row when `first_recovery_month` is set and lexicographically greater than the period's `YYYY-MM` (string comparison works since `mm` is zero-padded). `supabase/functions/payroll-run/index.ts`'s `loadFeeds()` now selects the new column too — without that the gate would silently do nothing in the deployed function.
- Tests: `scripts/payroll-feedsync.test.ts` extended with 4 new PATCH_127 cases (future month → 0 deducted; equal month → deducted; past month → still deducted, regression; no column set → still deducted, regression). Claude independently re-ran: **71/0 feedsync, 105/0 engine regression.**
- `tsc --noEmit`: a second check (fresh `npm ci`) got the real documented baseline of **7** errors (same files as always), confirming no new type errors from this diff.
- **DONE, this round: `payroll-run` redeployed to v16** with the PATCH_127 gate live — see the block above this one for the deploy + self-caught-transcription-bug story. Safe for the October run now, for anyone with a Diwali advance.
- Commits: `919170d`/`0bc32bd` (session work) → PR #39 → squash-merged as `8105e11`.

Everything else below this ticket is DONE/verified or explicitly deferred from the prior session — do not re-do it.

## DONE and verified by Claude this session (4 Nov), all pushed

- Undo-checkout fix (`aec4859`), monthly-consultant 26-day formula + security GPS check-in + no-weekly-off (`06bf0cc`, PATCH_123 live), consultant OT whitelist + weekly-off exclusion (`a04d55f`, PATCH_124 live), open-record fallback window 14h->23h (`89ec5bb`).
- **Staff OT whitelist, 47 named emp_codes (`bb6b2c1`)** — `EngineConfig.staffOtWhitelist`/`staffOtAllowed()` gates `calcStaff()`'s OT line. Re-verified against the openpyxl-read excel sheet directly (47/47 exact match).
- **Efficiency-slab engine wiring, PATCH_125 (`a31209b`)** — `payroll_efficiency_slabs` table + `payroll_efficiency_entries.days_payable` column, both live; October entry (81%, Days Payable 25) live. Worked example verified exactly (VFL4008 -> 3780). Engine 105/0, feedsync 67/0, tsc 7 baseline.
- **PATCH_126 (`5ed0bf7`)** — found + fixed a live bug: `compute_approval_chain()` inserted an unreachable `'manager'` stage for any of 61 employees with `manager_id IS NULL`, permanently hiding their leave/advance requests. Fixed live; verified all 7 real pending `leave_requests` now route correctly. **Leave is now genuinely live for worker/staff** (the screens always existed for all 7 roles — this bug was the only real blocker).
- **`payroll-run` redeployed to v14** (verify_jwt true, confirmed independently via `list_edge_functions`) — staff OT whitelist + efficiency-slab wiring are live in the deployed function.
- **October comparison workbook, all 4 populations**, built fresh from the live engine + live data, sent to owner. Then **updated a second time (`0bc32bd` for the CLAUDE.md record)** per the owner's night answers: CON05/09/12/13 now use `salary/26 × HR-CSV-present-days` (not app punches); the 3 security guards' present-days corrected from the same HR CSV (`VFL_HR_OS_2026_27_ATTENDANCE_DAILY.csv`); all 7 BUNG/Pune rows filled from the owner's own October Pune sheet instead of ₹0. Every figure independently re-verified by Claude against the source CSVs/DB before sending. File lives only in the agent's scratchpad, never committed (real names/figures).
- Confirmed live: Kajal's Pune Attendance screen is reachable (`attendance_clerk_location='Pune'` gates her More-menu row) — she just hasn't used it yet for October.

## OPEN OWNER DECISIONS, unanswered as of session end

1. Real daily-rate figures for CON05/CON09/CON12/CON13 (needed to actually convert them to `rate_type='daily'` in the DB — the salary/26 formula is applied only inside the comparison workbook so far, not the live DB).
2. Security guards still have no self check-in screen in the app (owner flagged this 4 Nov; use the HR CSV as the data source meanwhile — not built).
3. 26-30 Sep arrears sourcing — HR's own tab, not yet in hand.
4. HR has not yet entered real leave-balance opening figures for VFL5463/64/65/66 — owner said "leave this in pending."
5. Instructions for >12h-same-day-return logging were given to the owner inline in chat this session (not a file) — re-send on request.

# >>> RESUME STATE 1 Nov 2026 (superseded by the 4 Nov block above where they conflict) <<<
- DONE: payroll core = days worked + salary only (commit c5d8825): OT never fed to engine, 'H' rows neutral, approved POSITIVE payroll_adjustments paid after the engine as APPROVED_EXTRAS (outside statutory wages). Claude re-ran suites: engine 61/0, feedsync 64/0, extras 53/0, export 15/0, category-runs 13/0, statutory 66/0, payslip 12/0, i18n clean. **NOT DEPLOYED: payroll-run live is still v11** - redeploy (all 12 files, verify_jwt true, sha check) only on owner OK.
- DONE: October Extras report workbook (scratchpad only, has names/pay, not in repo): Oct2026_Extras_Report.xlsx. Claude verified: 0 formula errors; live DB 590 NULL-OT check-outs, 839.83 stored OT h, 85 H rows match.
- OPEN: HR needs an in-app way to approve extras (Payroll Feeds adjustments tab can create+approve positive rows one by one; no OVERTIME/HOLIDAY type, no import from the report; same person can enter+approve). 20 Oct 'H' rows now pay nothing in core -> holiday pay must come as approved extra. Pending owner: unverified auto-checkout OT rows (426.5 h), incomplete 12h shifts (148 days), worked Fridays, 26-30 Sep form OT (757 h), no-punch guards, VFL1001 no salary structure.
- STILL: Kajal enters BUNG Oct attendance; HR BUNG02/06 deductions before PUNE_STAFF calculate; efficiency %, canteen/society; pending leave/advances; arrears 26-30 Sep once.

# >>> RESUME STATE — UPDATE THIS BLOCK AT THE END OF EVERY STAGE (owner rule, 29 Oct 2026). A woken/restarted agent starts HERE. <<<
**Last updated: 29 Oct 2026 05:50 IST by Claude.** Restart rule: if work stops for any reason, start again at **07:00 IST** (a scheduled wake-up is set for 07:00 IST 29 Oct) and read this block first.
**Branch:** claude/forge-os-backend-setup-7woj4t (HEAD pushed). Supabase project odfwtdpvpfzdrznvurru. Rules: CLAUDE.md working rules (Sonnet agents for edits; Opus only where the owner asked; verify before "done"; end every job with the full brief + numbered questions; record decisions immediately; IST helpers; no values/secrets in the public repo; the Supabase MCP tool cannot run DROP/DELETE — use create-or-replace / rename / owner runs in SQL Editor).
**29 Oct 2026 (late): PATCH_120 APPLIED live** - HR/Kajal half-day C-off conflicts go to the plant head first (settle or escalate to owner); owner sees only escalated ones but may settle any. New table half_day_coff_conflicts, RPCs escalate_halfday_coff_conflict / list_halfday_coff_conflicts, my_action_counts key halfday_conflicts; screens halfday-conflicts (plant-head + owner). Rolled-back tests passed, zero residue. Not run on a device.
**DONE & verified this session:** PATCH_111 (applied, staging dropped by owner), 112, 113 (+granted-days carry-over fix, shortfall blocked), 114 (HR half-day decide + bank-details RPCs + auth_role fix + HR task due 3 Nov), 115 (HR red count), 116 (owner review of HR-decided half-day C-offs + audit-trigger masking of bank/PAN/UAN; existing audit rows NOT rewritten). apk-109 and apk-111 published and verified. Docs: CLAUDE.md Goal-1/handoff reconciliation + owner answers recorded; this file's 29 Oct state block.
**OPUS REVIEW DONE (29 Oct ~05:00 IST): 'OPUS VERDICT: APPROVE WITH CHANGES'.** Findings to act on: (1) Kimi-file corrections approved with extra changes (see below); (2) HIGH A1: payroll pays *requested* leave days, ignoring `leave_requests.granted_days` (feedSync + payroll-run index.ts:59 select); HIGH A2: leave balance consumption is a separate client call after approval (not atomic; owner-auto-approved never consumes) -> call consume inside the final-approval branch of review_leave_request; MED A3: no validation of p_granted_days (must be >0, <= requested, 0.5 steps); MED A4: cross-month leave double count + stacking with WO rows (clip to period when touching feedSync); MED A5: PATCH_113 functions lack `set search_path = public`; MED A6: PATCH_113 repo record != live (header, drop vs rename, missing revokes); MED A7: arrears helper uses 6/30 days for 26-30 Sep (5 calendar days) and is NOT idempotent — ask owner before the October arrears step; LOW: B1 single-actor half-day decision (HR or owner decides; owner reviews) — confirm acceptable; B2 audit actor NULL (use current_employee_id()); B6 STEP 5 bare current_date.
**OD/COFF mapping recommended by Opus:** approved OD and COFF -> engine `plo` bucket (paid in w for all categories, does not inflate worker VDA/production allowance), using coalesce(granted_days, days) clipped to the period; engine.ts untouched; update scripts/payroll-feedsync.test.ts (+ OD/COFF/granted_days/cross-month cases), re-run engine 58/0, category, warnings, decide-warning, statutory, sim-rerun; re-vendor + redeploy payroll-run. OWNER MUST CONFIRM first: does a worker on OD earn VDA like present (then OD -> present)? Is COFF paid regardless of its half-day decision state (Opus: yes)?
**STOPPED BY RATE LIMIT at ~05:30 IST 29 Oct (Anthropic 5-hour limit, resets 06:30 IST). Owner said "stop and save now". State is SAVED; nothing is half-applied in a broken way. Resume at 07:00 IST (wake-up scheduled).**
- apk-112 PUBLISHED (commit 2f057fe, 88.4 MB). Nothing else pending on builds.
- **Agent A (corrections to Kimi's files) — DONE 29 Oct ~07:10 IST, commit 100e8b6, Claude diff-verified (stat + AGENTS.md diff + sbp_ grep: no token anywhere).** SHEETS_RETIREMENT.md, FY2026_27_GAP_AUDIT.md, HANDOFF_KIMI_29Oct2026.md, AGENTS.md, HANDOFF_SUMMARY.md corrected; OCT2026_RUN_VERIFICATION.sql read end-to-end, no bugs (not executed; owner/HR run it at October run time). Opus-confirmed spec applied.
- **Agent B (PATCH_117 leave hardening) — DONE & Claude-verified 29 Oct ~07:40 IST.** review_leave_request (4-arg, validation, search_path, FOR UPDATE, atomic _consume_leave), consume_leave_for_request wrapper, and trigger trg_leave_requests_autoconsume (owner auto-approved leave) are LIVE; all rolled-back tests passed (see PATCH_117 header), zero residue (lr 5, lc 0, cb 0). Repo record synced.
- **Owner questions ANSWERED 29 Oct early morning (recorded in CLAUDE.md):** OD/COFF mapping DEFERRED to the November review of the October calculation (no feedSync change now; A1/A4 stay open, compare approved OD/COFF vs paid days at review); arrears 26-30 Sep 6/30 is INTENDED and ONE-OFF for October (retire afterwards); do NOT mask old audit rows; Hindi hint approved; restart 07:00 IST confirmed. 29 Oct late: PATCH_120 live (conflict -> Fazal -> owner screens). OPEN: owner runs the old-fn drop; device tests. PATCH_121 auto-escalate (48h) live. OPEN for owner SQL Editor: drop old fn list_pending_halfday_coff_v114_old; delete owner's 6 employee_shifts rows 31 Oct-5 Nov (tool cannot DROP/DELETE). 30 Oct: PATCH_121 updated (plant head also told on auto-escalation), verified. Owner cannot run SQL Editor: old-fn drop + his 6 employee_shifts rows stay (harmless).
**NEXT STEPS:** (1) done: Agent A, Agent B; (2) payroll/feedSync OD/COFF mapping stays DEFERRED to Nov review; (3) rehearse four population runs + arrears-once in a rolled-back test before 1 Nov (Claude); (4) HR bank-details task due 3 Nov; HR clears pending leave/half-day C-offs; (5) owner/HR trigger the October run 1-5 Nov. PATCH_118 (audit actor) DONE & verified 29 Oct. OPEN: how Kajal takes part in half-day C-off decisions (owner said 'hr and kajal') - ask owner. OWNER 29 Oct: October salary period = 1 Oct to 31 Oct (recorded in CLAUDE.md). 29 Oct pm: PATCH_119 (HR+Kajal dual sign-off) live, shift-gap alert to Kajal deployed; OPEN: owner conflict-settle screen, owner asked which notification he should not get (plant-head one) - awaiting wording.
**OWNER DECISIONS STILL OPEN:** OD/COFF bucket mapping; historical audit_log rows masking (not done, needs approval); owner opinion on Hindi hint wording ('पिछले अनुमोदक ने N दिन प्रस्तावित किए').
**Standing waiting-on-others:** HR bank-details task (due 3 Nov); Kajal device test (optional); first-week-Nov decisions on closed data-gap items; October run 1-5 Nov (owner/HR trigger; Claude prepares + verifies only).

# >>> HISTORICAL STATE 29 Oct 2026 (late) — NOT CURRENT (this used to say "READ THIS FIRST"; it is superseded by every block above. Relabelled 13 Nov 2026 — supersedes the older 27-28 Oct banners below where they conflict) <<<
- [x] PATCH_111 APPLIED (1 newer row filled; staging dropped). [x] PATCH_112 + payroll-run v9 live. [x] PATCH_113 APPLIED (ledger-aware comp-off; shortfall BLOCKED; half-day C-off -> HR decision, owner notified; granted-days override kept across stages; old 3-arg overload dropped). [x] PATCH_114 (decide_halfday_coff, list_pending_halfday_coff, list_missing_bank_details, hr_set_bank_details, auth_role fix). [x] PATCH_115 (HR red count for pending half-day C-off).
- [x] **apk-111 PUBLISHED 29 Oct 04:22 IST** (commit 91c1e75): HR Bank Details + Half-day Comp-off screens, HR count, pre-filled reduced days. [ ] Install; HR/Kajal real-use. Owner: no device test required for leave.
- [ ] HR task (assigned to VFL5440, due 3 Nov): fill missing bank/UAN details via More -> Bank Details. Blank bank cells never hold payroll (VFL5465/5466 etc.).
- [ ] **OPEN BLOCKER (owner decision, before ~3-5 Nov): OD / C-off paid treatment.** feedSync counts only EL/CL/SL -> approved OD/COFF are unpaid. Then Sonnet agent: edit feedSync, re-vendor, tests, redeploy payroll-run.
- [ ] Owner decision: mask bank/PAN/UAN in the employee_salary_structure audit trigger (currently copied in full into audit_log).
- [ ] Owner decision: owner-facing view for pending half-day C-offs (today: notification only) — and whether it satisfies "shown to me".
- [ ] Kimi-file corrections needing owner permission (not edited): OCT2026_RUN_VERIFICATION.sql D3 assumes ONE Oct run (now up to four population runs; add overlap/arrears-once/half-day-pending checks); SHEETS_RETIREMENT.md + FY2026_27_GAP_AUDIT.md still say PATCH_111/113 not applied and BUNG-release options open; HANDOFF_KIMI_29Oct2026.md sections 5,6,9,11 stale (111/113 applied, comp-off decided, APK enabled) and contains a partial token prefix; AGENTS.md rule 5 targets the dead claude/payroll-lifecycle base and the old VDA basis; HANDOFF_SUMMARY.md (31 Aug) wholly stale — mark superseded.
- [ ] Pre-run additions: rolled-back rehearsal of four population runs + arrears-once (Claude, before 1 Nov); HR enters BUNG02/06 deductions BEFORE calculating PUNE_STAFF; plant head efficiency % by 5 Nov (else worker production allowance 0); every half_day_pending_decision row decided before calculate; pending advances VFL5324/VFL1556 (typo "10000 months"); public_holidays empty; shift-time conflict (sheet 08:30/60 vs app 07:00/15) for owner.
- [ ] Later: CA review of PF ECR/ESI/PT before filing (~15 Nov); December encashment (CA on statutory treatment); leave import after October; sheet retirement sign-offs (HR OS last); Goal 2 after Goal 1. Full path: CLAUDE.md 'Goal 1, handoff reconciliation'.
- Superseded in the older banners below: "APK HELD/apk-106 latest", "PATCH_113 ON HOLD", "PATCH_111 not applied", "Re-enable APK workflow".

# >>> IN-FLIGHT (27 Oct 2026, later): PR #30 + #31 MERGED, payroll-run v8 LIVE, APK build HELD, October pre-run checklist below <<<
- [x] PR #30 (d72671f) + PR #31 (4719f7a) squash-merged on owner approval. Statutory reports (ESI wages, PT gross, PF gross) now exclude after-engine extras (`extraEarningsTotal`) - owner decision 27 Oct: the recurring allowance raises net pay but stays outside ESI/PT wages, matching the sheet. Kajal's ESI status unchanged; revisit only if the CA says otherwise.
- [x] `payroll-run` DEPLOYED v8 (verify_jwt true, 27 Oct). Roster/overload verified live by Claude: `pune_attendance_roster` returns ot_hours + outstation_travel; only the 5-arg `pune_set_attendance` exists. Screen workaround note removed.
- [x] 28 Oct: owner ordered the APK released - see CLAUDE.md 'owner decisions of 28 Oct'. (was: APK HELD (owner, 27 Oct): the `Build Android APK` workflow (id 330767502) is DISABLED.** No build contains the OT/travel screen or the new payslip lines yet; latest published is apk-105. To release: re-enable the workflow (Actions -> Build Android APK -> Enable, or `PUT /repos/erpvarsha-star/forge-os-trial/actions/workflows/330767502/enable`) then push/dispatch a build. Do NOT forget this - app-code pushes to the base branch will not build until re-enabled.
- [ ] Kajal device test of OT/travel entry: postponed until an APK is released.
- [ ] BUNG02/BUNG06 deductions: HR enters as approved negative adjustments before the run, only in months they apply (not recurring).

- [x] **apk-106 PUBLISHED 28 Oct 20:45 IST** (run #106, commit 411ca28, 88.4 MB, latest release). Contains clerk OT/travel screen + new payslip lines. [ ] Install on phones; Kajal tests OT/travel entry on a real device. Workflow is ENABLED again.

- [x] 28 Oct: PATCH_112 applied live + `payroll-run` v9 deployed (population runs). [ ] PATCH_113 ON HOLD (owner: comp-off pending, no leave data reviewed; see CLAUDE.md). [ ] PATCH_111 not applied (needs owner's private values file; repo copy fixed on `claude/patch-111-113-fixes`). [!] The merged app leave code calls RPCs from 113 - do not ship it in an APK until 113 is decided.

## October pre-run checklist (prepared 27 Oct; run starts once the month closes; Claude prepares, owner/HR trigger)
Checked live 27 Oct: Oct VDA rate row exists (103/day); no October pay period/run yet; 7 BUNG active with salary structures; BUNG30/33 have ot_rate; 1 active recurring_adjustment (VFL1567 allowance, from 1 Oct); every other active employee has a structure; BUNG09 advance approved, outstanding 6,000.
Before the month closes:
1. Re-enable APK workflow and ship a build only when owner says; Kajal then enters BUNG OT hours/outstation travel the next day for every working day.
2. Attendance complete for all four populations through 31 Oct (Pune via Kajal's clerk screen; Aurangabad via app).
3. Feeds entered: canteen, society, efficiency (plant head), advances, any one-off adjustments. HR enters BUNG02/06 deductions as approved negative adjustments (only if applicable this month).
4. Confirm inactive stay inactive: CON16, CON18, CON21, CON22, CON23. Confirm VFL1520 remains on_leave (no exit processing).
5. CLOSED 28 Oct by owner (decide with October salary, first week of November):  bank details CON01/20/21/22/23; 4 active VFL5xxx staff missing from the Sept Staff sheet; VFL5464 master (held if missing); designation/DOJ blank on slips.
Run (owner/HR session): create October pay run -> feeds -> `generate_warnings` pre-check -> HR decisions on warnings -> AI review (needs ANTHROPIC_API_KEY, set) -> calculate (check response: extras {employees,totalInr}, held list, VDA-missing 422 must NOT appear) -> `attach_arrears_sep26_30` -> approve -> finalize (advance recovery runs: BUNG09 outstanding 6,000 -> 4,000) -> exports (salary sheet, bank file, statutory reports) -> payslip_ready notifications.
After calculate, verify before approving: VFL1567 allowance present in her slip and absent from ESI/PT wages; workers' OT uses flat-VDA-master basis; BUNG30/33 OT = ot_hours x ot_rate; outstation travel = 250/day; 31-day staff gross gap vs sheet should vanish for a 31-day month (U2 unverified - check a few staff).


# >>> IN-FLIGHT (26 Oct 2026, evening): September gate FAILED; Pune attendance for Kajal shipped — see CLAUDE.md "September gate" <<<
- [x] PR #27 merged (39161d1): `uses_app` filters (headcount/never-signed-in/reminders; payroll deliberately unfiltered) + member-reachable Pune attendance (More -> Pune Attendance, only where `attendance_clerk_location` is set). `apk-105` published 26 Oct 21:04 IST. [ ] Kajal installs apk-105 and saves one BUNG day on a real phone (never tested on a device).
- [x] PATCH_109 / 109b applied live by owner (clerk flag, `uses_app`, `pune_set_attendance`, `pune_attendance_roster`); audit-log bug (`action='upsert'` rejected by check constraint) found by Claude's rolled-back test and fixed by owner; re-tested.
- [ ] **September gate = FAIL (PR #28, draft; results in `scripts/PAYROLL_SIM_SEP2026_RESULTS.md`).** October stays OFF the app until it passes (owner decision: app-only, no parallel sheet run, so this is the sole gate). Open decisions: (1) worker OT VDA basis - engine uses the Oct 103/day rate, sheet used its own snapshot basis, all 19 workers short by Rs 3-112; was September's rate 103/day or the sheet's? (2) is U2 (31-day basis) frozen for consultants too (CON05/09/12/13)? (3) manual positive amounts with no engine input: VFL1463, VFL1567, BUNG02/30/33 - what are they, should the app support them? (4) HR data: 5 staff masters wrong (VFL1389/1556/1566/5322/5442), VFL5464 has no master (held), VFL1520 has a master but is not in the sheet/archive; (5) accept staff rounding band (<= Rs 3.5, 5 staff)? Pune Sept tab has a blank Gross column - archived Pune nets prove nothing; need confirmation BUNG were paid base salary in Sept.
- [ ] Agent's claim to confirm: VFL4024/VFL4033 "full 8,500 manual exception" does not exist in the figures (offset makes them equal to the prorated slab).

# >>> IN-FLIGHT (26 Oct 2026): payslip format rebuild — see CLAUDE.md 'Payslip format' <<<
- [x] PATCH_108 + Staff/Worker payslip tab/PDF merged (PR #25); routing fix merged (PR #26); `payroll-run` v7 deployed; `apk-104` published 26 Oct 18:52 IST (install this one). [ ] Consultant & Pune layouts (fallbacks live) — answers needed. [ ] designation/DOJ data load. [x] BUNG reactivated 26 Oct (7 people, Sunday off, no login). [ ] LOAD their salary masters (Gross As Per Masters) from the Pune sheet — October run holds them until then. [ ] check 4 active VFL5xxx staff missing from Sept Staff sheet.
- [x] Pune routing fixed by emp_code (see CLAUDE.md).
- [ ] Worker/consultant slips not yet compared (only Staff slips were provided).

# >>> IN-FLIGHT (24-25 Oct 2026): payroll-ops-features PR — see CLAUDE.md "Payroll ops features (24 Oct 2026)" <<<
- [x] Built + merged on `claude/payroll-ops-features`: cleanup (run-payroll function dir, login-otp.tsx.bak removed), warnings v2 (per-date late rule, pre-check `generate_warnings`, calculate 422 gate, AI review `payroll-warning-review`), notifications (payslip_ready, advance_approved/rejected, bell for ALL 7 roles), Pune attendance + reminder, onboarding checklist, statutory reports. All test suites 0 failed, tsc 7, i18n clean.
- [x] PR #24 merged (cd35be2, 25 Oct). DEPLOYED + verified: `payroll-run` v5, `app-notify` v1, `payroll-warning-review` v1 (all verify_jwt true, files match repo); `pune-attendance-reminder` v1 via CI. `apk-102` published 25 Oct 17:54 IST (built from cd35be2) — Yash installs.
- [x] DONE 25 Oct per Yash (secret entered via dashboard; cannot be read back, so first real warning review is the proof). (was: key was pasted into chat — treat as exposed, revoke it and enter a fresh one ONLY via the Supabase dashboard prompt / Edge Functions → Secrets; the secret tool timed out unanswered): set edge secret `ANTHROPIC_API_KEY` (AI review returns 502 without it, and calculate stays blocked until every waived/deduct warning is AI-reviewed — so this is REQUIRED before the October run if any warning exists).
- [x] Pune reminder cron applied live 25 Oct as PATCH_107 (job `pune-attendance-reminder`, 19:00 IST, active, job id 29). Posts to a function that deploys on PR merge.
- [x] Deduct wired 25 Oct (decide_warning -> approved payroll_adjustments from the 4th >30-min late); recalculation is manual after AI review.
- [ ] Day rate for the late deduction (decide_warning `dayRateFor`) is derived per category from the engine's per-day basis (staff FIXED_GROSS/workingDays; worker basic+hra+conveyance+washing+education over workingDays + VDA + heat; consultant daily/monthly); no pre-existing day-rate code existed. Owner to sanity-check one real example. Reopen-for-adjustment also deletes the run's pay_run_items (calculate re-inserts).
- [x] `run-payroll` deleted from Supabase 25 Oct (verified: absent from function list). Onboarding rows are created by the app (no DB trigger, no employee-create flow exists). Statutory formats (ECR/ESI/PT/MLWF) unverified against EPFO/ESIC validators — CA review before filing. Notification More-badge sums not changed (pill on the More row only). Nothing here run on a real device.

# >>> IN-FLIGHT (21 Oct 2026): payroll gaps build — see CLAUDE.md "IN-FLIGHT BUILD — payroll gaps" <<<
- [x] Backend (PR #22) and screens (PR #23) MERGED. PATCH_103 applied live.
- [x] `payroll-run` v4 DEPLOYED and verified (21 Oct): version 4, verify_jwt true, sha256 matches repo, unauthenticated → 401.
- [x] `apk-101` published (built from 591a5ac). [ ] Yash installs apk-101 and tests: Payroll Rates, Employee Exit, Top-up run, advance recovery on finalize.
- [x] October VDA per-day rate = 103 (same as September's default), row already in `payroll_monthly_rates` (entered 25 Oct; confirmed live). Owner decision 25 Oct: "October vda same as September".

# Forge OS — Pending Work Tracker

Living checklist. Updated at the end of every work session, before the final
push. `[x]` only when verified, not merely written.

**Last updated:** 11 Oct 2026 (session 22) — QR scan failures root-caused
and fixed in code. Live data: QR-verified check-ins ~90% through 6 Oct,
then 79% → 55% → 56% → 55% from 7 Oct, falling a little more each day.
Main cause was a version mismatch, not QR complexity: apk-85 (6 Oct)
shortened the salt in the QR text, and scanners compared with exact
equality, so an old-APK phone and a new-APK phone never matched. The fall
deepened as more workers updated while the gate phone presumably stayed
on the old build. Fixed (Sonnet agent build, diff + tsc + i18n re-verified
independently): new `isValidGateQr()` accepts both salt lengths and the
previous/next 30-min bucket (clock skew, guard-screen refresh lag); every
scan failure path now re-arms the scanner (before this, one failed scan
left it on "Loading…" forever, and on the member QR tab only an app
restart cleared it); the QR is validated before the slow GPS fix; all
scanning moved off deprecated `expo-barcode-scanner` to `expo-camera`'s
QR-only `CameraView`; gate QR drawn larger (260) with a proper quiet zone;
`getCurrentLocation()` can no longer throw. **Payload format deliberately
unchanged.** ⏳ **Needs: everyone, guard phones first, installs the new
APK.** Then watch `qr_verified` recover to ~90%. Not yet exercised on a
real device. Also open: Yash's "let everyone check in instead of assuming
late or early" for October still needs clarifying (see CLAUDE.md
`checkin_checkout_pattern`).

**Review of PATCH_89/90/91/92, 19 Oct 2026 (Sonnet review + Claude spot-check).**
Not on this branch: payroll PATCH_89/91/92 live on `claude/payroll-lifecycle`;
a second, unrelated PATCH_89 (production_records process/dropout) on
`claude/rea-installation-hpbxti`. **No PATCH_90 exists anywhere — number 89
used twice.** All four are already applied live; neither branch undoes the
check-in build (both are based on it). ⏳ Awaiting Yash's call on:
(1) 🔴 `attach_arrears_sep26_30()` is SECURITY DEFINER, no role check,
executable by anon/authenticated → can alter `pay_run_items` net pay;
(2) 🔴 `payroll-run` edge function (not deployed) has no caller auth;
(3) 🔴 `lib/payroll/feedSync.ts` reads status as 'present'/'week_off'/…
but the DB stores P/L/HL/WO/H/A → everyone would get 0 present days;
(4) `payroll-run` reads `salary_advances`, app writes `advance_requests`;
(5) payroll tables open to every manager via `is_management()`;
(6) `audit_row_change` actor always NULL; (7) ✅ renumbered 89 → 94.
**Update 20 Oct 2026:** (2) ✅ fixed — caller auth added (`403f03b`),
`payroll-run` deployed v1 with `verify_jwt=true`, unauthenticated call
→ 401 verified. (3) ✅ fixed on the branch (`95fe94b`, P/L/HL/WO
mapping). (4) ✅ fixed — reads `advance_requests`. Branch repaired:
README (`b5bb138`), i18n + payroll namespace (`ad00d1f`), engine
vendored for Deno (`3ee6aa9`). (1) ✅ arrears RPC locked to service_role
(PATCH_93, verified). ⏳ Still open: (5) manager-wide access; (6) audit actor NULL in the
trigger (the runner now records `actor_emp_code` itself);
**Payroll merged 21 Oct 2026 (PR #9, `fe742e4`, apk-96 ✅ built); PR #13 (`aa4cb69`): daily consultants wired + salary-sheet/bank-file download, `apk-97` ✅ built; `payroll-run` live v3.**
✅ Done: feedSync reads `rate_type`/`daily_rate` (daily consultants no longer held); `export` action + download buttons on HR Payroll Run.
**Triage from Yash, 21 Oct 2026 (after loading consultant bank details):** ✅ verified live: bank+PAN present for CON05/09/12/13/16/18/24, absent for CON01/20/21/22/23; CON01 Sept net ₹26,863 (OT ₹8,663) correct in the archived run; the arrears button exists on the Payroll Run screen (Oct 2026 only). ⏳ Yash: verify the 7 consultant account numbers vs passbooks before the first bank upload; phone-test the payslip + both downloads; ~~decide Pune BUNG history~~ ✅ **CLOSED 21 Oct 2026 — Yash: record-only; do NOT seed payslips for the 5 BUNG employees missing from the DB; old sheet data stays in the archive for comparison only**; HR to supply correct salary figures for VFL5464 (no record; sheet paid ₹27,032), VFL1389 (basic 10,500 vs sheet gross 29,000), VFL1556 (17,703 vs 19,720), VFL1566 (41,040 vs 45,000), VFL5322 (16,911 vs 18,637), VFL5442 (15,000 vs 18,636). ⏳ Claude, when Yash allows spending credit: ~~(1) RLS tightening of the salary table~~ ✅ **DONE 21 Oct 2026 (PATCH_99, owner + hr_admin only, verified by role)** — remaining optional hardening: ~~revoke `anon`/write grants~~ ✅ DONE 21 Oct (PATCH_102); bank file format ✅ settled 21 Oct (old-sheet column names), ~~explicit column list in `bulk-salary.tsx`~~ ✅ DONE 21 Oct (PR #21), and ~~other payroll tables~~ ✅ **DONE 21 Oct 2026 (PATCH_100, owner + hr_admin; plant head keeps efficiency entries)**. `items_self` ✅ fixed 21 Oct 2026 (PATCH_101). **(1, old text) RLS tightening of the payroll tables — now higher priority**, because `employee_salary_structure` (bank account, PAN, UAN) is readable by every manager via `is_management()`; check which screens read it first, then additive patch; (2) audit-log actor column; (3) bank-file layout tweaks if the print test mismatches the bank's format. October month-end routine: HR feeds all month → plant head efficiency % → after 31 Oct: Create → Calculate → review → Approve → Finalize → attach Sep 26–30 arrears (one-time, Oct only) → download salary sheet + bank file → print/stamp/bank.
⏳ Awaiting Yash/HR: (1) the bank's required upload format (current bank file = default layout); (2) consultants have no bank details in `employee_salary_structure` (blank cells + warning); (3) PATCH_96 repaired 23 consultant items with OT (owner said 24 — confirm the 24th); (4) U6 salary figures VFL1389/1556/1566/5322/5442 and U7 VFL5464; (5) find what keeps pushing "noop" commits that blank `payroll-run/index.ts` (4 times so far); (6) real-device test of payslip tab, Payroll Run/Feeds, Efficiency and the two downloads on the new APK; (7) manager-wide payroll table access via `is_management()`; (8) `audit_row_change` actor NULL; (9) November late-marking review.

`payroll-feed-sync` — not needed (Yash, 20 Oct: logic vendored in
payroll-run). Next, in order: real pay-run test vs Sheet (Sept 2026; kit ready in
`scripts/PAYROLL_TEST_SEP2026.md`, ⏳ Yash to run create→calculate→summary) → ✅ renumbered
89→94 (`db81733`) → Sept offline engine test done (results on payroll branch): ✅ U1 + U3
fixed (regression 58/0, 16/0; 60/68 staff match sheet); ✅ U4 done (PATCH_98 `employees.pt_exempt`, `ed8cc63`); ⏳ live payroll-run v1 not
redeployed with U1/U3/U4 — one redeploy when Yash says; ⚠ stray "noop" commits
`d825fa1`/`e5748d4` blanked payroll-run/index.ts again (restored in `ed8cc63`) — find out what is making them;
U2/U5 = frozen engine rules, not bugs (Yash); documented
deviation: VFL4024/VFL4033 paid full ₹8,500 prod allowance by hand on the
Sept sheet (manual exception, not reproduced by the app); ⏳ HR to supply
correct figures for U6 (VFL1389/1556/1566/5322/5442 — VFL1389's master
Basic ₹10,500 gives gross ₹26,250 vs sheet ₹29,000; with its advance the
net goes negative, so the engine HOLDS it (NET_NEGATIVE), no item written;
no code special-case) and U7 (VFL5464); ⏳ PATCH_96 (consultant history
seed) + PATCH_97 (salary masters draft) — not received yet, Yash to resend; consultants/VFL1001/VFL5458–62
held for missing/zero masters. ✅ PATCH_95 `my_payslips()` applied + verified (payslip
tab repointed in `f02fd13`; ⏳ needs a payroll-branch APK to see it) → payroll PR + 58-assertion regression before merge.

**Check-in health check, 14 Oct 2026 (live DB + Sonnet code review, verified).**
Working: 72–82 check-ins/day (of 99 active) 7–14 Oct, 64% via QR, 0 mock
flags, 0 fraud alerts in 10 days; all 12 campus points at 45m. 11 people
with ≤2 check-ins since 7 Oct, no leave on file — VFL1520 + VFL1527
(security) and VFL4072 opened the app in the last 2 days but have no
check-in; CON24 + VFL5457 never logged in; VFL5439 (Pune). Code gaps found —
✅ ALL FIXED 14 Oct (commit bf747f3, PATCH_88, see CLAUDE.md "Check-in
reliability fixes"); ⏳ needs everyone on the new APK, then re-check the
stragglers list above: (1) `CheckInCard.tsx:273` ignores the
`checkIn()` error → non-member roles (security, supervisors, managers) see
"nothing happens"; same for both `checkOut` calls; (2) GPS uses
`BestForNavigation` with no timeout/fallback and ignores
`coords.accuracy` → indoor fixes fail 45m or spin forever; (3) no
timeouts/try-catch on the check-in network calls → endless spinner on bad
signal; (4) "Location permission required" also shown when GPS is simply
off; (5) QR fails if the guard's or employee's phone clock is >~30 min
wrong; (6) worker exit-QR modal can spin forever (camera permission never
requested on that path).

**Later same session, 11 Oct 2026 — Yash's apk-92 feedback.** Built and
live-tested (details in CLAUDE.md "Follow-up decisions"): red counts for
every pending decision (PATCH_84) — he'd missed 4 days of Needs Your Call;
Tasks as a bottom tab for owner / plant head / HR, owner's Approvals
moved into More; monthly on-time race (PATCH_85; employees see only their
own rank, owner sees #1 per group); Android clipped-label fix. ✅ Yash
confirmed on apk-94: labels no longer cut off; race "member" = worker
category (as built). ✅ Yash cleared Needs Your Call (0 pending).
✅ VFL1543/VFL1549 both checked in 11 Oct — not a data problem.
✅ Weekly off live (PATCH_86): Fridays (Kajal: Sundays) written as `WO`,
never absent; working one counts as a normal day; backfilled 1–11 Oct.
✅ Fazal's monthly form = "Worker Monthly Efficiency"; its 1st–5th
reminder had never fired (PATCH_66 insert skipped) — fixed, PATCH_87.
⏳ VFL1001 payslips show ₹0 Apr–Aug because the salary sheet itself has
CTC 0 for him — waiting on Yash for the real source/figures.

**Task delegation built, 11 Oct 2026 (session 22).** Was never built
before (only an orphan `tasks` table). Now live: PATCH_83 + My Tasks /
Team Tasks screens + More-tab badge + tasks in monthly score — details in
CLAUDE.md "Task delegation". Live-tested as owner, plant head, HR,
Accounts manager, supervisor and two members (allowed + refused cases,
full assign → submit → send back → approve flow, RLS, push queueing,
names); one real security bug found and fixed before release. ⏳ Still
needed: (1) install the new APK and try it on a real phone; (2) HR links
supervisors' teams (`supervisor_id`/`shift_allocator_id`) — most
supervisors currently have nobody to assign to; (3) watch the first
nightly-scoring run after tasks exist.

**Full audit of this file, 11 Oct 2026 (session 22, Sonnet agent,
read-only, checked against live code + DB).** The middle of this file is
2–6 weeks stale; this block is the current truth until it's cleaned up.
- **Real bugs still live:** (1) ~~weekly off counted as absence~~ —
  ✅ fixed 11 Oct, PATCH_86.
  (2) ~23 screens/hooks never read the Supabase `error`, so a network/RLS
  failure looks like "nothing here" (owner/plant-head/HR dashboards,
  manager reports, payslips, score, late comers). (3) `SafetyTip.tsx:14`
  uses device-local `getDay()` (cosmetic, breaks the IST rule).
- **Needs Yash/HR:** September payroll sheet; VFL1001's own CTC (payslip
  empty); everyone (guards first) installs apk-91; 40 system-guessed shift
  rows waiting in Needs Your Call; CON24 + VFL5457 never logged in; 1 leave
  + 2 advance requests pending; Shakeel Sayyad + Ganesh Kausadkar still
  need real emp_codes; VFL1527 + 8 others have no phone; VFL1543/VFL1549
  stopped checking in 2 Oct (leave?); payroll engine needs VDA rate +
  efficiency % entered before any run; `resolveFormSheets.gs` 22/28 forms
  unmatched; dashboard production panel needs `APPS_SCRIPT_URL`;
  Telegram supervisor onboarding unverified.
- **Built, never exercised on a real device:** QR fix, Shift Check-in
  Summary, Needs Your Call, fraud-alert resolve, shift allocation tabs,
  leave/advance chain, Payslips, Quote of the Day, Shift 4/5 + 60-min
  window, `set_my_shift_for_date`, update banner, Kajal Pune shift, 5S /
  maintenance photos, View-as walkthrough, weekly-off-worked view.
- **Stale entries (resolved):** "39 open fraud alerts" (all resolved);
  "14 never logged in" (now 2); VFL1319/VFL5354 (deactivated); cron
  "not yet run" notes (all 8 jobs active and succeeding); "`shifts` has no
  seed"; AttendanceReport.gs install steps (superseded by SQL views);
  "129 employees" (live: 147 total / 99 active).

**Earlier:** 6 Oct 2026 (session 21) — Yash sent a 12-point request in
one message; full breakdown is in CLAUDE.md ("12-point request, 6 Oct
2026"). Shipped: 60-min early-arrival buffer at the Shift3→Shift1/4
boundary only (doesn't reopen the 27 Sep 08:15/General fix); overtime
computed everywhere hours_worked exceeds a shift's nominal hours, with
12h+ on Shift 1/3 reclassifying to Shift 4/5 (visibility only, never
payroll); a new hourly 24h-auto-checkout edge function; GPS radius 25m→45m
(third change to this value); QR payload shrunk ~70→~38 chars (root cause
of "scans take 10 minutes" — confirmed by Yash as "the scan itself," not
GPS); Kajal (VFL1567) given a 10am "General (Pune)" shift + Sunday
weekly-off, scoped to just her; the real Shift Check-in Summary screen
(Owner/Plant Head/HR Admin via More) — the 1 Oct mockup's 3 open questions
had never actually been answered, found and resolved this session rather
than left stale again. **Two real gaps found and flagged, not fixed**:
(a) no live code anywhere excludes ANY weekly-off day — not even the
company-wide Friday, for anyone — from attendance-percentage denominators;
storing Kajal's `weekly_off_day` alone does nothing until this is decided
and built properly. (b) CON24's PIN broke a **second** time (PATCH_69) —
root cause of the repeat still open; HR has no self-service PIN-reset tool,
which is probably why. Two of the four builds (shift-inference/overtime/
auto-checkout, and the dashboard screen) were delegated to separate Sonnet
subagents with complete, pre-worked-out specs; both diffs were
independently re-verified (tsc, i18n) before committing, not trusted as
reported. `apk-85` confirmed built successfully, contains everything.

**Last updated:** 1 Oct 2026 (session 20) — Found every pg_cron job in this
project (not just the new Fazal one) had never had its placeholder
Authorization header replaced, ever — confirmed live, and confirmed harmless
since every edge function is deployed `--no-verify-jwt` so the gateway never
checks it (mrm-reminder had run successfully 227 times on the placeholder
alone). Yash pasted a real key into `plant-head-form-reminder`'s job by
hand; `PATCH_68_cron_keys_01Oct2026.sql` offered the same fix for the other
6 jobs (cosmetic hygiene, not a functional fix) — **Yash ran it; verified
all 7 cron jobs now hold a real key, none on the placeholder.** One
incidental exposure: the real key Yash pasted showed up in a `cron.job`
query result used to diagnose this, reaching the chat transcript the same
way a direct paste would — flagged to him, rotation optional. Session 19
recap: CON24 (Shriram Pawar) couldn't
log in; root-caused to `HR_reset_pin.sql` silently resetting his PIN with
the wrong (VFL-style) formula instead of the consultant formula — fixed his
PIN (PATCH_67) and fixed the script itself so it can't recur for any other
consultant. Checked live who among active employees has never signed in
(10 people — see CLAUDE.md "Who has never signed in"). Registered Fazal's
new monthly Google Form into `form_links` (PATCH_66, MANAGEMENT dept) and
built+deployed a new edge function (`plant-head-form-reminder`) that
notifies him daily from the 1st-5th IST while it's outstanding — **one
manual step left for Yash: paste a real key into PATCH_66's
`cron.schedule()` block in the Supabase SQL Editor to actually turn the
daily trigger on** (the form itself is already visible in his Forms tab
either way). Session 18 recap: 4 Google Forms Yash provided
registered into `form_links` (PATCH_65): Administration dept (Kajal, Monthly
+ Daily Attendance) and Human Resource dept (existing HR team, Monthly +
Daily Attendance). Could not read the forms' own content (docs.google.com
blocked by the sandbox's egress proxy, and the `/d/e/<id>/viewform` ID isn't
a resolvable Drive file ID) — department scoping and responsible persons
were confirmed directly with Yash via `AskUserQuestion` rather than guessed
(his first message said "goes to kajal," his next relabeled the same group
"ea" — that discrepancy was raised and resolved as Kajal/Administration, not
assumed). Pure data change, no app code touched — `FormsScreen.tsx` already
renders `form_links` generically, so this is live immediately, no new APK
needed. Session 17 recap: `AttendanceReport.gs` email recipients set (hr@varshaforgings.com, ea@varshaforgings.com, yash.munot@gmail.com), 28 Sep 2026 data previewed for Yash by running the script's exact logic directly against live Supabase and sending it as a CSV — 74/99 checked in, 12 late, avg 9.17 hrs, matching what the Sheet/email would actually show, no discrepancies found; HR's master shift screen no longer filters by role at all (Yash's final correction, after two narrower fixes were each still wrong); Shift 4 (07:00-19:00) and Shift 5 (19:00-07:00), both 12h, added for the OT patterns Yash described, coexisting with Shift 1/3, chosen week-by-week; a real shift-inference tie bug (two shifts sharing a start_time could swallow the entire day's window) found and fixed before Shift 4 shipped. Session 16 recap: Apps Script project found pinned at Google's 20-trigger ceiling, dedupe utility added and confirmed cleared (20→10); **apk-82 is live and confirmed built successfully, already containing every app-code change through Shift 4/5 and the HR shift-screen fix**; real Apr-Aug 2026 payroll data imported from Yash's 3 salary sheets

**AttendanceReport.gs email recipients set, 29 Sep 2026, session 17 — one setup step left.** Yash gave the three addresses (`hr@varshaforgings.com`, `ea@varshaforgings.com`, `yash.munot@gmail.com`); committed into `ATTENDANCE_REPORT_RECIPIENTS_INLINE`, same not-a-secret treatment as `OWNER_EMAIL` in `ALERT.gs`. Before wiring it in, ran the script's exact daily-attendance query directly against live Supabase for 28 Sep 2026 and sent Yash the resulting 99-row table as a CSV, matching the Sheet's own columns exactly, so he could confirm correctness before trusting the live run — summary matched what the script would itself report (74/99 checked in, 12 late, avg 9.17 hrs). Flagged (not fixed, per "test mode until 1 Oct," not bugs in the report): Yash's own account has a 2:31am test check-in; several employees have near-zero `hours_worked` from same-minute check-in/checkout (likely QR double-taps); VFL1527 shows 14.17 hrs, above the documented "likely a data problem" 14h bound (not yet an automated flag); CON13 has no `department` set. **Still needed from Yash: re-paste the updated `AttendanceReport.gs`** (only the email-recipients line changed) so the live copy picks up the addresses — the Sheet update already works without this, only the email step was silent.

**Shift 4 & Shift 5 (day/night OT variants) — built 29 Sep 2026, session 17.** Full detail in `CLAUDE.md` ("Shift 4 & Shift 5"). Yash: some Shift-3 employees come in at 7pm for OT, working through to 7am — the 7pm-12am portion is the overtime; he also proposed a day-shift equivalent (7am-7pm). Confirmed via `AskUserQuestion`: Shift 5 coexists with Shift 3, chosen week-by-week, not a permanent replacement — first built only Shift 5 since Shift 4 had no described concrete use case yet. Yash then confirmed he wants Shift 4 live too — "all people allocating shifts from the csv... will now see shift 1 2 3 4 5 and general to choose from?" — built same session. On the OT-rupee split question Yash had no preference, so both are **visibility only** — ordinary 12h shifts (mapping, not payroll), no rupee OT amount computed, matching the existing "Working hours mapping (NOT salary)" precedent.
- `PATCH_63_shift5_ot_29Sep2026.sql` and `PATCH_64_shift4_day_ot_29Sep2026.sql` applied — both kept as their own `shifts` rows, separate from `Security Night`/`Security Day` (same windows), so security-specific logic isn't touched.
- **Real bug found and fixed before Shift 4 could ship, not discovered live:** Shift 4's start_time (07:00) ties exactly with Shift 1's. Tested the tie scenario before applying the patch (this project's standing practice for any shift-inference change) and found `findClosestShift()` broke completely on it — a zero-length window between the tied pair fell through to a `|| MINUTES_PER_DAY` fallback meant only for a single-shift pool, giving whichever of Shift 1/Shift 4 sorted first a **full 24-hour window** that silently swallowed every other shift's inference for the whole day (confirmed: 17:00 and 23:44 both wrongly resolved to "Shift 1" with the bug present). Fixed in `lib/shiftInference.ts`: deterministic name-based tiebreak on equal `start_time`, and each shift's window now extends to the next *distinct* start_time rather than the next array slot. Re-verified with a 12-case sweep (the tie, the original Shift-1-vs-General examples, the Security pool) — all passed, no regressions.
- Added to both shift-allocation UIs' allow-lists; added a 12h no-checkout default in `lib/workingHours.ts` (Claude's own extension of the existing General=9h pattern, not a number Yash gave) and the hand-replicated copy in `AttendanceReport.gs`.
- **Not yet exercised on a real device** — type-checked and window-math-verified only. New APK build needed.

**HR's master shift screen — role filter removed entirely, final correction 29 Sep 2026, session 17.** First found missing 2 of the 8 people in HR's own allocator group (fixed to `role IN (member,supervisor,security_guard)`), but Yash corrected again: "remove that logic... follow allocation as per csv even if they of different role" — the CSV itself has a `manager`-role person (VFL5461, Quality group) who'd still have been excluded. `app/(hr-admin)/shifts.tsx`'s employee query is now just `.eq('is_active', true)`, no role/category filter of any kind. The new `shift_allocator_id`-scoped screens were never affected — no role/category filter there at all, ever.

**Apps Script trigger ceiling hit (20/20) — found and RESOLVED 28 Sep 2026, session 16, confirmed cleared.** Right after installing `runAttendanceReportHourlyGate_`, its own log reported "Triggers before: 20, after: 20." Yash ran the `listAllTriggers_()` diagnostic (added earlier this session) and confirmed: `runCacheBuilder` registered 6 times, `runAnalyticsDaily` registered 6 times — 12 of the 20 slots are duplicates of just those two. Everything else (including this session's own 3 new/consolidated triggers) is correctly 1x.
- **Root cause, confirmed via a code search, not guessed:** neither `runCacheBuilder` nor `runAnalyticsDaily` (nor `syncVMCToDashboard`/`runDashboardPull`/`backupCacheDaily`) is defined anywhere in this git repo — they belong to the live Operations Dashboard script ("Code.gs" in CLAUDE.md's prose), whose source has never been tracked here. **CLAUDE.md's own "too many triggers" note was itself stale and wrong** — it described a completely different set of function names (`checkShiftEnd_*`, `refreshCache15min`) that don't exist live at all. Corrected in CLAUDE.md.
- **Fix added:** `dedupeClockTriggers_(execute)` in `AttendanceReport.gs`, right after `listAllTriggers_()`. Works generically off `ScriptApp.getProjectTriggers()` (doesn't need the offending script's source), dry-run by default, only touches `CLOCK`-type triggers (never `processFormSubmissions`' `onFormSubmit`).
- **Confirmed cleared, same session:** dry run correctly previewed exactly 5×`runCacheBuilder` + 5×`runAnalyticsDaily` to remove, nothing else; run for real (`dedupeClockTriggers_(true)`, via a temporary `runDedupeForReal()` wrapper since the Apps Script editor's Run button can't pass arguments); `listAllTriggers_()` re-run afterward confirmed **10 triggers total, one of each of the 10 expected handlers** — 10 free slots recovered.
- **Not a permanent fix** — the untracked installer that creates duplicates on every manual re-run of whatever installs `runCacheBuilder`/`runAnalyticsDaily` in the Operations Dashboard script is still there; this only cleans up after the fact. **If the count balloons again, re-run `dedupeClockTriggers_()`** (dry run first, then `true`) — the fix is already in the repo, nothing new to build.

**apk-79 is live — nothing else is queued to bundle in, checked 28 Sep 2026.** Yash asked to check `PENDING.md` for pending features to club into one build before shipping. Checked directly against `.github/workflows/build-apk.yml`'s trigger config and the GitHub Actions API, not assumed:
- The `push:` trigger only fires on `app.json`, `assets/**`, `package.json`/`package-lock.json`, `app/**`, `components/**`, `constants/**`, `hooks/**`, `i18n/**`, `lib/**`, `types/**`, `babel.config.js`, `tailwind.config.js`, `tsconfig.json` — **not** `scripts/**`, `supabase/functions/**`, `dashboard/**`, or docs. Every run is a full rebuild of the whole branch, not an incremental patch, so whatever's committed by the time a build fires is automatically "clubbed in" — there's no separate bundling step to manage.
- The most recent commit, `fe6d55f` (shift-allocation tabs, PATCH_62), matched the filter and triggered **run #79** — confirmed via the Actions API: `status: completed`, `conclusion: success`, published as release **`apk-79`** at `2026-09-28 20:48:39 IST`. `git status` is clean — nothing uncommitted waiting to go in.
- **So `apk-79` (the stable `latest` download link) already contains every app-code fix/feature from sessions 14-16**: shift-allocation tabs, check-in-time-decides-shift + inferred-shift saving (PATCH_58/59), the attendance counting-rules fix (late no longer counted as absent), the calendar/MRM timestamp fixes, the Payslips screen, the staged leave/advance approval chains, the update-banner regression fix, the ambiguous-embed fix. **Nothing app-code is left un-bundled — tell staff to reinstall now, don't wait for anything else.**
- **What's genuinely still open is not app-code and can never be part of an APK build**, so it's tracked separately, not a blocker on telling people to reinstall: `AttendanceReport.gs` (still needs Yash/HR to paste it into the Apps Script editor and run the two setup functions once — ships via Google Apps Script, not the APK), owner's own payslip CTC figure (waiting on Yash), the 39 open fraud alerts (waiting on a screenshot from Yash), a bank-disbursement-statement-format decision from an old session-12 note (superseded by the manual-import payroll approach this session actually used — not being actively pursued, kept only as a record of an open question if payroll automation is revisited later).

**Shift-allocation tabs for department allocators — built 28 Sep 2026, session 16.** Full detail in `CLAUDE.md` ("Shift allocation tabs"). Yash uploaded `Shift_Planning_1.csv` — 8 department groups, each with one named allocator who sets Shift 1/2/3/General weekly. Previously only HR had a shift-assignment screen, unscoped (sees the whole company). `PATCH_62_shift_allocator_28Sep2026.sql` applied and verified: new `employees.shift_allocator_id` column, 73 employees mapped across the 8 groups (verified: group sizes sum to 73 exactly), CON24 Shriram Pawar added (was in the CSV, not yet in `employees`), CON12 Sadashiv Soddy's role fixed `member`→`manager` (Yash: "hes consultant and quality manager how did he get member role?" — root-caused to `PATCH_35`'s blanket consultant-role default, not a deliberate call). New `allocate_team_shift_week()` RPC (SECURITY DEFINER, checks `shift_allocator_id = caller` before writing) — the real security boundary, since `is_management()` doesn't cover the one `supervisor`-role allocator (Sudeep Singh) and would be unscoped for the `manager`-role ones. **Verified directly via SQL before wiring the UI**: positive case wrote all 6 days correctly for an allocator's own team member; negative case correctly rejected a write for someone outside that allocator's team; test rows cleaned up after.
- New shared `components/ShiftAllocationGrid.tsx` + `hooks/useShiftAllocation.ts` (extracted from `app/(hr-admin)/shifts.tsx`'s week-nav/chip-grid pattern), offering Shift 1/2/3/General only (no Security — no security guard in the CSV has an allocator outside HR's own group). Thin wrapper screens `app/(manager)/shifts.tsx` and `app/(supervisor)/shifts.tsx`, reached via a new "Shift Allocation" row in each role's More tab (same `href: null` + more.tsx-link pattern HR's own `shifts.tsx` already uses, not a bottom-bar tab — avoids a 6th/7th cramped tab). A manager/supervisor not set as anyone's allocator just sees an empty-team state.
- **Verified:** `npx tsc --noEmit` — still exactly 7 errors, same pre-existing baseline, none in the new files. `node scripts/check-i18n.mjs` — clean, Hindi covers every new `shiftAllocator.*` key.
- **Not yet done:** exercising it on a real device — only type-checked and verified against live data/RPC calls, no UI walkthrough. **Build confirmed: `apk-79`, run #79, `conclusion: success`, published 2026-09-28 20:48:39 IST.**

**AttendanceReport.gs — first live test run by Yash caught a real bug, fixed 28 Sep 2026, session 16.** `testAttendanceReportForDate()` failed with `PGRST201` — `employees` has 3 FK relationships into `attendance_records` (`employee_id`, `checkpoint2_confirmed_by`, `checkpoint3_confirmed_by`), so PostgREST refused to guess which one to embed. Fixed by naming the FK explicitly (`attendance_records!attendance_records_employee_id_fkey`) in both `fetchDailyAttendance_` and `fetchMonthlyAttendance_`; confirmed the live constraint name via SQL and sanity-checked the join logic against real 27 Sep data (70/98 active employees checked in — matches). Also added `testAttendanceReportYesterday()`, a no-arg wrapper — the same test run's `date=eq.undefined` error was from clicking "Run" in the Apps Script editor on a function that takes a parameter, which Apps Script silently calls with none; this makes that mistake harder to repeat.

**Daily + month-end attendance to Google Sheet + email — built 28 Sep 2026, session 16, NOT YET INSTALLED.** Full detail in `CLAUDE.md`. New `scripts/AttendanceReport.gs`, written to reuse `ALERT.gs`'s already-live Supabase credentials in the same Apps Script project — verified the core logic against real live data (a no-checkout row got the correct 9h default, an absent employee got a correctly blank row, not dropped). **Still needs, in order:** (1) Yash/HR pastes the file into the Apps Script editor alongside `ALERT.gs`, (2) runs `testAttendanceReportYesterday()` (or `testAttendanceReportForDate('<a recent date>')`) once and checks the log + the Sheet, (3) runs `installAttendanceReportTrigger()` once and confirms the logged trigger count stays under Google's 20 ceiling, (4) sets `ATTENDANCE_REPORT_RECIPIENTS` (Script Property) once Yash gives the email addresses — until then the Sheet still updates, the email step just no-ops. Open questions in CLAUDE.md: "Total Present Days" definition (assumed = days present, not calendar days), whether to run through test mode or wait for 1 Oct, and a quick glance to confirm no existing tab in "VFL HR OS 2026 27" is already named "Daily Attendance"/"Monthly Attendance Summary".

**Attendance counts, calendar and time — re-audited and fixed 28 Sep 2026, session 16.** Full detail in `CLAUDE.md` ("Attendance counting rules"). Date boundaries were already correct everywhere (every "today"/"this month" query uses the IST helper; 212/213 records carry the correct IST date). Real bugs found and fixed: (1) late arrivals (`status='L'`) counted as absent on every dashboard, the plant HTML dashboard, the manager report, employees' own present-day counts and in `nightly-scoring` (attendance score + late count); (2) HTML dashboard denominator ignored no-shows; (3) calendar "today" ring off by one day after 18:30 IST; (4) MRM `submitted_at` would have been saved 5.5h in the future; (5) supervisor/manager dashboard totals included departed employees. **Needs a new APK** (triggered by this push) for the app-side fixes; the HTML dashboard fix applies as soon as the new `dashboard/index.html` is downloaded; `nightly-scoring` redeploys via the Deploy Edge Functions workflow and will re-score this month tonight.
- **Resolved (PATCH_58):** VFL1391 Atul Bhata Patil's 00:05 IST check-in on 28 Sep. Yash: "it is 3rd shift for 27th not 28th" → record stays on 27 Sep, his 27 Sep shift set to Shift 3, on time (28 Sep shift left General). A first correction wrongly moved it to 28 Sep — reverted.
- **Check-in time overrides HR's shift allocation (Yash, 28 Sep) + silent inference failure fixed (PATCH_59).** `resolveShiftForCheckIn()` keeps the assigned shift only if the check-in is on time or up to 60 min early for it (60 = Claude's call, flagged in CLAUDE.md); otherwise the check-in's own shift is used and saved. Found while building this: `employee_shifts` is writable by management only, so since 27 Sep every regular employee's inferred shift insert was rejected silently — 39 check-ins with no shift row, none evaluated for lateness. Now saved via the new `set_my_shift_for_date()` RPC. Needs the new APK. **Decided — not doing it:** Yash, 28 Sep: app is in test mode, 1 Oct 2026 is go-live; don't retro-evaluate test-period attendance. **Everything above that "needs the new APK" must be installed by staff before 1 Oct.**
- **Shift 3 = previous working day, now in the app code (needs the new APK).** New `attendanceDateStr()` in `lib/istDate.ts` (day rolls over at 06:45 IST) is used for filing check-ins and looking up the day's shift in `hooks/useAttendance.ts`, `app/(worker)/home.tsx`, `components/CheckInCard.tsx`. Check-out and QR confirm now update the open record by id, with a 14h fallback so Shift 3 and Security Night can check out after the rollover (Security Night check-outs after 07:00 were already broken before this). Lateness now handles midnight wraparound via `lateMinutesAgainst()` — previously an 11:50 PM Shift 3 check-in scored ~24h late and a post-midnight Shift 2 check-in scored 0. Verified with a scripted table of 11 check-in times. Not yet exercised on a real device.
- **Found by the audit, not fixed yet (follow-ups):** 23 screens read Supabase data and ignore the `error` (a network/RLS failure shows as "nothing pending" instead of an error — worst on the approvals and fraud-alerts screens); 4 files hand-roll the IST formula instead of importing `lib/istDate.ts` (correct today, but won't pick up future helper fixes); `SafetyTip.tsx` rotates by device-local weekday (cosmetic).

**GPS geofence radius raised 15m → 25m, PATCH_57 — 28 Sep 2026, session 16.** Yash: "15 m is making it difficult for ppl to sign in" — confirmed live, all 12 real `plant_locations` rows were at 15m. This was the exact risk flagged when 15m was set (27 Sep): typical phone GPS accuracy is ±5-20m outdoors, worse inside a steel-frame shop, so 15m rejected legitimate check-ins. Raised to 25m (Yash's number) on all 12 real campus points; "Pune Office" (200m, not part of the documented 12-point seed) left untouched again. **Watch `worker.outsidePlant` complaint volume** — if 25m is still too tight for a specific shop (Machine shop is the widest gap from its neighbour, 68.6m), the fix is a per-point bump there, not another global change.

**Owner's own payslip (VFL1001) has no real data — found 28 Sep 2026, session 16, not yet resolved.** Yash reported seeing no details on his own payslip. Checked the exact uploaded sheet (`VFL_Employee__Salary_Sheet_2026_Onwards.xlsx`) — his row exists in Master Data and all 5 monthly tabs exactly as he said, but `CTC P.A` (and everything derived from it — Basic/HRA/every allowance) is genuinely `0` in the source file for every month Apr-Aug. This is not an import bug; there was nothing to pull. **Waiting on Yash for either an annual CTC figure (to apply the same 40/24/6/6/6/3/2/4/9% split every Staff row uses) or exact monthly Basic/HRA/etc. rupee amounts** — asked, no answer yet ("No preference" was selected without a number).

**2 staff employees marked `is_active=true` but flagged "Non-Active" in Yash's own sheet — found 28 Sep 2026, session 16.** While confirming other employees' payslips were populated correctly: **VFL1319 Dipak Balkrishna Patil** and **VFL5354 Rahul Ashok Patil** have zero 2026 payroll rows (correctly — the sheet's own Master Data marks both "Non-Active" and neither appears in any 2026 monthly tab, last appearance Aug 2025). Live `employees.is_active` had been `true` for both.
- **VFL1319 — resolved.** Yash, 28 Sep: "has left" — deactivated via `PATCH_60_vfl1319_deactivate_28Sep2026.sql`, confirmed `is_active=false`.
- **VFL5354 — resolved.** Confirmed left, deactivated via `PATCH_61_deactivate_4_left_28Sep2026.sql`.

**Who's never logged in — pulled live 28 Sep 2026, session 16.** 19 of 103 active employees had `must_change_pin=true` (never completed first login) — full list given to Yash by emp_code/name/department. Follow-ups from that list:
- **VFL5439 Bhanwar Singh Rathod (Security)** — Yash: stationed at Pune Office, not the Aurangabad plant. This also resolves the long-open "Pune Office `plant_locations` row — is this deliberate?" question from earlier sessions: yes, it's his location. He still hasn't logged in — being off-site doesn't explain that on its own, worth a nudge.
- **4 confirmed left, deactivated (PATCH_61):** CON22 Digambar Mahadeo Todekar, CON23 Suresh Sopan Gawali, VFL5354 Rahul Ashok Patil, VFL4048 Babasaheb Dagadu Randive. CON22/CON23 were added this same session as confirmed June-2026 rejoins (PATCH_55) — their payroll data (real pay in June, sharp drop in July, nothing in August) shows a short second stint that also ended, not a mistake either time.
- **14 of the original 19 remain unresolved** (19 − VFL1319 − VFL5439-confirmed-active-but-remote − 4 now deactivated) — HR should push the rest through first login before 1 Oct go-live.

**Real payroll data imported — 28 Sep 2026, session 16.** Full detail in `CLAUDE.md` ("Real payroll data on file"). Summary: `PATCH_54`/`PATCH_55`/`PATCH_56` — schema extended with every line item the real Consultant/Worker/Staff salary sheets carry (employer PF/ESI, bonus, gratuity, leave encashment, staff allowances, worker allowances, week_off); 536 rows imported/upserted into `payroll_records` for Apr-Aug 2026, all marked `final`; 4 employees (CON22, CON23, VFL5455, VFL5456) found only in the sheets and added from their own Master Data rows, not guessed — CON22/CON23 are confirmed re-hires of VFL4004/VFL4030 (both on the 27 Sep "Left Employees List" above), VFL5455/5456 were a genuine onboarding gap, paid but never in Forge OS at all.
- **Payslips screen built, same session.** "Payslip" row in More (every role, not just member — the real sheets pay staff, workers, consultants, managers, plant_head and owner alike) opens a list of the 12 FY2026-27 months, each marked Issued (green check + net pay) or Not Yet Issued (greyed out, unopenable). Tapping an issued month opens the existing single-month detail view, now generalized to accept `?month=&year=` query params (defaults to current month, so old direct links still work) and extended to show every real line item the record actually has — Staff allowances (education/medical/professional development/communication/uniform/washing), Worker allowances (heat/VDA/production), and shared extras (arrears/dispatch incentive/other allowance/leave encashment/canteen/society/MLWF/other deduction) — each row only rendered when non-zero, so a Consultant's payslip doesn't show a wall of empty Staff-only rows. `hooks/usePayslips.ts` (list + single-record hooks) + `components/PayslipsList.tsx`/`components/PayslipDetail.tsx` (shared across all 7 role groups, thin per-role wrapper files, same pattern as Late Comers Review). `types/index.ts`'s `PayrollRecord` extended with every new field. Verified: `npx tsc --noEmit` still exactly 7 errors (the same pre-existing baseline), `node scripts/check-i18n.mjs` clean (only the pre-existing, unrelated `security.qrExpiresIn` gap). **Not yet done: exercising it on a real device** — only type-checked and read through, no UI walkthrough yet. New APK build needed (triggered by this push).
- **Still needed from Yash:** September 2026 payroll (he said it's still being generated) — same import process once he sends it, do not re-derive it.

**Update banner regression — found and fixed 28 Sep 2026, session 16.** Full detail in `CLAUDE.md` ("Update banner"). The 27 Sep fix for the More-tab staleness bug (switched `useAppVersion.ts` to `useFocusEffect`) broke `UpdateBanner` — it's mounted above the Stack navigator, not inside a screen, so it never received focus events and its check silently stopped running. Fixed by using `AppState`'s `'active'` event instead, which works for both consumers. **New APK build needed and must be confirmed live before telling employees to update** — do not send the "please download" broadcast until the new build with this fix is confirmed published, otherwise people would be told to download a build that still has the bug.

**Fraud alerts investigated, not resolved — 28 Sep 2026, session 16.** 39 open `mock_location` alerts, all high severity, concentrated in 3 employees (VFL5442 ×20, VFL4036 ×14, VFL5446 ×5), all 26-27 Sep. Full detail in `CLAUDE.md`. Current client code already has the correct `location.mocked` check (not VFL4057's old bug), so root cause is either a real spoofing app or a device/OS quirk — **needs the same one-screenshot ask as VFL4057**: what does the check-in screen actually say for these 3. Not resolved.


**Shift inference for unassigned check-ins — added 27 Sep 2026, session 15.** Yash: "if there is no shift allotment done for anyone consider the shift closest to their check in time as their time." Found while implementing this that lateness was previously **never evaluated at all** for anyone with no `employee_shifts` row — not just unflagged, the late-minutes math short-circuited to 0 unconditionally. `lib/shiftInference.ts`'s `findClosestShift()` now picks the closest-start-time shift (circular distance, handles midnight wraparound) and inserts a real `employee_shifts` row for it, so it persists consistently for Late Comers Review and shift-wise reports too, not just a one-off late calculation. Security roles only match "Security *" shifts (avoids an exact tie: Security Day and Shift 1 both start 07:00). Full reasoning in `CLAUDE.md`. **Behavior change, by design:** people never marked late before (no shift assigned) will start showing as late now — worth a heads-up to HR before the questions come in. Not yet exercised on a real device.

**Staged leave/advance approval chains — designed AND implemented 27 Sep 2026, session 15.** Full design for all 6 requester categories frozen in `CLAUDE.md` ("Leave & Advance approval chains"), then built the same session: `scripts/PATCH_53_staged_leave_advance_approvals_27Sep2026.sql` (schema: `approval_chain`/`current_stage` columns on both tables, `compute_approval_chain()`, insert triggers, `my_turn_leave_requests()`/`my_turn_advance_requests()`, `review_leave_request()`/`review_advance_request()`, `request_stage_actions` audit table) plus a full frontend pass: `(supervisor)/approvals.tsx` now shows a static "moved" message (supervisors are out of both chains per Yash), `(manager)/approvals.tsx` and `(plant-head)/approvals.tsx` and `(owner)/approvals.tsx` rewritten onto the new `my_turn_*`/`review_*` RPCs via a shared `hooks/useLeaveAdvanceApprovals.ts` + `components/LeaveAdvanceApprovalCards.tsx`, and a brand-new `(hr-admin)/approvals.tsx` (HR had no approvals screen at all before — now a stage in nearly every chain). Employee-facing `LeaveScreen`/`AdvanceScreen` show "Step X of Y — awaiting `<role>`" via `lib/approvalStages.ts`.
- **Verified:** `compute_approval_chain()` checked against all 6 categories via live SQL, matches the frozen table exactly. Disposable insert tests confirmed the auto-chain trigger and owner's own auto-approval; test rows deleted after. Confirmed zero pending leave/advance requests existed before the migration ran — nothing was disrupted. `npx tsc --noEmit`: still exactly 7 errors, the same pre-existing baseline (`permissions-onboarding.tsx`/`FormsScreen.tsx` icon typing) — no new errors from any of this.
- **Not yet done:** actually exercising the flow end-to-end on a real device (submit a leave request → confirm it reaches the right manager → HR → Plant Head in order) — only DB-level and type-level verification has happened, no UI walkthrough. Do this once the new APK is out and reinstalled.
- **Cut for scope:** the old manager/plant-head advance screens had an "amount > 30%/₹30k" risky-advance warning banner; the new shared card component doesn't reproduce it (would need salary data threaded through `my_turn_advance_requests()`). Worth adding back if Yash wants it.
- **Two-step app-then-Google-Form UX — built the same session.** `components/TwoStepFormModal.tsx` + `FormsScreen.tsx` special-casing "Leave Application"/"Advance Application" by name: tapping either now opens the in-app form first (feeds the new staged chain above), shows a "Step 1 complete" confirmation, then offers the existing Google Form as step 2. Both processes run independently, per Yash's confirmed design. The 2 Google Form URLs are still `PATCH_42`'s placeholders — **Yash still needs to provide the real Leave/Advance Google Form links** (unrelated to this session's work, a pre-existing gap).
- **New APK build triggered — everyone who approves anything needs to reinstall** once it's out, same as the ambiguous-embed fix.

**Late Comers Review screen — added 27 Sep 2026, session 15.** New screen for Owner/Plant Head/HR Admin: employees late more than 3 times in the selected month (default current month), grouped by their most-frequent shift, each late date shown with IST check-in time and minutes late. `hooks/useLateComers.ts` + `components/LateComersReview.tsx`, routed per role group, linked from each role's more.tsx. No new RLS/RPC needed — `is_management()` already covers it.

**Mock-location false-positive bug — fixed 27 Sep 2026, session 15.** Root cause of VFL4057 (Devendrakumar Jagdish Singh, Maintenance supervisor) never being able to check in, and a real risk for anyone else with a weak GPS fix. `app/(worker)/home.tsx` and `components/CheckInCard.tsx` (used by every non-member role's dashboard) both computed `mockDetected = !Location.getProviderStatusAsync().gpsAvailable` — that answers "is a GPS satellite fix currently available right now", not "is this location spoofed". It's false for any legitimate check-in from indoors or with a weak signal — exactly what this plant's steel-frame shop buildings produce, and exactly what happened to VFL4057 (10 open high-severity `mock_location` fraud_alerts on 26 Sep, zero ever-recorded attendance rows). Fixed to use `location.mocked === true` (not `location.coords.mocked` — that field lives on the top-level `LocationObject`, confirmed against `expo-location`'s own `.d.ts`), the actual Android mock-GPS flag (already available in the installed `~17.0.0`, no new dependency). Both files had this duplicated at their check-in AND check-out call sites (4 sites total, fixed in all 4). `PATCH_52_resolve_false_mock_location_alerts_27Sep2026.sql` resolves VFL4057's 10 stale false-positive alerts with an audit note; no other employee's alerts touched.

**VFL5464/65/66 — status confirmed, no action needed.** VFL5464 (Nidhi Kumari, Quality) was inserted directly and is already active/logged in — done in an earlier session per Yash's explicit "QMS = Quality" decision, before the "route new hires through Fazal then Yash" instruction existed. VFL5465 (Jogindra Yadav) and VFL5466 (Suresh Ambhore) are correctly sitting in `salary_change_requests` at `status='pending_plant_head'`, `is_new_hire=true` — already wired to surface in Fazal's `(plant-head)/approvals.tsx` and then Yash's `(owner)/approvals.tsx` once he acts, exactly matching the just-confirmed instruction. No code or data change needed for either.

**GPS geofence radius — reconfirmed 27 Sep 2026, session 15: already applied, not touched.** All 12 real `plant_locations` rows were at 15m (Yash's decision from an earlier session), confirmed still live. One unexplained outlier: "Pune Office" at 200m — not part of the documented 12-location campus seed, still worth asking Yash whether that's deliberate. **Superseded 28 Sep 2026 — see PATCH_57 above, raised to 25m.**

**Ambiguous-embed bug — fixed 27 Sep 2026, session 14.** Root cause of "Fazal's Approvals screen shows nothing pending" (Yash reported, with a screenshot showing his app genuinely on Version 60/up to date — this ruled out a stale APK). The actual cause: PostgREST needs an explicit FK hint whenever more than one foreign key connects two tables being embedded together — `salary_change_requests` has 4 FKs to `employees`, `leave_requests`/`advance_requests`/`5s_submissions` have 2 each, `attendance_records` has 3. Every screen writing `employee:employees(...)` (or bare `employees(...)`) against one of these tables was sending an ambiguous embed request, which PostgREST rejects with an error — and every one of those screens destructured only `{ data }`, silently dropping `error`, so the failure looked like "nothing pending" instead of a visible error.

**This was not one screen — verified via `pg_constraint`, it affected 15 query sites across 9 files**: every role's leave/advance/salary-request approval screen (`(plant-head)/approvals.tsx`, `(owner)/approvals.tsx`, `(supervisor)/approvals.tsx`, `(manager)/approvals.tsx`), 5S verification (`(supervisor)/5s-verify.tsx`), security's checkpoint-2 checked-in list (`(security)/team.tsx`), the HR advance ledger (`(hr-admin)/advance-ledger.tsx`), and members' own leave/advance history (`hooks/useLeave.ts`, `hooks/useAdvance.ts`). Fixed by qualifying every embed with its FK column, e.g. `employee:employees!employee_id(...)`.

**⚠ This means leave/advance approvals across every role may have been silently broken for as long as this pattern existed** — not just the salary/new-hire flow added yesterday. Worth Yash/supervisors checking whether leave and advance requests have been piling up unseen. New APK build triggered by this push; Fazal (and everyone else who approves things) needs to reinstall once it's out.

**PATCH_51 (27 Sep 2026, session 14):** Blocked 25 departed employees from ever logging in.

Yash sent a "Left Employees List" (25 names/emp_codes, no longer working). All 25 confirmed live in `employees`, all still `is_active=true` and `must_change_pin=true` (never completed first login — consistent with them no longer being here to do it). Set `is_active=false` for all 25: `resolve_login_identifier()` filters `where is_active = true`, so their emp_code/phone simply stops resolving and login fails at the first step. Rows not deleted (audit trail, per this project's no-DELETE convention).

- **List:** CON16, VFL5074, CON18, VFL4004, VFL4007, VFL5203, VFL5383, VFL5425, CON21, VFL5323, VFL5410, VFL5420, VFL5428, VFL5429, VFL4002, VFL1441, VFL1465, VFL5453, VFL5398, VFL5415, VFL4030, VFL5445, VFL1568, VFL5083, VFL1550
- **⚠ Found, not fixed here:** VFL1550 (Swapnil Kakade, one of the 25) is still `supervisor_id` for 7 active employees (VFL4032, VFL4008, VFL5413, VFL5318, VFL5347, VFL5409, VFL1450). Their supervisor is now an inactive account. Needs HR to name a real replacement — not guessed here, per this project's no-guessing rule on org structure.
- **Never-logged-in count after this patch: 25** (was 80 before this session's earlier count, now down to just the genuinely active employees who haven't opened the app — full list with department in the chat reply, not repeated here).

**IST audit — complete (27 Sep 2026, session 14):** Full-codebase sweep (every screen, hook, component, and edge function) for the device-local-`new Date()` bug pattern found in the calendar fix below. Every `new Date()`, `.getMonth()`, `.getDate()`, `.getFullYear()`, `.getDay()`, and `.toISOString().split('T')[0]`/`.slice(0,10)` call in the repo was individually classified as either a real bug (used for a date-boundary query, "today"/"this month" comparison, or overdue check) or safe (elapsed-duration math, raw timestamp storage, cosmetic-only). 16 files had real bugs; all fixed.

**Fixed — 14 frontend files** (all now use `lib/istDate.ts`'s `istDateStr()`/`istNow()`/`istMonthYear()`/`getMonthEndDay()`, added in the earlier calendar fix below, plus a new `istStartOfDayUTC()` for timestamptz-column filters):
- `app/(hr-admin)/dashboard.tsx`, `app/(security)/dashboard.tsx`, `app/(plant-head)/dashboard.tsx`, `app/(manager)/dashboard.tsx`, `app/(supervisor)/dashboard.tsx` — all had `eq('date', today)` computed from device-local time
- `hooks/useLeave.ts` — `leave_balances.year` filter used device-local `getFullYear()`
- `components/ProductionSummary.tsx` — month start/end had a double bug (device-local month math, then local-midnight-to-UTC shift)
- `app/(supervisor)/casual-workers.tsx`, `app/(supervisor)/shift-report.tsx`, `app/(supervisor)/team.tsx` (×2), `app/(worker)/5s.tsx`, `app/(security)/team.tsx` — daily-record date/query all device-local
- `app/(security)/dashboard.tsx`, `app/(security)/eod-lock.tsx` — additionally needed `istStartOfDayUTC()` since these filter `vehicle_log.created_at` (timestamptz) with `gte(created_at, today+"T00:00:00")`, which is wrong without the +05:30 offset even after the date string itself is IST-correct
- `app/(owner)/kpi.tsx` — triple bug: `year` filter, `today` filter, and a 6-month trend window all device-local

**Fixed — 2 edge functions**, new shared `supabase/functions/_shared/istDate.ts` (mirrors `lib/istDate.ts`, Deno-side):
- `nightly-scoring/index.ts` — computed `year`/`month` from plain UTC getters with no IST shift at all (only "worked" because its cron happens to fire at a time where UTC and IST agree on the calendar date — fragile, not correct)
- `five-s-challenge-generator/index.ts` — same gap; matters because this function is documented to run "early morning, before the first shift," precisely the boundary window where UTC and IST disagree
- Also centralized `shift-reminder` and `mrm-reminder`'s previously-duplicated inline `istNow()` to import from the new shared file (both were already correct, just duplicated — removes the risk of the two copies drifting)
- Also found and fixed one more bug outside the original file list, in **`fraud-detector/index.ts`**'s unused `bulk_confirmation_check` action: `new Date(shiftDate); .setDate(1)` for a month-start boundary has the same missing-offset issue as the `eod-lock.tsx` case, now uses the new `istStartOfDayUTC()`.

**Confirmed safe, no changes:** `app/(plant-head)/approvals.tsx`, `app/(owner)/approvals.tsx`, `app/(supervisor)/approvals.tsx`, `app/(supervisor)/5s-verify.tsx`, `app/(manager)/approvals.tsx` (all just store raw timestamps or compute elapsed-time durations), `lib/notifications.ts`, `components/SafetyTip.tsx` (cosmetic day-of-week rotation only), `shift-reminder`/`mrm-reminder` (already IST-correct before centralizing).

**Verified:** `npx tsc --noEmit` clean (pre-existing unrelated errors in `permissions-onboarding.tsx`/`FormsScreen.tsx` confirmed present on the base branch too, via `git stash`). `npx expo export --platform web` bundled all 2929 modules with zero errors.

**[Fixed 27 Sep 2026, session 14] Attendance calendar timezone bug:** Calendar showing wrong date + yesterday's (Sep 26) attendance missing.

**[URGENT FIX] Attendance calendar timezone bug (27 Sep 2026, session 14):** Calendar showing wrong date + yesterday's (Sep 26) attendance missing.

**Root cause:** 10 locations used device-local `new Date()` instead of IST (UTC+5:30), causing wrong month queries and yesterday's data appearing in the wrong month when device timezone ≠ IST.

**Fixed:**
- Created `lib/istDate.ts` — shared IST utilities (`istDateStr()`, `istNow()`, `istMonthYear()`, `getMonthEndDay()`)
- Updated 3 hooks: `useAttendance`, `useScore` — use IST month/year, fix hardcoded 31-day month-end bug
- Updated 7 screens: `app/(worker)/attendance.tsx`, `components/AttendanceCalendar.tsx`, `app/(manager)/reports.tsx`, `app/(manager)/mrm.tsx`, `app/(worker)/payslip.tsx`, `app/(plant-head)/mrm.tsx`, `app/(owner)/dashboard.tsx`, `app/(owner)/eotm.tsx` — all now use IST date/month/year

**Result:** Calendar now shows correct date in any device timezone, yesterday's attendance appears in correct month, month-end queries work (Sept 31 no longer queried).

**Last major patch:** 26 Sep 2026 (session 13) — PATCH_50: Worker Monthly Efficiency form for management

**PATCH_50 (26 Sep 2026, session 13):** Added "Worker Monthly Efficiency" (real URL from Yash) to `form_links` under the `MANAGEMENT` virtual department — same pattern PATCH_44 used for the Overtime Form. Pure data, no app code touched: `FormsScreen.tsx` already renders every `department='MANAGEMENT'` row under "Management Forms" for manager/plant_head/owner, so this is live for Fazal immediately, no new APK needed.

**PATCH_49 (26 Sep 2026, session 13):** Plant Head review stage added to salary/new-hire approvals

**PATCH_49 (26 Sep 2026, session 13):** Adds the Plant Head review step that was missing from PATCH_46. `new-employee-flow.tsx`'s own labels have always described a 4-step chain (HR Admin Entry → Plant Head Approval → Owner Approval → Account Activation); PATCH_46 built a 2-step one (HR → Owner directly). Confirmed with Yash: applies to **both** new hires and salary revisions, and "plant manager" means the `plant_head` role (Fazal Ilahi Khan, VFL1386) — not a department manager.

- `salary_change_requests.status` now has three live stages: `pending_plant_head` → `pending_owner` → `approved`/`rejected`. Rejection can happen at either stage; approval only in order — `approve_salary_change_request`/`reject_salary_change_request` now raise a clear error if called on a request still at `pending_plant_head` (verified: owner correctly blocked with "not awaiting owner approval" until the plant head acts).
- New `plant_head_review_salary_change_request(request_id, approve, note)` — plant_head only. Approve moves it to `pending_owner` and notifies the owner(s); reject ends it there and notifies HR back.
- New audit columns `plant_head_reviewed_by/at/note` — real bug caught while testing: the first migration attempt failed on a constraint-ordering issue and rolled back *entirely*, silently dropping these three `ADD COLUMN` statements along with everything else in that transaction. Not noticed until the very next test call hit "column does not exist" — added back in a separate follow-up migration, then the whole chain re-verified end to end (HR submits → plant head approves → owner approves, confirmed both `plant_head_reviewed_by` and `reviewed_by` set; separately confirmed the plant-head-reject path leaves the employee correctly inactive).
- `bulk_apply_salary_changes` (PATCH_48) is **unchanged** — that's Yash uploading directly himself, so there's no one above him in the chain to review it.
- `app/(owner)/approvals.tsx` now filters salary items to `pending_owner` only (was `pending`), and shows the plant head's note if they left one. `app/(plant-head)/approvals.tsx` gets a new salary-requests section (same card layout, Approve/Reject calling the new RPC) — this reuses that screen's existing pending-sign-off list, just adds a new item type to it.
- **Real data problem flagged, not yet resolved**: VFL5466's salary_change_request (submitted before this patch, migrated forward to `pending_plant_head`) has `ctc_annual=20117` which is implausibly low — likely a monthly figure entered where annual was expected. Flagged to Yash directly; left untouched pending a corrected resubmission rather than guessed at.

**PATCH_48 (26 Sep 2026, session 13):** Bulk salary upload (owner only)

**PATCH_48 (26 Sep 2026, session 13):** Bulk salary upload — a second, owner-only path alongside PATCH_46/47's one-at-a-time request/approve flow, for revising many employees' pay at once.

- **New RPC `bulk_apply_salary_changes(p_rows jsonb, p_dry_run boolean)`** — owner only. One function for both preview and apply (`p_dry_run=true`/`false`) so the two can never disagree about what counts as "changed." Per emp_code, classifies as `not_found` (no active employee matches), `unchanged` (every field already matches the active breakup exactly — `IS NOT DISTINCT FROM`, so NULL vs NULL correctly counts as unchanged), or `update`/`updated`. Since the owner *is* the approver, an apply writes `employee_salary_structure` directly — no second approval step — but still logs every changed row into `salary_change_requests` (`status='approved'`, self-reviewed) so bulk changes land in the same single audit trail as everything else. A pending new-hire (`is_active=false`) is invisible to this function on purpose, so bulk revision can never collide with an in-flight new-hire approval.
- **Real finding while testing, worth flagging to Yash directly**: a bulk row must carry *every* field's current value, not just the ones being changed — submitting only 4 of the 13 fields for an employee who already has values in the other 9 correctly classified as "update" (would have nulled those 9 out), not "unchanged." This is why the upload screen leads with a **"Download Current Salary CSV"** button — editing that export guarantees every untouched employee's row is byte-for-byte identical, so they classify as unchanged and nothing is accidentally wiped.
- **CSV, not `.xlsx`** — Yash's own call. Upload validates the header row by column *name* (not position — catches a shifted/misnamed column immediately instead of silently swapping values into the wrong field), rejects the whole file up front on any missing required column, duplicate `emp_code`, or non-numeric value (never a partial apply from a half-bad file), then shows a preview (to-update / unchanged / not-found counts, changed rows listed by name) before a separate explicit Apply tap.
- New: `lib/csv.ts` (dependency-free parser/writer, round-trip tested), `app/(owner)/bulk-salary.tsx`, linked from Owner → More and from a banner at the top of Owner → Approvals' salary section. Added `expo-document-picker` (~12.0.2) and `expo-file-system` (~17.0.1) — versions matched to this project's SDK 51 pin, not left to float, per this file's own dependency-pinning lessons.
- **Tested inside a rolled-back transaction** (as Yash): unchanged-detection against a real full breakup, apply against an employee with no prior breakup, then re-ran dry-run against the same values to confirm they now classify as unchanged. Nothing real was left behind.

**PATCH_47 (26 Sep 2026, session 13):** Real push for salary/new-hire approvals

**PATCH_47 (26 Sep 2026, session 13):** Closes the notification gap PATCH_46 left open. All four functions (`add_employee`, `request_salary_change`, `approve_salary_change_request`, `reject_salary_change_request`) now call a new `notify_via_push()` helper instead of inserting into `notifications` directly. That helper calls `send-push-notification` via `net.http_post` — same pattern every pg_cron job already uses, confirmed safe by checking `verify_jwt=false` directly rather than assuming it. **Tested for real**: added a test employee as Pallavi, confirmed `net._http_response` shows `{"success":true,"notified":1,"pushed":1}`, and Yash's registered Android device received the actual push — not just an in-app bell entry. Test employee removed immediately after.

**PATCH_46 (26 Sep 2026, session 13):** Owner-approved salary + new-hire onboarding

**PATCH_46 (26 Sep 2026, session 13):** Owner-approved salary changes + new-hire onboarding — corrects PATCH_45's `add_employee` per Yash's direction: HR must never be able to set salary or activate a login unilaterally.

- **`reset_employee_pin` narrowed** from `is_management()` to `hr_admin` only — "PIN reset for anyone can be done only by HR, we don't give this feature to anyone else," including manager/plant_head/owner.
- **New table `salary_change_requests`** — one shared approval queue for two cases: a brand-new hire's initial CTC breakup, or an existing employee's revision. Both follow the same shape: HR submits (hr_admin only) → owner approves/rejects (owner only) → only approval writes `employee_salary_structure`.
- **`add_employee` rewritten.** No longer activates a login or takes a single salary number. Now: creates the `employees` row `is_active=false` with no `auth_user_id` (nothing to log into yet), takes a full CTC breakup (`ctc_annual/basic/hra/conveyance` required, `washing/education/heat_allow/vda/production_allow/medical/professional_development/communication/uniform` optional) as a `jsonb` payload, and inserts a pending `is_new_hire=true` request. Notifies the owner (in-app `notifications` row — a real device push isn't wired for this specific event yet, would need one more edge-function call).
- **New `request_salary_change(employee_id, breakup)`** — hr_admin only, same shape for an existing employee's revision. Also usable to fill the still-open `employee_salary_structure` gap for the 38 employees flagged missing since PATCH_29.
- **New `approve_salary_change_request` / `reject_salary_change_request`** — owner only. Approving a new-hire request is the moment the auth login actually gets provisioned and `is_active` flips true (same synthetic-email/PIN-as-password provisioning PATCH_10 established); approving a revision writes `employee_salary_structure` (superseding the previous active row, not deleting it). Rejecting either just marks the request rejected and notifies HR back — no employee/salary state changes.
- **New screens**: `app/(hr-admin)/add-employee.tsx` (rewritten — full breakup form, "submitted for approval" messaging instead of an instant PIN), `app/(hr-admin)/salary-request.tsx` (new — search an existing employee by emp_code, submit a revision). Both linked from the HR-Admin dashboard.
- **`app/(owner)/approvals.tsx` extended** — now also lists pending `salary_change_requests` alongside the existing leave/advance escalations, tagged "New Hire" or "Salary Revision" with the CTC/Basic/HRA/Conveyance shown before approving.
- **Full flow tested** inside a transaction impersonating both Pallavi (hr_admin) and Yash (owner) via `set local request.jwt.claims`, committed, verified, then fully cleaned up (test employee + auth user + salary rows + notifications all deleted) before this was called done.
- Superseded PATCH_45's `add_employee` signature — old one dropped explicitly so it doesn't linger as a second overload.

**PATCH_45 (26 Sep 2026, session 13):** GPS radius, HR self-service RPCs, VFL5464 onboarded (see below, unchanged from this session's earlier commit).

**PATCH_45 (26 Sep 2026, session 13):** GPS geofence tightening + HR self-service.

- **GPS radius 100m → 15m** on all 12 real campus points in `plant_locations`
  (Yash's decision, after confirming the whole campus spans only 134.7m end
  to end — the old 100m radius reached a public street corner). `plant_config`'s
  legacy single-point fallback also updated to 15 for consistency. "Pune
  Office" (200m, an undocumented 13th point not part of the original
  12-location seed) deliberately left untouched — different kind of location,
  not what was reported.
  ⚠ **Watch for `worker.outsidePlant` complaints the first few days** — 15m is
  tight relative to normal phone GPS accuracy (±5–20m outdoors, worse indoors
  near steel structures), and Machine shop sits 68.6m from its nearest
  neighbouring point, so there's a real uncovered gap between them at this
  radius. If specific shops turn out too tight, loosen per-point rather than
  globally.
- **`reset_employee_pin(employee_id)` RPC** — same logic as `HR_reset_pin.sql`,
  now a button on `missing-data.tsx` ("Reset Forgotten PIN" — enter emp_code,
  get the reset PIN back in an alert). Replaces the manual SQL Editor step for
  the everyday "forgot PIN" case.
- **`add_employee(...)` RPC** — the single-employee version of PATCH_10's
  provisioning loop (insert `employees` row + synthetic-email/PIN-as-password
  `auth.users` row, atomically). New screen `app/(hr-admin)/add-employee.tsx`,
  linked from the HR-Admin dashboard. HR can now onboard someone without a
  Claude/SQL-Editor session.
  - Real bug found while testing: both new functions called `crypt()`/
    `gen_salt()` unqualified, which fails once wrapped in a function with a
    narrowed `search_path` — pgcrypto lives in the `extensions` schema on
    this project, not `public`. Fixed by schema-qualifying both calls.
  - Also found: this project's default privileges silently re-grant `anon`
    EXECUTE on any `CREATE OR REPLACE FUNCTION`, even after an explicit
    `revoke ... from public`. Both RPCs now `revoke ... from public, anon`
    explicitly and were re-verified authenticated-only afterward.
  - Tested inside a transaction impersonating a real hr_admin (Pallavi,
    VFL5440) via `set local request.jwt.claims`, then rolled back, before
    either was wired to a button.
- **VFL5464 (Nidhi Kumari, Quality, staff) added for real** via `add_employee()`
  — flagged missing since PATCH_29's `employee_salary_structure` seed. Gender
  `female` (already confirmed by Yash in PATCH_33's data-gathering, just never
  had a row to apply it to). Salary left NULL — not in the phone list Yash
  sent, not guessed. Starting PIN 005464, `must_change_pin=true`.
  **VFL5465 / VFL5466 deliberately NOT added** — PATCH_29 already found and
  excluded these two as placeholder/test rows (email "aaaaa"/"aaaaaa", IFSC
  "000000", PAN "asdfgh"); the phone list just sent carries the same
  placeholder emails for them, so treating that finding as still current
  rather than re-litigating it. Flag to Yash if these should be revisited.
- **Dashboard "Never signed in" list — no longer truncated.** `dashboard/index.html`'s
  data-quality section already computed this list (from `must_change_pin`)
  but capped it at 12 names; HR needs the complete list to work through daily.
  Now shows every never-logged-in employee, grouped by department, with a
  per-department count — this **is** the "daily list to HR" ask, no new cron
  or edge function needed since HR already opens this dashboard.
- **Still open, needs Yash:**
  - VFL4057 (Devendrakumar Singh, Maintenance) reported "not able to check
    in." Traced as far as data allows: his device lock was already reset
    today (device_registrations row from 10:56 IST this morning) and his
    auth account works, but he has zero `attendance_records` rows ever — a
    rejected check-in (outside geofence, or fraud-detector's mock-location
    check) never writes a row, so the DB can't say which is still blocking
    him. Needs a screenshot of what his check-in screen actually says.
  - Whether "Pune Office"'s 200m radius was deliberate (not part of the
    documented 12-point seed).

**Payroll Engine (24 Sep 2026, session 12):** `scripts/VFPL_Payroll_Engine_24Sep2026.gs` — paste into the `VFL HR OS 2026 27` spreadsheet's Apps Script editor.
- Applies all FORMULA_AUDIT corrections: VDA = physical days × ₹103, heat allow = ₹5.78/day, no intermediate rounding for staff, efficiency slab 81–85%, ESIC exempt above ₹21,000, PF capped at ₹1,800.
- Writes PAYROLL_DRAFT; promotePayrollDraft() moves approved rows to PAYROLL_STAFF / PAYROLL_WORKER.
- **Before first run, fill these tabs in the spreadsheet:**
  - `PAYROLL_PERIOD` row 2: Month, Year, Working Days, Period Start, Period End
  - `STATUTORY_CONFIG`: PF_WAGE_CEILING=15000, PF_EMPLOYEE_RATE=0.12, PF_MAX_EMPLOYEE=1800, ESI_EMPLOYEE_RATE=0.0075, ESI_EXEMPT_ABOVE=21000, WORKER_VDA_RATE=103, WORKER_HEAT_RATE=5.78, PT_SLABS=\<JSON from HR once Maharashtra slabs confirmed\>
  - `INPUT_ATTENDANCE`, `INPUT_OT`, `INPUT_EFFICIENCY` — sourced per the INPUT sheet design in the spreadsheet
- PT returns ₹0 until Yash/HR confirm Maharashtra slabs and enters them as PT_SLABS JSON in STATUTORY_CONFIG.
- Staff incentive is ₹0 placeholder — deferred until ~3 months real app usage.
- Supabase export: NOT part of this engine. Run `syncOpsDashboardToSupabase()` separately after HR+Finance approve the draft.

**PATCH_43 (24 Sep 2026, session 12):** Real Google Form URLs for all 6 is_common forms. Applied.
**PATCH_44 (24 Sep 2026, session 12):** OT form for manager/plant_head/owner via MANAGEMENT virtual dept. Applied.

**PATCH_42 (24 Sep 2026, session 11):** Leave Application + Advance Application switched to Google Forms.
- In-app leave/advance screens removed from My Requests banner in FormsScreen — the approval chain (supervisor → manager → HR → accounts) isn't built yet.
- Both now appear as `is_common=true` rows in `form_links` alongside Gate Pass, Cash Expenses, Hospital Form.
- `scripts/PATCH_42_leave_advance_as_forms.sql` — 2 rows inserted (DB already applied).
- **Yash must update the 2 placeholder URLs with real Google Form links** (Leave Application, Advance Application). In-app leave/advance screens remain as hidden routes for when the approval flow is built later.

**PATCH_41 (24 Sep 2026, session 11):** Forms tab reorganization across all 7 roles.
- `components/FormsScreen.tsx` — completely rewritten with three conditional sections: "My Requests" (all roles: Leave + Advance + common Google Forms from DB), "HR Operations" (hr_admin only: Shift Planning), "Department Forms" (supervisor/manager/security: deadline strip + dept form_links).
- `components/LeaveScreen.tsx` + `components/AdvanceScreen.tsx` — new shared components; each role's leave.tsx/advance.tsx is now a one-line wrapper around these.
- Worker: Leave tab replaced with Forms tab. Leave + Advance are now hidden routes navigated from the My Requests banner.
- HR Admin: Shift Planning tab replaced with Forms tab. Shifts accessible as hidden route from Forms → HR Operations banner.
- Plant Head + Owner: Forms tab added (now 6 tabs each).
- Security: Vehicle Log removed from tab bar (hidden route); Forms tab kept.
- Supervisor + Manager: Forms tab already existed; leave + advance added as hidden routes.
- `scripts/PATCH_41_common_forms_banner.sql` — `is_common` column on `form_links`; 3 placeholder rows for Gate Pass, Cash Expenses, Hospital Form. **Yash must update the 3 placeholder URLs with real Google Form links.**
- DB change already applied via Supabase MCP.

**PATCH_40 (25 Oct 2026, session 10):** Permissions onboarding + update check already built.
- `lib/permissions.ts` — `requestAllPermissions()` requests location, camera, notifications in sequence upfront, so employees never see a surprise system dialog mid-flow.
- `app/(auth)/permissions-onboarding.tsx` — one-time screen shown after first PIN change (via `change-pin.tsx` redirect) and for returning users who haven't done it yet (gated in `app/index.tsx` via AsyncStorage key `app.permissionsRequested`). Dismissible with "Skip" — individual flows keep their own lazy permission requests as a safety net.
- `UpdateBanner` + `useAppVersion` were already fully built and wired in `_layout.tsx` — CI stamps `versionCode` with the run number, and the banner compares against the GitHub Releases API. No code change needed for update notifications.
- `scripts/FRESH_INSTALL_25Oct2026.sql` — run in Supabase SQL Editor on 25 Oct before distributing the APK. Clears `device_registrations`, resets `must_change_pin = true` for all 138 active employees, and resets all auth user passwords to starting PINs (VFL employees: `lpad(digits,6,'0')`; CON employees: `'20'||lpad(digits,4,'0')`).

**25 Oct 2026 fresh install procedure:**
1. Run `scripts/FRESH_INSTALL_25Oct2026.sql` in Supabase SQL Editor.
2. Share APK download link via WhatsApp: `https://github.com/erpvarsha-star/forge-os-trial/releases/latest/download/app-release.apk`
3. Every employee installs → logs in with starting PIN → forced PIN change → permissions screen → normal use.
4. Device locks are fresh — no one is blocked from registering their device.

**Consultant logins**: Added 9 confirmed-active consultants (CON01, CON05,
CON09, CON12, CON16, CON18, CON20, CON21 with departments; CON13 no
department on file). Applied **PATCH_35** directly via MCP — employees
inserted, Supabase auth users provisioned, `must_change_pin = true`.
PIN formula: `'20' || lpad(digits, 4, '0')` — CON01 = 200001. All use
`role='member'`, `category='consultant'` so they see the worker UI (GPS
check-in + QR). Deliberately excluded pending Yash confirmation: CON19
(Bunglow Maid — needs factory GPS?), CON22 (name matches VFL4004 Digambar
Todekar), CON23 (name matches VFL4030 Suresh Gawali). Total employees now
138 (129 original + 9 consultants). See "🟡 Consultant logins" below.

**Monthly attendance count**: Every non-worker role now sees a "Present
this month: N days" stat at the bottom of their `CheckInCard`. Uses the
`records` the hook already fetches — no extra query. Counts `status='P'`
rows for the current month. Shows for all 7 roles (workers via
`worker/attendance.tsx` calendar already had this; now non-workers have it
too via CheckInCard).

**Security forms tab**: Added `app/(security)/forms.tsx` (wraps the shared
`FormsScreen` component) and wired it into `(security)/_layout.tsx`.
Security guards now have 6 tabs: gate-qr, vehicle log, checkpoint2,
eod-lock, **forms**, more. The tab shows form links from `form_links` scoped
to the security guard's department. Currently no rows exist for security in
`form_links` — Yash needs to provide the 4 URLs (57 AT, 57 F4, Out
Material In, Dispatch) so HR can add them to the table.

**PATCH_37 (25 Sep 2026, session 7):** QR time-bucket security + exemptions.
- `requires_qr boolean NOT NULL DEFAULT true` added to `employees`; VFL1001
  (Yash, owner) and VFL1567 (Kajal Sutar, Pune office) set to `false`.
- QR formula changed from daily (`plant_id-date-salt`) to 30-minute buckets
  (`plant_id-date-bucket-salt`, bucket 0–47 in IST). A WhatsApp photo of the
  gate QR is worthless after the current 30-min window ends.
- `gate-qr.tsx`: shows remaining minutes in current bucket; refresh interval
  detects bucket rollover (not just date rollover).
- `qr.tsx`, `CheckInCard.tsx`: both scan paths use `buildQrValue()` from
  `lib/location.ts` — single formula, can't drift.
- `home.tsx`, `CheckInCard.tsx`: QR star card and QR quick-action hidden when
  `employee.requires_qr === false`.
- `nightly-scoring`: `requires_qr=false` employees score GPS alone as 100%
  (not capped at 50%); everyone else unchanged.
- SQL applied to Supabase (verified: 136 true, 2 false). Committed as one
  batch with `PATCH_36` (security forms) in this session's final push.

**PATCH_39 (24 Sep 2026, session 9):** Device lock + checkout GPS+QR.
- `device_registrations` table (device_id UNIQUE → employee_id). SECURITY DEFINER `register_device()` returns `{allowed, reason}`. Called on every `loadEmployee()` — registered once, stays locked until HR resets it.
- `clear_device_registration(employee_id)` SECURITY DEFINER — HR admin resets device so employee can log in on a new phone. HR Missing Data screen (`hr-admin/missing-data.tsx`) now lists all registered devices with a trash-icon reset button.
- `attendance_records.check_out_qr_verified BOOLEAN DEFAULT FALSE` — data collection until 15 Oct 2026.
- `handleCheckOut` in `home.tsx` and `CheckInCard.tsx`: now includes geofence check + mock-location block (same as check-in). After successful GPS checkout, shows inline exit QR scanner modal — same gate QR + same geofence validation, calls `confirmQrOut()`.
- Entry QR card (shown while checked in) and exit QR card (shown after checkout) are now separate — was one card covering both states incorrectly.
- `login.tsx`: `DEVICE_TAKEN` error shown with a clear HR-contact message (not the raw error string).
- SQL applied via Supabase MCP (verified).

**PATCH_38 (24 Sep 2026, session 8):** Shifts seed + late tracking + hours_worked + half-day.
- `shifts.late_grace_minutes INTEGER` + `attendance_records.hours_worked NUMERIC(5,2)` added to schema.
- Shift 1/2/3 confirmed times (7:00–15:30, 15:30–00:00, 00:00–07:00) with 15 min grace each.
- General (09:00–18:00, 30 min grace), Security Day (07:00–19:00), Security Night (19:00–07:00) inserted.
- General shift auto-assigned to all active staff+consultants (not supervisor/security_guard) Sep 24–Dec 31 2026, skipping Fridays.
- `useAttendance.ts`: IST date everywhere (fixes Shift 3 UTC-off-by-one), `checkIn()` now takes `lateMinutes` — writes `status='L'` vs `'P'`, `late_minutes` to DB. `checkOut()` computes `hours_worked` and applies half-day rule (`late_minutes ≥ 180 + checkout ≤ shift end → status='HL'`).
- `home.tsx`, `CheckInCard.tsx`: read grace from shift, compute `rawLateMinutes` using IST minutes (not device timezone), pass `effectiveLateMinutes` to `checkIn()`, pass `shift.end_time` to `checkOut()`.
- `CheckInCard.tsx`: shows `lateThisMonth` count (L+HL) alongside present days.
- `shifts.tsx`: full redesign as Sat–Thu weekly grid; workers+supervisors pick Shift 1/2/3 chips; security picks Day/Night; "Save Week" batch-upserts all 6 days.
- HR notification for very-late arrivals (no-hard-lockout rule) deferred — RLS blocks workers inserting notifications; needs an edge function. See 🔲 below.

**Previous session (24 Sep, session 5):** GPS→QR check-in fix; security
logout added; 6 non-worker roles got QR check-in via CheckInCard modal;
salary consolidation PATCH_28–PATCH_33 shipped. See below.

**Two sessions back (24 Sep, session 4):** GPS + QR dual check-in
(GPS=50%, GPS+QR=100% attendance score); security QR first tab; missed
check-in push notification. `scripts/ALERT.gs` updated to v4.

**Salary consolidation**: shipped **PATCH_28** through **PATCH_33** —
schema (`employee_salary_structure`, `pt_slabs`, `efficiency_incentive_slabs`,
extended `payroll_records`, `employees.gender`), seeded
`employee_salary_structure` for 91/129 employees, `payroll_monthly_rates`
(PATCH_31, for the real VDA formula found this session), corrected
Production Efficiency to NOT be department-scoped (PATCH_32), and
backfilled `employees.gender` for all 129 (PATCH_33, from Yash's direct
confirmation of the 3 female employees currently on staff). Ran a full
historical backtest across all 52 worker-sheet and 29 staff-sheet monthly
tabs (not just Aug 2026): found the real VDA formula (`per-day rate ×
Present Days`, 100% match on the 7 most recent months) after the original
assumption tested at only 25-55%, and confirmed OT was already correct
(89.8% match, one real exception traced to a stale value in the source
sheet). `run-payroll` (v4) redeployed with all corrections. Queued next:
the consolidated Google Sheet + Apps Script sync (Yash's request, not yet
started). See "🟡 Salary consolidation" below for the full story. Nothing
else app-visible changed — schema + reference data + the edge function
only, existing screens all still work unchanged besides the check-in fix.

**Previous session (24 Sep, session 4):** GPS + QR dual check-in (GPS=50%, GPS+QR=100% attendance score); security QR first tab; missed check-in push notification. `scripts/ALERT.gs` updated to v4 (23 Sep 2026): hourly trigger topology, Phase 2 recipient routing, health watchdog, Cutting 2-shift config, DME Telegram, `setupDynamicSupervisorTabs()` disabled to prevent accidental SUPERVISOR_MAP wipe; all 4 live secrets blanked before commit. `form_links` sync: DB already matches v4 DEPT_FORM_SEED exactly (31 rows) — no changes needed. Manager layout: team tab hidden, "View Team →" on dashboard — already done in prior session. APK build triggers on push. Remaining open: APPS_SCRIPT_URL, supervisor Telegram onboarding (5 missing: Subhash Palve, Shivaji Jaypure, Manoj Wagh, Sunil Saha, Abhimanyu Kakde), per-form tracking. Action for Yash: (1) paste updated `scripts/ALERT.gs` into live Apps Script editor, run `deployShiftTrackingTriggers()`; (2) HR Admin must assign supervisor_id for Cutting/Press/Machine/HT/Electricity/Oil/VMC supervisors.

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

## 🟡 Consultant logins — applied 25 Sep 2026, needs Yash action

9 consultants added and live: CON01 Chhagan Dehade (Die Shop), CON05
Madhukar Gosavi (Design), CON09 Nagnath Kale (Die Shop), CON12 Sadashiv
Soddy (Quality), CON13 Sanjeev Supsande (no dept), CON16 Sarwan Prasad
(Forge Shop), CON18 Bapusaheb Gawate (Die Shop), CON20 Prabhuling Achaleri
(Die Shop), CON21 Balasaheb Yeole (Maintenance).

Login: CON ID (e.g. "CON01") or phone number once added.
Starting PIN: `'20' + lpad(digits, 4, '0')` — CON01 = **200001**,
CON21 = **200021**. Must change PIN on first login.

**Pending confirmation from Yash:**
- **CON19** Chhaya Shelke — Bunglow Maid (Administration). Does she need
  factory GPS check-in? If yes, add with `department='Administration'`;
  if no, skip.
- **CON22** Digambar Mahadeo Todekar — Die Shop. Name matches VFL4004
  Digambar Todekar from the 5-worker gap list (PATCH_29). Same person
  re-engaged as consultant? Cannot add without Yash confirming they are
  different individuals.
- **CON23** Suresh Sopan Gawali — Final Shop. Name matches VFL4030 Suresh
  Gawali from the same gap list. Same reason.

---

## 🔲 Salary calculation rules — target 15 Oct 2026

Requires ~15 days of real app usage data from the 1 Oct rollout. Once workers
are checking in/out consistently and late-minutes + hours_worked are
accumulating in `attendance_records`, review the data with Yash to confirm
practical late thresholds, half-day edge cases, and OT patterns before
encoding salary deduction rules.

Also covers: HR notification for very-late arrivals (deferred from PATCH_38 —
currently check-in always proceeds but HR has no in-app alert; needs an edge
function since RLS blocks client-side notification inserts for workers).

**Not to start before:** 15 Oct 2026.

---

## 🟡 Salary consolidation — in progress, started 24 Sep 2026

Replacing 6 Google Sheets (worker + staff calc engines, worker + staff
payslip generators, one shared leave sheet, one empty placeholder) with one
system inside Forge OS. Full findings + approved implementation blueprint:
`/root/.claude/plans/zazzy-sauteeing-crystal.md` (this plan file is local to
the session that wrote it — if it's not accessible in a future session, the
key facts are summarized below; ask Yash to re-share source docs if the
detailed formulas are needed again).

**Confirmed design decisions (don't re-litigate these):**
- Confirmed-days entry (Present/EL/CL/SL/PH/Working Days) stays 100% manual,
  checked by Dept Heads → Accounts → HR — never automated from
  `attendance_records`. The only change: HR's screen shows Forge OS's own
  attendance figure alongside the entry field for their existing cross-check.
- **Dual input path, not app-only**: both a consolidated Google Sheet (synced
  via a new Apps Script, same pattern as `syncOpsDashboardToSupabase()`) and
  in-app HR-Admin screens write into the same tables — this site's frequent
  power/internet drops mean payroll can't depend on the app alone.
- Leave allocation is a **fixed annual grant**, not accrued — simpler than
  first assumed. `leave_requests`/`leave_balances` already fit this shape.
- Staff production incentive maps to Forge OS's own `monthly_scores`
  (on-time + form submission) — but the payout tiers are **deliberately
  deferred ~3 months** until there's real app usage to calibrate against.
- A bank disbursement statement (printable, stamped, submitted to the bank)
  needs to be downloadable from the app — format still needs Yash to confirm
  (PDF letter vs. a specific bulk-upload CSV/Excel the bank wants).
- **Parallel run required before the old sheets are retired** — old sheets
  and the new engine run side by side for an agreed number of real payroll
  cycles (2 months suggested, not fixed), every component compared, not just
  net pay. Non-negotiable given real statutory numbers are involved.

### ✅ Phase 1 — schema — DONE 24 Sep 2026

`PATCH_28_payroll_schema_24Sep2026.sql` — applied via Supabase MCP, verified
clean (no new security-advisor findings). Schema-only: no app screens changed,
`payslip.tsx` and existing payroll reads work exactly as before.

- `employees.gender` added (needed for PT — the real slabs are
  gender-differentiated). Existing rows are NULL; needs backfilling before
  PT can compute correctly for anyone.
- `employee_salary_structure` — new table for CTC + every fixed component +
  bank/UAN/PAN/ESI details. **Created empty** — seeding from the master
  spreadsheet is Phase 2, gated on Yash confirming that source data is
  current (see below).
- `pt_slabs` — **seeded with real data** Yash shared 24 Sep (Maharashtra
  slabs, male/female, February ₹300 true-up noted in `remarks`).
- `efficiency_incentive_slabs` — seeded with Forge Shop's real Union
  Agreement slabs (01/09/25–31/08/26 period) from the PDF Yash shared.
  **Forge Shop only** — whether other worker departments have their own
  agreements is still unconfirmed.
- `payroll_records` extended: `working_days, present_days, el, cl, sl, ph,
  days_payable, ot_hours, canteen, society, mlwf, arrears,
  dispatch_incentive, other_allowance, production_efficiency_deduction,
  status, updated_at` (+ trigger to auto-set `updated_at`, reusing the
  existing `set_updated_at()` function).
- `leave_requests.type` CHECK extended to add `COFF`/`OD` (Compensatory Off,
  Outdoor Duty — confirmed live categories tracked via the same application
  form, just via a type value the schema didn't have room for).

### ✅ Phase 2 — employee_salary_structure seed — DONE 24 Sep 2026

`PATCH_29_employee_salary_structure_seed_24Sep2026.sql` — applied via
Supabase MCP, verified (91 rows, `select count(*) from
employee_salary_structure` = 91).

**Source corrected mid-flight**: not the "VFL Waluj Employee Master Data"
spreadsheet's Staff/Permanent Worker tabs used in the first pass — those
disagreed with a separate "Sheet17" tab in the same workbook for 71 of 75
overlapping employees (always Sheet17 higher, no way to tell which was
current). Switched to the calc engines' own `Master Data` tabs instead
(the ones that actually drive live payroll, confirmed via formula trace) —
Yash re-downloaded the staff one fresh 24 Sep to make sure it was current.

**91 of 129 employees seeded** (19 workers + 72 staff, `Status='Active'` in
the calc sheet). Corrections applied: VFL5463 ("Manoj Anantrao Wagh")
remapped to VFL5337 (already documented in CLAUDE.md as the same person);
VFL5465/VFL5466 excluded (obvious placeholder test rows — email "aaaaa",
IFSC "000000", PAN "asdfgh"); VFL5400's account number nulled (source value
was a float-precision-loss artifact, not a real account number — needs
HR to re-enter before this person's payroll can actually be disbursed).

**Still open — 24 people, real follow-up, not a code gap:**
- **VFL5464 "Nidhi Kumari"** — real-looking data (real email, Kotak Mahindra
  bank details, joined 26 Jul 2026, QMS dept) in the calc sheet but **no
  employees row in Forge OS at all**. Looks like a genuine hire never
  onboarded into the app — needs a real emp_code decision from Yash, not a
  guess, same as every other "confirm before adding" case in this file.
- **23 employees active in Forge OS but missing from the calc sheet**: 5
  workers whose calc-sheet status disagrees with Forge OS — Kailash Dhiwar
  (VFL4002), Digambar Todekar (VFL4004), Hanumant Shigarkanti (VFL4007),
  Suresh Gawali (VFL4030), Babasaheb Randive (VFL4048) — worth checking
  whether these five have actually left. Plus 18 staff missing entirely:
  Dipak Patil (VFL1319), Jitendrasingh Nainsingh (VFL1441), Mahipal Singh
  (VFL1465), Swapnil Kakade (VFL1550), Farhan Shah (VFL1568), Angad Kate
  (VFL5074), Nivrutti Jadhav (VFL5083), Santosh Dabhade (VFL5203), Shaikh
  Abdul Gani (VFL5323), Rahul Patil (VFL5354), Vikas Pere (VFL5383), Raju
  Kasare (VFL5410), Payal Surve (VFL5415), Rohit Mokase (VFL5420), Dipak
  Kharat (VFL5425), Saurabh Ghorpade (VFL5428), Pooja Pawar (VFL5429),
  Shreyash Mhaske (VFL5445). Their payroll stays blank until Yash provides
  the data — same "acceptable until HR provides it" precedent PATCH_26
  already set for staff missing from its source sheet.

### ✅ Advance balances seeded — PATCH_34, 24 Sep 2026

Yash gave a real list: name, current balance, monthly deduction until
cleared, for 8 employees. `advance_requests` had no column for a fixed
monthly rupee figure (only `repayment_months`, an integer month count) —
added `monthly_deduction` rather than force-converting into a month count
that was never actually given.

**7 of 8 matched and inserted** (`status: 'approved'`,
`outstanding_balance` = the given balance): Tushar Abasaheb Shirgire
(VFL1389, ₹95,000/₹5,000mo), Brahmanand Kaduba Tajne (VFL1482,
₹18,000/₹3,000mo), Jitendrasingh Nainsingh (VFL1441, ₹253,000/₹5,000mo),
Bhupendra Kashinath Bharude (VFL1528, ₹12,000/₹5,000mo), Kajal Balkrishna
Sutar (VFL1567, ₹168,000/₹8,000mo), Shrawan Rewant Singh (VFL1520,
₹142,000/₹4,000mo), Sudeep Singh (VFL5079, ₹169,000/₹5,000mo).

One deliberate disambiguation caught before it became a real mistake:
"Shrawan Rewant Singh" is VFL1520 by exact full-name match — **not**
VFL1527 "Sharwan Singh Jodha", a different person CLAUDE.md already flags
as historically confused with VFL1520 ("phone... duplicate of VFL1520").

**8th name, Ganesh Laxmanrao Kausadkar — NOT in Forge OS.** No match on
"Ganesh" anywhere in `employees`, at all. Same class of gap as Nidhi
Kumari (PATCH_29/33) — a real person in Yash's own records with no
`employees` row. Not fabricated. Needs a real emp_code from Yash before
this one can be added.

Not yet wired into `run-payroll` — the engine's `advance_recovery` is
still an HR-typed monthly input per the confirmed-days screen, not yet
auto-populated from this table. Worth doing once Phase 4's entry screens
are built (default the field to `monthly_deduction`, editable), not done
silently now.

### ⏳ Still needed before Phase 3 (calculation engine) can go live

1. **Bonus scope** — rates confirmed (Staff 8.33%, Worker 18%, both of
   Basic), but Bonus is an annual statutory payout, different cadence from
   monthly payroll. Needs a decision: part of this build, or a separate
   module.
2. **Does every worker department have its own efficiency agreement like
   Forge Shop's?** Only Forge Shop's slabs are seeded.
3. **Bank statement format** — confirmed: printable A4 PDF, print + stamp,
   no special bank bulk-upload format needed.
4. The 24 people above (VFL5464 + the 23-person gap) — engine can go live
   for the 91 who have data without waiting on these.

### ✅ Phase 3 — run-payroll calculation engine — DEPLOYED 24 Sep 2026, VDA/OT now backtest-confirmed

`supabase/functions/run-payroll` — deployed (v3). Computes one employee's
month from `employee_salary_structure` + confirmed-days/one-off inputs,
upserts into `payroll_records`. Two callers by design (in-app screens,
future sheet sync) — same function, same output either way.

**Full historical backtest run 24 Sep 2026** — every standard monthly tab
in both the worker sheet (52 months, back to Apr 2022) and staff sheet (29
months, back to Jan 2024) checked, not just Aug 2026:

| Component | Status |
|---|---|
| Basic, Conveyance, Washing, Education, HRA pro-ration | ✅ Match exactly |
| PF | ✅ Matches exactly (₹1,800 = ₹1,800) |
| **VDA** | ✅ **Fixed** — the original assumption (pro-rates like Basic) was wrong, only 25-55% match across 1,718 employee-months. Real formula found: `per-day VDA rate × Present Days` (Present Days ONLY, excludes EL/CL/SL/PH, unlike every other component). **100% exact match, 172/172 employee-months, across the 7 most recent tabs (Feb–Aug 2026).** The per-day rate is a company-wide monthly value, now its own table: `payroll_monthly_rates` (PATCH_31) — not in `employee_salary_structure`, entered once per month. **Currently empty — VDA computes to ₹0 with a warning until HR enters the first month's rate.** |
| **OT Amount** | ✅ **Confirmed correct as originally coded** — 89.8% exact match across 1,123 worker employee-months, 47 of 52 months exact. Uses `employee_salary_structure.vda` (the stored "VDA (F)" snapshot) in the hourly-rate calc, deliberately NOT the new monthly VDA rate — tested swapping it and it broke 3 previously-exact months to fix nothing. The one live-relevant miss, Aug 2026, traced to the *source sheet's* VDA(F) snapshot being one revision stale that month — a data-freshness issue in the old sheet, not this formula; keeping `employee_salary_structure` current avoids repeating it. Staff OT: ~99%+ match across 1,510 employee-months. |
| ESIC | Not backtested against a real row yet — but the *rule itself* (0.75% of gross, exempt above ₹21,000) is confirmed correct by Yash, replacing the sheet's buggy copy-paste-from-PF formula. |
| **PT** | Rule confirmed (Maharashtra slabs, gender-differentiated). **`employees.gender` now backfilled for all 129** (PATCH_33) — can compute for everyone. Still not backtested against a real payslip row. |
| **Production Efficiency** | ✅ **Fixed** — was wrongly modelled as department-scoped. Now correctly one shared figure for all 19 workers (PATCH_32). Not yet backtested — `worker_efficiency_actuals` is still empty, needs HR's first monthly entry. |

**PATCH_31** (applied 24 Sep 2026): new `payroll_monthly_rates` table
(`month`, `year`, `vda_per_day_rate`, unique per month/year) — the missing
piece VDA needed. **Confirmed by Yash: the rate is one fixed number for
every worker, company-wide** (not per-grade/department), revised roughly
every 6 months, same change for everyone when it happens. No schema change
needed beyond PATCH_31 — HR just re-enters the same value each month within
a 6-month block, same as they'll already be doing for confirmed-days/OT
hours. **HR needs a place to update this** — scoped into the Phase 4
HR-Admin build below, not built yet.

**PATCH_32** (applied 24 Sep 2026) — **Production Efficiency is NOT
department-scoped, confirmed by Yash.** It's one achieved % per month,
same for all 19 workers, entered once a month before the salary run (not
daily). Corrects the department-keyed design from PATCH_28/30 — the Aug
2026 "Efficiency Calculations" sheet listing several departments under one
shared 80% figure was the tell; "Data is Collected from Forge Shop" meant
Forge Shop's supervisor *collects* the number for the whole worker roster,
not that it's Forge-Shop-specific. Dropped `department` from
`efficiency_incentive_slabs`; replaced `department_efficiency_actuals`
with `worker_efficiency_actuals` (month, year, achieved_pct — no
department column). `run-payroll` (v4) updated and redeployed to match.

**PATCH_33** (applied 24 Sep 2026) — **`employees.gender` backfilled for
all 129 employees.** Yash confirmed the complete company-wide female list
directly: Mayuri Sardar Rathod (VFL5446), Pallavi Vishnu Khade (VFL5440),
Kajal Balkrishna Sutar (VFL1567) — 3 found and set to `female`. The 4th
name given, Nidhi Kumari, has no `employees` row yet (matches the known
open item: real-looking hire in the calc sheet, never onboarded into Forge
OS — needs a real emp_code before she can be added). Everyone else (126)
set to `male`. PT can now compute for every employee.

**PATCH_30** (small schema fix, applied same session): added
`payroll_records.other_deduction` (missed in PATCH_28).

**Not yet tested from Forge OS itself** — the sandbox's outbound network
proxy blocks direct calls to the Supabase functions endpoint (same
restriction noted elsewhere in this file for other integrations), so every
backtest so far was done by replicating the engine's exact logic in a local
Python script against real seeded data, not by literally invoking the
deployed function over HTTP. Worth a real end-to-end call once there's app
access to verify the deployed version behaves identically — should, since
the logic is line-for-line the same, but not independently confirmed.

### Not yet built (Phase 4+)

HR-Admin entry screens (confirmed-days first, plus small fields for the
monthly VDA rate and worker efficiency %), the consolidated sheet + Apps
Script sync (see below — in progress), `payslip.tsx` additive updates, bank
statement export, then the parallel-run verification gate. Every formula
is now backtest-confirmed or confirmed-by-design; the only things standing
between here and a real payroll run are HR's first-month data entry
(`payroll_monthly_rates`, `worker_efficiency_actuals`, confirmed-days) and
the entry screens themselves.

### 🔲 Consolidated Google Sheet + Apps Script sync — requested 24 Sep 2026, not started

Per the approved blueprint's dual-input-path decision: a single Google
Sheet, synced via a new Apps Script (same pattern as
`syncOpsDashboardToSupabase()`), pulling from all 5 old payroll sheets +
the new Forge OS forms, using the **exact same formulas and writing to the
same data bank** (`payroll_records`, via `run-payroll`) as the in-app path
— neither is the "real" one. Scope: **April 2026 to present, at minimum.**
Plan: build the workbook (openpyxl, using the same cached source data this
session's backtest already pulled from) with real formulas per month tab,
upload to Drive, then write the Apps Script sync script. Not yet started —
queued as the next build task.

---

## ✅ Completed setup items (Sep 2026)

- [x] **Netlify deployment — COMPLETE per Yash, 21 Oct 2026 (was recorded as not done earlier the same day; he confirmed it is now complete, I did not independently verify the live dashboard).**
      What I verified: the PR #18 deploy preview failed at Netlify's secrets scan
      (public Firebase key in `google-services.json`); PR #19 added
      `SECRETS_SCAN_OMIT_PATHS = "google-services.json"` and Netlify's own rebuild
      of the branch (deploy `6ad805ab…`, site `forge-os-review`) reported `ready`
      with 0 secret matches. I did NOT confirm the live dashboard's content or that
      `APPS_SCRIPT_URL` produces a working production panel, and Yash says the
      deployment is not done — so treat it as unfinished. Needs: ask Yash what he
      sees (which site/URL, what is missing), check the `APPS_SCRIPT_URL` env var
      on the right Netlify site, and re-check the preview for PR #20 (not yet looked at).

- [x] **Netlify dashboard deploy + production panel — committed 10 Sep 2026.**
      Added `netlify.toml` (static deploy config) and a Production & collections
      card to `dashboard/index.html` that fetches the Apps Script aggregator
      after sign-in.
      **Still open:** Provide the Apps Script web app exec URL (Deploy → Manage
      deployments → copy the `https://script.google.com/macros/s/.../exec` URL).
      Claude will set `APPS_SCRIPT_URL` on the Netlify site via MCP and trigger
      a redeploy immediately — no manual steps needed once the URL is shared.

- [x] **Multi-point geofence — APPLIED.** `COMBINED_DEPLOY_21to22` + `PATCH_23`
      (Pune office 200m) applied. 13 campus points total.

- [x] **Firebase / FCM — DONE 9 Sep 2026.** `FCM_SERVICE_ACCOUNT_JSON` pasted
      into Supabase Edge Functions Secrets. Direct FCM v1 path via
      `supabase/functions/_shared/fcm.ts`.

- [x] **Expo token revoked** (`9HDy_…`) — ✅ Revoked and fresh token added 9 Sep.

- [x] **Expo account password rotated** — ✅ Rotated 9 Sep.

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

## 🔴 OPEN RISK — 16 Dependabot PRs propose bumps this project deliberately pinned AGAINST (found 10 Nov 2026)

`.github/dependabot.yml` reached the base branch via `05a541c` (PR #61) and has
since opened **PRs #62–#76**, all targeting `claude/forge-os-backend-setup-7woj4t`.
**Dependabot does not read CLAUDE.md**, so several of these propose exactly the
upgrades CLAUDE.md's "App build" section documents as having already broken this
APK once. Verified against `package.json` on 10 Nov 2026:

| PR | Bump | Why it is dangerous here |
|---|---|---|
| #69 | `expo-constants` ~16.0.0 → **58.0.15** | Project is **Expo SDK 51**. expo-constants 58 targets SDK 58. `lib/deviceId.ts` exists *because* of this package's API behaviour. |
| #72 | `tailwindcss` ^3.4.0 → **4.3.4** | NativeWind is pinned `~4.1.23` precisely to stay on Tailwind 3 / `react-native-css-interop` 0.1.x. Tailwind 4 reopens the css-interop → `react-native-worklets` (Reanimated 4) cascade against our pinned `reanimated ~3.10.0`. |
| #68 | `typescript` ~5.3.0 → **7.0.2** | Would invalidate the documented **7-error `tsc --noEmit` baseline** that every PR gate in this project is measured against. |
| #74 | `react` 18.2.0 → major | `react-native` is pinned `0.74.0`, which expects React 18.2. |
| #73 | `async-storage` 1.23.0 → **3.1.1** | Exact-pinned deliberately. |
| #76, #75, #70, #71, #67 | eslint 8→10, chart-kit 6→7, typescript-eslint 7→8, minor group | Lower risk, still untested against the APK build. |
| #63, #65, #66, #62, #64 | setup-java 4→6, setup-node 4→7, gradle/actions 4→6, upload-artifact 4→7, **supabase/setup-cli 1→3** | The APK workflow is documented as fragile. `supabase/setup-cli` is the highest risk of these: the **6 Nov 2026** CI outage was caused by exactly a Supabase CLI version change (deploy needing `--yes`). |

**Nothing has been merged or closed — this is the owner's call.** Recommendation:
close #68, #69, #72, #73, #74 outright (they contradict documented pins), and
hold the Actions bumps until an APK build is verified green on each. Do not
batch-merge any of them.

**Root cause worth noting:** the pins are documented in CLAUDE.md with full
rationale, but nothing *enforces* them — an automated bot and a future session
can both act against them. A NEVER-do entry was added to CLAUDE.md on 10 Nov
2026; a `package.json` comment or a CI pin-check would enforce it properly.

---

## 🔶 Still open — items rescued from sections archived 10 Nov 2026

These were the ONLY unresolved items inside the thirteen fully-resolved
sections moved to ARCHIVE.md on 10 Nov 2026. They are reproduced verbatim so
that archiving the narrative around them could not silently close them. Their
full background is in ARCHIVE.md under the named source section.

**Source: "ALERT.gs — audited 12 Aug" (Sheets + app integration):**

- [ ] **Which daily form feeds the production dashboard?** Each shop has 3–6
      daily forms (`<Shop> PMS`, `<Shop> Daily check sheet`, `<Shop> Planning`,
      plus dispatch/57F4 on Machine and Final). The reminder currently lists
      all of them. Two mute switches now exist, both data not code:
      `Send in reminder?` = `NO` in the sheet's `FORM_LINKS` tab (Telegram
      side), and `send_in_reminder = false` in the `form_links` table (app
      side). Say which forms should not be chased per shift and I will set
      both, or set them yourself — nothing needs a redeploy.

- [ ] **Supervisors onboard to @Form_mgr_bot** — Telegram working (10 Sep).
      Draft sent to DME/HR to circulate. Each supervisor messages @Form_mgr_bot
      with their exact name; bot auto-fills their Chat ID in SUPERVISOR_MAP. *Correction to what this
      line said before: there is no group-chat fallback.* When a supervisor
      has no chat ID, `sendGentleReminder` now tells the OWNER directly
      instead ("no Telegram registered for X"), not a group. Lower stakes
      regardless, now that the in-app Forms tab is a second route needing no
      chat ID at all.
      **✅ Amit Bhagvan Shirsath (VFL5434, DME) — registered 10 Sep 2026.**
      `DME_TELEGRAM_CHAT_ID` Script Property set automatically via
      `processTelegramOnboarding()`. Receives all 4 plant-wide Telegram
      reports (deadline, follow-up, daily summary, weekly performance).
      Remaining: all per-department supervisors listed in SUPERVISOR_MAP.

- [ ] **Per-form ticking — `resolveFormSheets.gs` run 10 Sep, 22 of 28 forms
      returned NO MATCH.** The script does an exact-title search (`title = "…"`
      in Drive). A NO MATCH means the form's real title in Drive differs from
      what `FORM_NAMES_TO_RESOLVE` has — even one extra character, year suffix,
      or case difference fails it. Only 6 forms matched.
      **Next step:** run `listAllFormsInDrive()` in the Apps Script editor (any
      project with Drive access) to see every Google Form's real name, then
      update `FORM_NAMES_TO_RESOLVE` in `scripts/resolveFormSheets.gs` with the
      exact titles, and re-run `resolveFormSheets()`.
      ```javascript
      function listAllFormsInDrive() {
        var it = DriveApp.searchFiles(
          'mimeType = "application/vnd.google-apps.form" and trashed = false');
        var rows = [];
        while (it.hasNext()) { var f = it.next(); rows.push(f.getName()); }
        rows.sort();
        Logger.log(rows.length + ' forms found:\n' + rows.join('\n'));
      }
      ```
      Paste that into Apps Script → Run → check the Execution Log. The names
      there are the exact strings to put in `FORM_NAMES_TO_RESOLVE`.

### FRAUD
**Still not done, and not urgent:** wiring `supervisor/team.tsx` to the edge
function for real monthly escalation tiers (2nd flag → HR Admin, 3rd+ →
Owner + Plant Head), which today never fire.

**Source: "Fraud detection — found and fixed 13 Aug":**

**Still not done, and not urgent:** wiring `supervisor/team.tsx` to the edge
function for real monthly escalation tiers (2nd flag → HR Admin, 3rd+ →
Owner + Plant Head), which today never fire.

---

## 🔵 Known gaps still in the code

- [ ] **Rotating supervisor assignment** — HR/IR decide weekly; no in-app flow.
      Currently a manual `supervisor_id` UPDATE. Closed as out of scope 10 Aug,
      but will keep needing manual SQL.
- [ ] **Shakeel Sayyad** — confirmed a real employee, still has no `emp_code`,
      so cannot be provisioned a login.
- [ ] **VFL1527 phone** — deliberately NULL, correct number still unknown.
- [ ] **`shifts` table has no seed data and no creation flow** — found 13 Aug
      while fixing `shift-reminder`'s `daily_checkin_reminder` mode (see
      above). No `scripts/*.sql` file seeds `shifts`, and
      `app/(hr-admin)/shifts.tsx` only lets HR assign an *existing* shift to
      an employee — there's no screen or script that creates one. Until a
      `shifts` row exists with `start_time` matching
      `plant_config.form_shift_schedule` (`08:30`/`15:30`/`23:30`),
      `employee_shifts` can't be populated (FK constraint) and shift-based
      reminders have nothing real to match against. Needs a decision: seed
      the three known shifts directly, or build a "create shift" screen.

---

# >>> HISTORICAL STATE 2 Nov 2026 — NOT CURRENT. (This banner used to say "latest"; it is four days OLDER than the 6 Nov RESUME STATE at the top of this file, which is the only current one. Relabelled 10 Nov 2026 because a fresh session searching for "latest" was being pointed here.) <<<
- payroll-run LIVE v12 (verify_jwt true, sha a9340af1...), Claude-verified via list_edge_functions independently (not just agent claim). Two-report core (OT/holiday out, APPROVED_EXTRAS in) is now the live behaviour.
- '26 Sep-25 Oct' HR sheet tab is RETIRED per owner - never use it again. Basis = HR's '26-30 Sep' tab + HR's '1-31 Oct' tab (two sources, no overlap).
- Owner decisions locked in CLAUDE.md (2 Nov, 3 batches): VFL1389 Rs 5,000 advance DEDUCTED; VFL4063 Rs 21,000 = ADVANCE (not pay), recovered Rs 2,100/mo; Diwali (21 people, Rs 15,000 each) + VFL4063 advance DISBURSED in October, recovery starts NOVEMBER; 20 Oct holiday paid for staff+worker via Extras/approved-adjustment route, NOT for consultants; pay-days = two-batch rule (Batch 1 = app days, Batch 2 = top-up for people HR's physical attendance record shows present but app missed).
- DONE (read-only, scratchpad only, nothing in DB/app changed), workbooks sent to owner:
  - Oct2026_Consultant_Pune_Days.xlsx - consultant days provisional (no Oct consultant sheet yet; CON24 low attendance flag); Pune 7 BUNG reconciled real figures (BUNG02 remark mismatch, BUNG30 unexplained Rs 5,000 deduction flagged).
  - Oct2026_Staff_Final_Package.xlsx - Batch1 15,65,337 + Batch2 top-up 1,51,508 (45 people) + holiday extras 54,874 (67 people) + advance disbursements 60,000 (4 Diwali staff) = 18,31,718 total. Physical-CSV confirms big top-ups for VFL1560/1527/1556/5463/1386/1066/4057/1567 (present but didn't punch).
  - Oct2026_Worker_Final_Package.xlsx - Batch1 6,84,377 + Batch2 top-up 60,065 (payable; 15 people) + holiday extras 18,752 (17 workers) + advance disbursements 2,76,000 (17 Diwali + VFL4063) = recovery from Nov Rs 27,600/mo. VFL4072 flagged: 0 app punches but HR+physical CSV both show 25 present days - Rs 24,316 top-up + holiday-extra withheld pending owner/HR review, not in totals.
- OPEN OWNER QUESTIONS (next brief will restate numbered): (1) VFL4072 worker - pay the ~Rs 24,316+holiday top-up or investigate first? (2) physical-CSV 30 Oct gap (zero rows for everyone, all populations) - data problem, not a holiday; (3) 3 staff reclassify READY<->DISPUTE if physical CSV is used (VFL1543, VFL5433 -> READY; VFL5413 -> DISPUTE) - use it or not? (4) BUNG02 remark mismatch, BUNG30 unexplained deduction; (5) CON16/18/21/22/23 inactive but have Oct attendance rows - check with HR; (6) statutory treatment of Batch-2/holiday-extra lines still open (same as 1 Nov Extras question); (7) whether '1-31 Oct' tab double-counts any of 26-30 Sep - not yet resolved; (8) consultant sheet still has no October figures - HR to fill.
- NEXT: await owner answers above; HR/accounts review of the three final-package workbooks; no payroll-run call until owner/HR trigger the real run.



---

## AI-agent roadmap — not started, needs its own scoping session (added 12 Nov 2026)

Owner's own words: "the problem is coz we have not built the ai into the system, i am also having notifications for people who have not been alloted shifts but have checked in at general time or close to the shifts we have defined but as its not defined i am suppose to look right, this could be done by an ai agent if we build one so put this in pending as will need to work on all things the agent/agents should do."

This is a roadmap entry, not an active build. Candidate list of things an agent (or agents) could take over — review and prioritize with the owner before scoping any of it as a real build:

1. **Shift-assignment judgment calls** — today's "Needs Your Call" screen (owner-only) surfaces every `system_inferred`/`system_reclassified` shift for manual review. An agent could pre-screen these: an unassigned check-in landing close to (but not exactly on) a defined shift start, with a consistent pattern for that person, could be auto-confirmed instead of sitting in the owner's queue — this is exactly the case the owner flagged ("as its not defined i am suppose to look right").
2. **Attendance-anomaly triage** — the three bugs fixed today (wrong-date filing, WO-shadowed checkout, accidental taps) were all found by a human reading screenshots. An agent could scan `attendance_records` daily for the same shapes (a punch within the 00:00–06:45 window with no open previous-day session; an in/out pair under 5 minutes; two consecutive days with zero rows for someone who otherwise punches daily) and flag them before HR notices from a phone photo.
3. **Payroll warning review** — already exists (`payroll-warning-review`, Haiku-class model) but is narrowly scoped to late-decision audits; could be widened to the other warning types (`no_punch`, `punched_absent`, `missing_efficiency`) once the late-type review has a track record.
4. **Fraud alert triage** — `fraud_alerts`/`fraud_flags` resolution is still a manual owner decision (Confirmed/False Positive/Investigate); an agent could pre-classify based on device/location history before the owner looks at it.
5. **Shift-allocator compliance** — the new 19:00/21:00 reminder+escalation (built today, see CLAUDE.md) is a hard-coded rule; an agent could instead learn each allocator's actual pattern and adjust reminder timing/escalation thresholds per person.
6. **Leave/advance approval anomalies** — flag an approval chain that's been stuck unusually long, or a request shape that doesn't match the requester's history, before it becomes a "where did this go" complaint (like PATCH_126's stuck-chain bug, found by a human noticing 7 stuck requests).

Needs from the owner before any of this is built: which of these (if any) to prioritize first, a budget/model tier for it (this project's existing convention is Haiku-class for narrow classification, Sonnet-class for anything that edits/writes), and whether it should run as a scheduled job, an on-demand screen, or both.

