// Pay-run warnings (function-local, pure — no I/O). NOT vendored from lib/payroll.
// Generated at pre-check time (action 'generate_warnings', and again at the start of 'calculate'),
// BEFORE any pay_run_item is written. HR must waive/deduct every row, and the AI review must have
// looked at every decided row, before the run may be calculated (pay_run_ready_to_calculate).
//
// LATE RULE (owner, decided): per employee per calendar month, rows with late_minutes > 0 in date order.
//   late_minutes <= 30 : "free" late; the first 3 per month are free, the 4th and later are flagged.
//   late_minutes  > 30 : EVERY one is flagged (even the first) and does NOT consume the free quota.
// One 'late_excess' warning per flagged late date.

export type WarningType = 'late_excess' | 'no_punch' | 'punched_absent' | 'missing_efficiency';

export interface AttendanceRow {
  employee_id: string; date: string; status: string; check_in_time: string | null;
  late_minutes?: number | null; late_reason?: string | null;
}
export interface EmployeeRow { id: string; emp_code: string; category?: string | null; work_location?: string | null }
export interface WarningInput { empCode: string; category: string; efficiencyPct?: number | null }
export interface RunWarning { employee_code: string; warning_type: WarningType; detail: Record<string, unknown> }

export const FREE_LATES_PER_MONTH = 3;             // free lates (each <= LATE_FREE_MAX_MINUTES)
export const LATE_FREE_MAX_MINUTES = 30;           // a late longer than this is always flagged
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
  const lates = new Map<string, AttendanceRow[]>();
  const noPunch = new Map<string, string[]>();
  const punchedAbsent = new Map<string, string[]>();

  for (const a of args.attendance) {
    const e = byId.get(a.employee_id);
    if (!e || !inRun.has(e.emp_code)) continue;
    if (Number(a.late_minutes ?? 0) > 0) {
      (lates.get(e.emp_code) ?? lates.set(e.emp_code, []).get(e.emp_code)!).push(a);
    }
    if (PRESENT_TYPES.has(a.status) && !a.check_in_time && !isPune(e)) {
      (noPunch.get(e.emp_code) ?? noPunch.set(e.emp_code, []).get(e.emp_code)!).push(a.date);
    }
    if (a.status === 'A' && a.check_in_time) {
      (punchedAbsent.get(e.emp_code) ?? punchedAbsent.set(e.emp_code, []).get(e.emp_code)!).push(a.date);
    }
  }

  const out: RunWarning[] = [];
  for (const [code, rows] of lates) {
    rows.sort((x, y) => x.date.localeCompare(y.date));
    let freeUsed = 0;
    for (const r of rows) {
      const mins = Number(r.late_minutes);
      const base = { date: r.date, late_minutes: mins, late_reason: r.late_reason ?? null };
      if (mins > LATE_FREE_MAX_MINUTES) {
        out.push({ employee_code: code, warning_type: 'late_excess', detail: { ...base, kind: 'over_30' } });
      } else {
        freeUsed++;
        if (freeUsed > FREE_LATES_PER_MONTH) {
          out.push({ employee_code: code, warning_type: 'late_excess',
            detail: { ...base, kind: 'over_free_quota', nth_free_late: freeUsed } });
        }
      }
    }
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
    a.employee_code.localeCompare(b.employee_code) || a.warning_type.localeCompare(b.warning_type) ||
    String(a.detail.date ?? '').localeCompare(String(b.detail.date ?? '')));
}

export function countByType(rows: RunWarning[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const r of rows) c[r.warning_type] = (c[r.warning_type] ?? 0) + 1;
  return c;
}

// ---- idempotent sync (pure part) -------------------------------------------------------------
export interface ExistingWarning { id: string; employee_code: string; warning_type: string; detail: any; decision: string }

/** Identity of a warning: dated types (late_excess) = code+type+date; undated = code+type. */
export function warningKey(w: { employee_code: string; warning_type: string; detail?: any }): string {
  const date = w.warning_type === 'late_excess' ? String(w.detail?.date ?? '') : '';
  return `${w.employee_code}|${w.warning_type}|${date}`;
}

/**
 * Insert desired rows that don't exist yet; delete only still-'pending' rows that no longer apply;
 * never touch rows already waived/deduct (their decisions and AI reviews are preserved).
 */
export function diffWarnings(existing: ExistingWarning[], desired: RunWarning[]):
  { toInsert: RunWarning[]; toDeleteIds: string[] } {
  const have = new Set(existing.map(warningKey));
  const want = new Set(desired.map(warningKey));
  return {
    toInsert: desired.filter((d) => !have.has(warningKey(d))),
    toDeleteIds: existing.filter((e) => e.decision === 'pending' && !want.has(warningKey(e))).map((e) => e.id),
  };
}
