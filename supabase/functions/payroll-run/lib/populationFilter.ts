/**
 * Per-category (population) pay-run filter (PATCH_112).
 * Applied AFTER feed assembly (assemblePayrollInputs) and BEFORE the engine loop,
 * so warnings sync, calculateOne, and the top-up skip-set all see only the
 * run's population. Engine math is untouched.
 *
 * `input.category` is already the mapped PayCategory (mapCategory in feedSync.ts
 * ran at assembly time), so a plain equality filter is the exact equivalent of
 * mapCategory(employee) === population.
 */

export type PayPopulation = 'STAFF' | 'PERMANENT_WORKER' | 'CONSULTANT' | 'PUNE_STAFF';

export const PAY_POPULATIONS: readonly PayPopulation[] = ['STAFF', 'PERMANENT_WORKER', 'CONSULTANT', 'PUNE_STAFF'];

export function isPayPopulation(v: unknown): v is PayPopulation {
  return typeof v === 'string' && (PAY_POPULATIONS as readonly string[]).includes(v);
}

/** NULL/undefined population = whole-population run: everything passes through. */
export function filterByPopulation<T extends { category: string }>(inputs: T[], population: string | null | undefined): T[] {
  if (population == null) return inputs;
  return inputs.filter((i) => i.category === population);
}
