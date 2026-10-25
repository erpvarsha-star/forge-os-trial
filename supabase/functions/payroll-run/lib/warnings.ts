// Pay-run warnings (function-local, pure — no I/O). NOT vendored from lib/payroll.
// Generated at pre-check time (action 'generate_warnings', and again at the start of 'calculate'),
// BEFORE any pay_run_item is written. HR must waive/deduct every row, and the AI review must have
// looked at every decided row, before the run may be calculated (pay_run_ready_to_calculate).
//
// LATE RULE (owner, final 24-25 Oct 2026):
//   late_minutes <= 30 : NOT late — never counted, never flagged, never deducted.
//   late_minutes  > 30 : flagged EVERY occurrence. Per employee per month the >30 lates are numbered 1,2,3...
//                        in date order (nth_over_30); a deduction may apply only from the 4th (deduct_eligible).
// One 'late_excess' warning per such late date.

export type WarningType = 'late_excess' | 'no_punch' | 'punched_absent' | 'missing_efficiency';

export interface AttendanceRow {
  employee_id: string; date: string; status: string; check_in_time: string | null;
  late_minutes?: number | null; late_reason?: string | null;
}
export interface EmployeeRow { id: string; emp_code: string; category?: string | null; work_location?: string | null }
export interface WarningInput { empCode: string; category: string; efficiencyPct?: number | null }
export interface RunWarning { employee_code: string; warning_type: WarningType; detail: Record<string, unknown> }

export const LATE_FREE_MAX_MINUTES = 30;           // late_minutes <= this is not a late at all
export const DEDUCT_FROM_NTH_LATE = 4;             // deduction applies from the 4th flagged (>30 min) late
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
    if (Number(a.late_minutes ?? 0) > LATE_FREE_MAX_MINUTES) {
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
    let nth = 0;
    for (const r of rows) {
      const mins = Number(r.late_minutes);
      nth++;
      out.push({ employee_code: code, warning_type: 'late_excess', detail: {
        date: r.date, late_minutes: mins, late_reason: r.late_reason ?? null,
        kind: 'over_30', nth_over_30: nth, deduct_eligible: nth >= DEDUCT_FROM_NTH_LATE } });
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
  { toInsert: RunWarning[]; toDeleteIds: string[]; toUpdate: { id: string; detail: Record<string, unknown> }[] } {
  const have = new Set(existing.map(warningKey));
  const wantByKey = new Map(desired.map((d) => [warningKey(d), d]));
  const toUpdate: { id: string; detail: Record<string, unknown> }[] = [];
  const toDeleteIds: string[] = [];
  for (const e of existing) {
    if (e.decision !== 'pending') continue;             // decided rows are never touched
    const d = wantByKey.get(warningKey(e));
    if (!d) { toDeleteIds.push(e.id); continue; }
    // Old-format late rows (kind over_free_quota / nth_free_late) are stale: refreshed to the v3 shape.
    if (e.warning_type === 'late_excess' && JSON.stringify(e.detail ?? {}) !== JSON.stringify(d.detail)) {
      toUpdate.push({ id: e.id, detail: d.detail });
    }
  }
  return { toInsert: desired.filter((d) => !have.has(warningKey(d))), toDeleteIds, toUpdate };
}
