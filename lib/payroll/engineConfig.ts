/**
 * Forge OS — payroll engine config builder (pure, testable; no I/O).
 * Builds the EngineConfig the runner passes to calculateOne():
 *  - workerVdaRatePerDay: the month's HR-entered VDA per-day rate (earnings = rate x present days).
 *  - Worker OT basis (owner decision 27 Oct 2026): OT hourly = 2 x (basic + flat VDA master) / wd / 8,
 *    i.e. workerOtVdaBasis 'MASTER_SNAPSHOT' with workerMasterVdaSnapshot = the flat VDA master.
 *    payroll_monthly_rates has no column for the master, so it is derived from the picked
 *    employee_salary_structure.vda of the PERMANENT_WORKER employees in the run.
 * Engine math itself (engine.ts) is frozen and untouched.
 */
import { DEFAULT_ENGINE_CONFIG } from './types';
import type { EngineConfig } from './types';
import { pickSalary } from './feedSync';
import type { SalaryRow } from './feedSync';

export interface WorkerVdaMaster {
  value: number | null;      // most common positive vda among workers; null if none found
  warnings: string[];
}

/** Single common flat VDA master across the given worker employees' salary rows in force at asOf. */
export function deriveWorkerVdaMaster(workerEmployeeIds: string[], salaries: SalaryRow[], asOf: string): WorkerVdaMaster {
  const counts = new Map<number, number>();
  for (const id of workerEmployeeIds) {
    const v = Number(pickSalary(salaries, id, asOf)?.vda);
    if (Number.isFinite(v) && v > 0) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  if (counts.size === 0) {
    return { value: null, warnings: ['WORKER_VDA_MASTER_MISSING: no worker VDA master found; worker OT uses the current-rate basis'] };
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const warnings: string[] = [];
  if (counts.size > 1) {
    warnings.push(`WORKER_VDA_MASTER_NOT_UNIFORM: worker VDA masters differ (${ranked.map(([v, n]) => `${v} x${n}`).join(', ')}); using the most common (${ranked[0][0]})`);
  }
  return { value: ranked[0][0], warnings };
}

export interface BuiltEngineConfig { cfg: EngineConfig; warnings: string[] }

/** One place that builds the run's EngineConfig. vdaPerDay null/<=0 keeps the default rate. */
export function buildEngineConfig(opts: {
  vdaPerDay?: number | null;
  workerEmployeeIds: string[];
  salaries: SalaryRow[];
  asOf: string;
}): BuiltEngineConfig {
  const cfg: EngineConfig = { ...DEFAULT_ENGINE_CONFIG };
  if (opts.vdaPerDay != null && Number(opts.vdaPerDay) > 0) cfg.workerVdaRatePerDay = Number(opts.vdaPerDay);
  const master = deriveWorkerVdaMaster(opts.workerEmployeeIds, opts.salaries, opts.asOf);
  if (master.value != null) {
    cfg.workerOtVdaBasis = 'MASTER_SNAPSHOT';
    cfg.workerMasterVdaSnapshot = master.value;
  }
  return { cfg, warnings: master.warnings };
}
