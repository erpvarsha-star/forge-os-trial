/**
 * Forge OS — Delta-only correction-run math (pure, testable; no I/O).
 *
 * Used by supabase/functions/payroll-run/index.ts's 'calculate' action when a draft run
 * has `pays_delta_only` true (PATCH_138, 17 Nov 2026). See that function's `buildRunInputs()`
 * comment for the full story: a correction run exists to top up employees who were
 * underpaid in a parent run (e.g. because of the attendance-pagination bug PATCH_138 also
 * fixes) without double-paying anyone who was already paid correctly, and without touching
 * the parent run's own (already-finalized) items.
 */
export interface DeltaCorrectionResult {
  /** Whether a pay_run_item should be written at all for this employee in the correction run. */
  write: boolean;
  /** The net_pay value to write — the full amount if they were never paid before, the
   *  shortfall only if they already have an item in a prior run of the period. */
  netPay: number;
  /** Set only when the employee had a prior payment and the correction tops them up
   *  (null when they were missed entirely, or when nothing is owed). */
  correctionOf: { parentRunId: string; alreadyPaid: number; correctTotal: number; delta: number } | null;
}

/**
 * `correctTotal` is the employee's correct net pay, recomputed from complete feeds.
 * `alreadyPaid` is the sum of net_pay already paid to them across every prior
 * non-cancelled run of the same pay period (0 if they were missed entirely there).
 */
export function resolveDeltaCorrection(
  parentRunId: string, correctTotal: number, alreadyPaid: number,
): DeltaCorrectionResult {
  if (!(alreadyPaid > 0)) {
    // Missed entirely in the parent run(s) — pay in full, exactly like a plain top-up.
    return { write: true, netPay: correctTotal, correctionOf: null };
  }
  const delta = Math.round((correctTotal - alreadyPaid) * 100) / 100;
  if (delta <= 0) {
    // Already correctly paid (or overpaid) — nothing owed; write no item for them.
    return { write: false, netPay: 0, correctionOf: null };
  }
  return { write: true, netPay: delta, correctionOf: { parentRunId, alreadyPaid, correctTotal, delta } };
}
