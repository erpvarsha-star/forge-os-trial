// VENDORED COPY of lib/payroll/topupFilter.ts — do not edit here; edit the source and re-vendor.
/**
 * Forge OS — Top-up / correction-run input filtering (pure, testable; no I/O).
 * Used by supabase/functions/payroll-run/index.ts's `buildRunInputs()`.
 *
 * Plain top-up (`deltaOnly` false — unchanged since PATCH_89): an employee already present
 * in `paidEmployeeIds` is dropped entirely from the run's inputs — they were already paid in
 * full elsewhere in this pay period, and a plain top-up only pays someone who was missed.
 *
 * Delta-only CORRECTION run (`deltaOnly` true — PATCH_138, 17 Nov 2026): nobody is dropped.
 * Every employee stays in `inputs` so 'calculate' can recompute each one's correct total and
 * write only the shortfall for whoever was already paid (see resolveDeltaCorrection in
 * deltaCorrection.ts) — the already-paid employees are not filtered out here precisely
 * because the correction logic needs to see them.
 */
export function filterTopupInputs<T>(
  inputs: T[], keyOf: (t: T) => string, paidEmployeeIds: Set<string>, deltaOnly: boolean,
): { kept: T[]; skippedAlreadyPaid: number } {
  if (deltaOnly) return { kept: inputs, skippedAlreadyPaid: 0 };
  let skippedAlreadyPaid = 0;
  const kept = inputs.filter((i) => {
    const already = paidEmployeeIds.has(keyOf(i));
    if (already) skippedAlreadyPaid++;
    return !already;
  });
  return { kept, skippedAlreadyPaid };
}
