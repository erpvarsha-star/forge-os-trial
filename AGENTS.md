# AGENTS.md — House rules for any coding agent (Copilot, Kimi Code, human) in this repo

## Context
Forge OS is a LIVE plant app (React Native/Expo, bilingual EN/HI, 7 roles, PIN auth).
People on the shop floor use it daily. Breaking it is not acceptable.

## Absolute rules
1. **Never touch live Supabase.** No migrations are applied by agents. SQL changes go in
   `scripts/PATCH_XX_<name>_<date>.sql` as ADDITIVE-ONLY patches (no DROP, no DELETE of
   existing tables/columns, no rewrites). A human runs them manually after review.
2. **Never commit secrets.** No `.env`, no service-role keys, no tokens. Blanked
   placeholders only (`__SUPABASE_URL__`).
3. **Payroll math is frozen.** `lib/payroll/engine.ts` and `lib/payroll/types.ts` are a
   verified port of the HR OS sheet, proven against ACTUAL September 2026 payouts.
   Do not change calculation logic. If you think it's wrong, open an issue instead.
4. **Run the regression suite before every PR:**
   `npx tsx scripts/payroll-engine.sept2026.test.ts` — must print `0 failed`.
5. **One task = one branch = one PR** into `claude/payroll-lifecycle`. Never push to
   `main` or `claude/forge-os-backend-setup-7woj4t` directly.
6. **No new dependencies** without stating why in the PR description.
7. UI text must be bilingual (EN/HI) following existing screens' pattern.

## Decided business rules (do not relitigate)
- Payroll cycle: full calendar month. October 2026 = 1–31 Oct; 26–30 Sep 2026 paid as
  a one-time arrears adjustment line in the October run.
- Worker OT rate VDA basis: CURRENT rate (103 x working days). MASTER_SNAPSHOT mode
  exists only to reproduce legacy sheets in tests.
- Weekly off: Waluj plant = Friday; Pune office = Sunday. A worked weekly-off day is
  entered as PRESENT, with extra hours via OT.
- Working days are COMPUTED (`workingDaysInMonth`), never hand-entered.
- Pay run lifecycle is DB-enforced; finalized runs are immutable — corrections via
  adjustment runs only.
- Efficiency % (worker production allowance) is a MANUAL INPUT decided by the plant
  head per the worker agreement, based on forge-shop production efficiency. It is
  entered from the app (`payroll_efficiency_entries`, plant-wide or per-employee)
  and must be approved before a run can calculate. Do NOT auto-derive it from
  production or contract-labour data until a separate analysis of how HR OS
  computed it is done and signed off. (Decided 20 Oct 2026.)

## Definition of done for any payroll PR
- [ ] Regression suite passes (58 assertions)
- [ ] No modification to existing tables/screens unless the issue explicitly says so
- [ ] PR description states what was tested and what was NOT touched
