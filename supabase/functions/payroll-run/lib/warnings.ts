// Pay-run warnings (function-local, pure — no I/O). NOT vendored from lib/payroll.
// One row per employee per warning type, written to pay_run_warnings by 'calculate'.
// HR must waive/deduct every pending row before a run can move calculated -> in_review.

export type WarningType = 'late_excess' | 'no_punch' | 'punched_absent' | 'missing_efficiency';

export interface AttendanceRow { employee_id: string; date: string; status: string; check_in_time: string | null }
export interface EmployeeRow { id: string; emp_code: string; category?: string | null; work_location?: string | null }
export interface WarningInput { empCode: string; category: string; efficiencyPct?: number | null }
export interface RunWarning { employee_code: string; warning_type: WarningType; detail: Record<string, unknown> }

export const LATE_DAYS_LIMIT = 3;                  // flagged when strictly more than this
const PRESENT_TYPES = new Set(['P', 'L', 'HL']);
const isPune = (e: EmployeeRow) => String(e.work_location ?? '').trim().toLowerCase() === 'pune';

/**
 * Only employees that appear in `inputs` (i.e. are actually being calculated in this run) get warnings.
 * Pune employees are excluded from 'no_punch' only (their attendance is HR-entered).
 * 'missing_efficiency' reuses feedSync's signal: PERMANENT_WORKER input with efficiencyPct === null.
 */
export function computeRunWarnings(args: {
  attendance: AttendanceRow[];
  employees: EmployeeRow[];
  inputs: WarningInput[];
}): RunWarning[] {
  const inRun = new Set(args.inputs.map((i) => i.empCode));
  const byId = new Map(args.employees.map((e) => [e.id, e]));
  const lateDays = new Map<string, number>();
  const noPunch = new Map<string, string[]>();
  const punchedAbsent = new Map<string, string[]>();

  for (const a of args.attendance) {
    const e = byId.get(a.employee_id);
    if (!e || !inRun.has(e.emp_code)) continue;
    if (a.status === 'L') lateDays.set(e.emp_code, (lateDays.get(e.emp_code) ?? 0) + 1);
    if (PRESENT_TYPES.has(a.status) && !a.check_in_time && !isPune(e)) {
      (noPunch.get(e.emp_code) ?? noPunch.set(e.emp_code, []).get(e.emp_code)!).push(a.date);
    }
    if (a.status === 'A' && a.check_in_time) {
      (punchedAbsent.get(e.emp_code) ?? punchedAbsent.set(e.emp_code, []).get(e.emp_code)!).push(a.date);
    }
  }

  const out: RunWarning[] = [];
  for (const [code, n] of lateDays) {
    if (n > LATE_DAYS_LIMIT) out.push({ employee_code: code, warning_type: 'late_excess', detail: { late_days: n } });
  }
  for (const [code, dates] of noPunch) {
    dates.sort();
    out.push({ employee_code: code, warning_type: 'no_punch', detail: { count: dates.length, dates } });
  }
  for (const [code, dates] of punchedAbsent) {
    dates.sort();
    out.push({ employee_code: code, warning_type: 'punched_absent', detail: { count: dates.length, dates } });
  }
  for (const i of args.inputs) {
    if (i.category === 'PERMANENT_WORKER' && i.efficiencyPct === null) {
      out.push({ employee_code: i.empCode, warning_type: 'missing_efficiency', detail: {} });
    }
  }
  return out.sort((a, b) =>
    a.employee_code.localeCompare(b.employee_code) || a.warning_type.localeCompare(b.warning_type));
}

export function countByType(rows: RunWarning[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const r of rows) c[r.warning_type] = (c[r.warning_type] ?? 0) + 1;
  return c;
}
