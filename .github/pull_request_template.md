## Summary

<!-- One or two sentences: what this PR does and why. -->

## What changed

<!-- Bullet list of the actual changes (files/areas touched). -->

-

## Testing done

<!-- This project's own verification convention (see CLAUDE.md): tsc baseline,
     i18n check, and relevant scripts/*.test.ts counts. -->

- [ ] `npx tsc --noEmit` — error count: ____ (documented baseline: 7)
- [ ] `node scripts/check-i18n.mjs` — clean? yes / no
- [ ] Relevant `scripts/*.test.ts` run — pass/fail counts: ____

## Payroll / Supabase impact

- [ ] **Does this touch `pay_runs`, `payroll-run`, employee salary/bank data, or RLS policies?**
  If yes, describe the live-data risk and what was verified (role-impersonation checks, rolled-back test transactions, live row counts before/after, etc.):

  <!-- Answer here if checked above -->

## Screenshots (if UI)

<!-- Attach before/after screenshots for any screen-level change. -->

## Related issues

<!-- Link related issues/PRs, e.g. "Closes #123" -->
