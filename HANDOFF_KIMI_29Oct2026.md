# Forge OS — Kimi Code Handoff
**Date:** 29 October 2026 · **Author:** Kimi Code (code-side assistant, session of 27–29 Oct)
**Audience:** owner (Yash), the DB-side assistant ("Kimi"), Claude sessions, any future agent
**Redaction:** codes and structure only; no names, no pay figures ≥ ₹1,000 (public repo rule).

---

## 1. The goal and where it stands

**Active goal (owner-approved wording):** make Forge OS the HRMS + payroll system of record for VFPL — close the parallel Google Sheets for **salary generation + leave management**, pull all FY2026-27 payroll + leave data into Supabase, prove it with the **October 2026 run fully in-app**.

**Completion contract (four conditions):**
1. Every P0 row of `SHEETS_RETIREMENT.md` reaches: in-app replacement built → HR/owner confirm real use → sheet writes stopped → owner-confirmed.
2. October 2026 run created → warnings → HR decisions → AI review → calculate → arrears 26–30 Sep → approve → finalize (advance recoveries fire) → exports → payslip notifications, with zero sheet parallel run.
3. FY2026-27 pull-in audit lists zero remaining sheet-only gaps (payroll+leave scope).
4. Quality gate green on the final tree: engine 58/0, feedsync 0-failed, tsc exactly 7, i18n clean; one task = one branch = one PR; nothing to main directly.

**Scope bands (owner 28 Oct):** P0 = salary + leave (12 checklist rows). Operations/production sheets (ops dashboard, energy, consumables, form registry, shift master) are **parked to Goal 2** (the KPI/performance goal — the one that depends on operations + reporting). **Goal 2 is defined and queued** but not started; it starts when Goal 1 completes.

**Status: IN PROGRESS, not complete.** Payslips Apr–Sep are live in-app; October is app-only (no sheet has an Oct tab); the run itself executes 1–5 Nov per the runbook in §7.

---

## 2. What I read and confirmed (the verification base)

**Repo (full reads):** `CLAUDE.md` (2,689 lines), `PENDING.md` (1,741 lines), `AGENTS.md`, all of `lib/payroll/*` (engine, types, feedSync, engineConfig, extraEarnings, lifecycle, stateMachine, client, latePolicy), `supabase/functions/payroll-run/index.ts` + function-local libs (warnings, decideWarning, appNotify), vendored-copy diffs (clean — header + `.ts` specifiers only), `exportCsv.ts`, the HR payroll screens, `payroll-feeds.tsx`, and the full table inventory.

**Sheets (owner-provided `.xlsx` exports in `D:\kimi\sheets-audit\`, parsed by three delegated read passes, key figures re-verified by me):** all 17 files inventoried tab-by-tab. Decisive findings:
- **"VFL HR OS 2026 27" and "VFPL Operations Dashboard 2026-27" are two different workbooks.** HR OS is the owner's consolidation layer and **agreed fallback** — a complete parallel payroll schema (387-row employee master, 329-row statutory table, 3.7k OT rows, 3.7k-row daily register), form-fed (attendance VFL/Pune daily+monthly, OT, canteen, efficiency), covering only Sep–Oct 2026 (its own MIN_PERIOD is 2026-09). It retires **last**.
- **Leave Application 2026** = the live leave path: 659 FY27 application rows incl. **OD 14 / C-off 9 (verified)**; single-admin approval with **granted-days override**; half-day flags; 0.5-day granularity. Leave Databases Staff/PW hold allocation + monthly availed (Jan–Dec columns).
- **No October tabs exist anywhere** — October is app-only, intact.
- New vs the known list: Salary Slip Generator (AutoCrat, **actively used**), Waluj Employee Master Data (DOJ/designation), Master Leave Computation 2024 (archive-only), Medicine form + Contractual Operators (parked).

**Live Supabase (read-only probes; service key derived from owner's PAT, never printed; SELECT/HEAD only):** all 78 tables enumerated with row counts/freshness; §A pre-run checks green; gaps confirmed live (leave 5 rows vs 659; designation/DOJ columns absent; 14 recent structure rows missing bank fields; 106/116 structures have UAN-or-PAN); payslip visibility verified (24 archived runs incl. 4 September population runs). PATCH_112 live state and payroll-run v9 (401 unauth) re-verified 29 Oct.

**Cross-assistant verification (29 Oct):** the other assistant ("Claude") applied PATCH_112 and deployed payroll-run v9; its review found two real defects in my PATCH_111/113 — I independently verified every claim (live probes + diff review) and merged its corrections (PR #38).

---

## 3. What I built, and why

All work is on branch `claude/forge-os-backend-setup-7woj4t` (merged via squash PRs; nothing to main). **Why these builds:** the owner asked for per-category pay runs (so a complete category can be paid without waiting for others) and the in-app leave system (form + consumption + approval checklist per the sheet).

| Build | PR | What | Why |
|---|---|---|---|
| Goal-1 artifacts | #32 | `SHEETS_RETIREMENT.md` (19-row checklist, scope bands, owner decisions, P0 code findings), `scripts/FY2026_27_GAP_AUDIT.md` (verified results), `scripts/OCT2026_RUN_VERIFICATION.sql` (stage-by-stage Oct run verification) | the goal's working instruments; provable finish line |
| PATCH_111 | #36 + fixes in #38 | bank/UAN/PAN staging import (14 structure rows missing bank fields would have blanked the Oct bank-file export) | found by read-only verification; dry-run proved the self-backfill idea would fill nothing, so source = HR OS statutory master |
| Per-category pay runs | #34 | `pay_runs.population` (NULL = all) + `payroll-run` filter after feed assembly, before the frozen engine + HR selector + 13 tests | owner's directive; enables BUNG release ~2 Nov independent of feeds |
| Leave system | #35 | OD/C-off forms with evidence fields, half-day chips, 0.5-day steps, warn-not-block balance check; idempotent `consume_leave_for_request` RPC with granted-days override; per-stage approval checklist | reproduces the sheet's process in-app; engine untouched |
| Patch corrections | #38 | PATCH_111: staging RLS + revoke + comma-FROM UPDATE (original errored 42P01). PATCH_113: drop 3-arg `review_leave_request` before the 4-arg create (else PGRST203 ambiguity breaks old-app approvals) | the other assistant's review, verified and merged by me |

**Gate on the merged tree (re-run by me, not the builders):** engine 58/0 · feedsync 51/0 · category 13/0 · leave-form 21/0 · warnings 35/0 · decide-warning 26/0 · tsc exactly 7 (baseline) · i18n clean (EN + Devanagari HI).

---

## 4. Owner decisions recorded this engagement (all in `SHEETS_RETIREMENT.md`)

1. **Scope:** close salary generation + leave management first; ops/production sheets parked to Goal 2.
2. **BUNG active = 7** (rule: paid in Aug + Sep; master's 19 Active flags are stale; the other 12 not investigated, per don't-dig-into-left-people).
3. **Leave cycle = calendar year:** unused leave **encashed 31 Dec 2026** (pays via a one-month `recurring_adjustments` earning — no engine change); fresh allotment **Jan 2027**.
4. **Leave window for import: Jan 2026 → today; staff + workers only** (consultants/BUNG have no leave); balance + utilization + applications only; **no payment transactions**; **sheet-vs-sheet mismatches are HIGHLIGHTED, never auto-resolved**.
5. **Payslip delivery:** app generates the payslip; print → stamp → bank stays the physical process.
6. **October feeds (canteen/society/efficiency/BUNG02-06): entered in-app**, arriving by 5 Nov.
7. **BUNG early release 2 Nov** via the PUNE_STAFF category run.
8. **No iframe for P0 forms** (WebView bridge acceptable only for parked forms); **stay on Netlify** (static hosting only, not middleware; no Vercel).
9. **Access mode: read-only verification** — I never write to Supabase or deploy functions; all DB changes ship as human-applied `scripts/PATCH_*.sql`.
10. **Standing build rules:** ready-to-deploy PRs; nothing breaks (dry-runs + independent verification + full gate); EN/HI everywhere; More-tab placement with `href: null`; doubts reported numbered; **build once** (no duplicates).

---

## 5. Live vs prepared (deployment state, 29 Oct)

**LIVE (verified):** PATCH_112 (`pay_runs.population`, 24 historical runs NULL) · `payroll-run` v9, `verify_jwt` true (per-category filter active; population runs create-able) · payslips Apr–Sep visible to all employees.

**PREPARED, NOT APPLIED (human steps, order matters):**
1. `PATCH_111` (corrected) — needs the private values file at `D:\kimi\sheets-audit\_patch111_values.sql` (on the owner's machine only, never in git); owner pastes STEP 2.
2. `PATCH_113` (corrected) — **blocked on one owner decision: the comp-off ledger draw rule** (§8). Recommendation: oldest-unexpired-unused rows first, 1 row = 1 whole day; half-day C-off blocked in v1 (ledger has no quantity column); shortfall allowed with warning, paid per grant.
3. **Keep the Build Android APK workflow DISABLED until PATCH_113 is applied** — the merged leave UI calls the new RPC, so the next APK would break leave approvals. apk-106 (published) predates the leave code and is fine.

---

## 6. Known gaps / findings not yet closed

- **Leave data not in app** (5 rows vs 659) → the leave-import build (queued; spec locked in §4 items 3–4; produces the per-person balance table + gaps report + review-only SQL).
- **DOJ/designation columns absent** → additive import from HR OS employee master (unblocks payslip headers).
- **UAN/PAN partial** (10 active rows) → folded into PATCH_111.
- **OD/C-off paid treatment** — the payroll feed doesn't count them as paid days; real rows exist (14/9). Decision rides with the comp-off ruling.
- **Bank-details maintenance path** — no in-app screen; owner decision: small owner/hr_admin screen vs dashboard edits.
- **Shift-time conflict** — sheet shift master (08:30/60-min grace) vs app shifts (07:00/15-min, PATCH_38); owner must confirm app times before the sheet freezes.
- **Salary-sheet CSV layout** — generic union-of-keys, not a workbook mirror; owner acceptance pending.
- **Statutory formats** unvalidated against EPFO/ESIC — CA review before filing.
- **HR advances pending** (VFL5324, VFL1556 + "10000 months" typo) — HR action before finalize.
- **public_holidays table empty** — enter if used for Oct (owner rule: public holidays = clear holidays).

---

## 7. Process flow from here (November runbook)

**1 Nov:** Kajal enters 31 Oct attendance + 1 Nov OT (clerk screen) → HR creates the **PUNE_STAFF** run (new selector) → calculate → warnings pre-check → HR decides → AI review → BUNG verified (Kajal → HR → accounts) → **finalize** (releases BUNG for 2 Nov; BUNG09 recovery fires) → export.
**≤5 Nov:** plant head efficiency % + HR canteen/society/adjustments (in-app) → **STAFF / PERMANENT_WORKER / CONSULTANT** runs → calculate → warnings → AI review → arrears 26–30 Sep → approve → finalize → exports + statutory + payslip notifications.
**Verification:** I run `scripts/OCT2026_RUN_VERIFICATION.sql` stage-by-stage (owner/HR execute; I prepare and verify — I never trigger payroll).
**December:** encashment runbook (one-month recurring earnings per eligible employee; encashable types/rate confirmed with owner; reconcile against the sheet's "Worker leave Encashment" tab). **January 2027:** fresh allotment.

**Leave cycle going forward (post-PATCH_113):** apply (form, balance warn-not-block) → staged chain (frozen PATCH_53 design + per-stage checklist: approver, decision, granted-days override, mandatory remarks on reject/day-change) → final approval auto-consumes balances (idempotent; C-off draws the ledger) → approved leave flows to payroll automatically → utilization ledger = approved requests.

---

## 8. Development design (how further work is built)

- **Boundaries (frozen):** engine math untouchable (adjustments via feeds); additive-only DB; redacted repo; APK builds owner-gated; nothing to main; Supabase writes only by humans.
- **Safety protocol (owner-mandated):** verify from ≥2 sources → read-only dry-run (PATCH_111's dry-run caught a wrong approach before it shipped) → review-only PR → transaction + preview + rollback in SQL → nothing auto-applied → full gate on every branch.
- **Delegation pattern (owner instruction):** briefed subagents do reads/builds, report back; **I independently verify** (diffs, live probes, re-run gates) before reporting — this caught the two-assistant worktree collision and the patch defects this cycle.
- **Testing:** the gate suites (engine 58, feedsync 51, warnings, decide-warning, statutory, payslip, amount-in-words, category 13, leave-form 21) are the arbiter; new logic ships with new tests.
- **i18n & navigation:** EN+HI for every string; new screens land in More with `href: null` entries and badges where decisions pend.
- **Cross-assistant coordination:** repo base is shared with the other assistant; verify-before-merge is mutual; state notes go in `scripts/FY2026_27_GAP_AUDIT.md` (latest: 29 Oct section).

---

## 9. Open decisions for the owner (numbered)

1. **Comp-off ledger draw rule** (blocks PATCH_113) — recommendation in §5.2.
2. **OD/C-off paid treatment in the payroll feed** (with #1).
3. **Leave-data review:** say "pull the leave review pack" for the read-only per-person comparison before balance treatment is finalized.
4. **Bank-details maintenance path** — in-app screen vs dashboard edits.
5. **Shift-time conflict** — confirm app shift times (07:00/15-min grace) are the real ones.
6. **Salary-sheet CSV layout** — accept generic layout or request per-category mirrors.
7. **Half-day C-off** allowed or whole-days-only in v1.
8. Housekeeping: apk-106 install status · HR advances approval · revoke the Anthropic key pasted in the other chat (re-enter via dashboard only).

## 10. Access & hygiene

- **GitHub:** fine-grained PAT `kimi-code-forgeos` (repo `forge-os-trial` only; contents+PR), stored in this machine's git origin; expires per its 90-day setting. **Rotate the Supabase PAT** (`sbp_fcc9…`) and the GitHub PAT after the October run — both have appeared in chat. The service-role key derived during verification lived only in this machine's temp dir; revoke concern is low but rotation of the above two is due.
- **Supabase:** project `odfwtdpvpfzdrznvurru` (Free tier, owner decision to stay).
- **Local artifacts:** `D:\kimi\sheets-audit\` (xlsx exports, audit JSONs, `_patch111_values.sql` — back this up; it is the only copy of the bank import values).

## 11. Queued work (after the October run)

1. Leave data import (reconciliation + gaps report + review-only SQL) — on owner's word.
2. DOJ/designation + remaining UAN/PAN import files.
3. PATCH_113 apply (after decision #1) → then re-enable APK workflow + build → Kajal device test → leave flow end-to-end on device.
4. Sheet-retirement confirmations per checklist row (owner/HR sign-offs) → HR OS retires **last**.
5. **Goal 2 (KPI/performance monitor):** role-differentiated KPIs fed by in-app daily production-report entry, weekly reports, monthly reconciliation — parked scope incl. ops dashboard, energy/consumables, gate pass + medical (process flow to be explained by owner before building).
