/**
 * Forge OS — Feed sync core (pure, testable; no I/O).
 * Assembles PayrollInput[] for a pay period from raw Supabase rows.
 * The edge function wrapper (supabase/functions/payroll-feed-sync) only
 * fetches rows and calls assemblePayrollInputs().
 *
 * Source-of-truth policy (decided): HR/Pune admin DAILY ENTRY is the payroll
 * input; app check-in/check-out punches are the reconciliation layer.
 * This module therefore reads attendance from attendance_records as maintained
 * by the admin forms, and emits a ReconciliationRow[] comparing against punches.
 *
 * Live DB attendance_records.status codes (verified 2026-10-20): P, L, HL, WO
 *   P  = present (paid)
 *   L  = late (paid present day; surfaced as a warning for late-review policy)
 *   HL = half day (0.5 paid)
 *   WO = weekly off
 * Absence = NO ROW in attendance_records.
 * Word forms (present/half_day/...) kept for test & legacy compat.
 */
import { PayrollInput, PayCategory, SalaryMasters, workingDaysInMonth, WEEKLY_OFF_WEEKDAY } from './types';
import { isPayrollEligible, EmployeeStatus } from './lifecycle';

// ---- Raw row shapes (as they exist in live Supabase) ------------------------
export interface EmployeeRow {
  id: string; emp_code: string; name: string; category: string; // staff|worker|consultant (lowercase in DB)
  work_location: string | null;   // 'Aurangabad' (=Waluj) | 'Pune'
  gender: string | null; is_active: boolean; weekly_off_day: number | null;
}
export interface SalaryRow {
  employee_id: string; effective_from: string; is_active: boolean;
  basic: number | null; hra: number | null; conveyance: number | null; washing: number | null;
  education: number | null; heat_allow: number | null; vda: number | null; production_allow: number | null;
  medical: number | null; professional_development: number | null; communication: number | null;
  uniform: number | null; ctc_annual: number | null;
}
export interface AttendanceRow {
  employee_id: string; date: string; status: string; overtime_hours: number | null;
  check_in_time: string | null; check_out_time: string | null;
}
export interface LeaveRow { employee_id: string; type: string; start_date: string; end_date: string; days: number; status: string }
export interface AdvanceRow { employee_id: string; monthly_deduction: number | null; outstanding_balance: number | null; status: string }
export interface FeedAmountRow { employee_id: string; amount_inr?: number; total_recovery_inr?: number; approval_status: string }
export interface EfficiencyRow { employee_id: string | null; efficiency_pct: number; approval_status: string }
export interface AdjustmentRow { employee_id: string; adjustment_type: string; signed_amount_inr: number; approval_status: string }
export interface StatusEventRow { employee_id: string; status: EmployeeStatus; effective_from: string }

export interface FeedBundle {
  employees: EmployeeRow[];
  salaries: SalaryRow[];
  attendance: AttendanceRow[];      // admin-entered daily records for the period
  punches: AttendanceRow[];         // same table — rows with real check_in/out times
  leaves: LeaveRow[];               // approved only
  advances: AdvanceRow[];           // approved/active with monthly_deduction
  canteen: FeedAmountRow[];         // approved only (PATCH_91)
  society: FeedAmountRow[];         // approved only (PATCH_91)
  efficiency: EfficiencyRow[];      // approved only (PATCH_91); null employee_id = plant-wide
  adjustments?: AdjustmentRow[];    // PATCH_91; approved rows. Negative amounts are applied
                                    // as deductions.other; positive amounts (arrears /
                                    // incentive / encashment) are flagged as warnings until
                                    // the engine grows an adjustments input — engine math frozen.
  statusEvents: StatusEventRow[];   // employee_status_history
}

export interface ReconciliationRow {
  empCode: string; date: string;
  adminStatus: string;            // what the admin entry says
  punchIn: string | null; punchOut: string | null;
  mismatch: 'ABSENT_BUT_PUNCHED' | 'PRESENT_NO_PUNCH' | 'OT_MISMATCH' | null;
}

export interface AssembleResult {
  inputs: PayrollInput[];
  reconciliation: ReconciliationRow[];
  warnings: string[];             // feed-level issues, e.g. missing salary structure
  blockedEmployees: { empCode: string; reason: string }[];
}

/** employees.category/work_location → engine PayCategory. */
export function mapCategory(e: EmployeeRow): PayCategory {
  if (e.category === 'worker') return 'PERMANENT_WORKER';
  if (e.category === 'consultant') return 'CONSULTANT';
  if (e.work_location === 'Pune') return 'PUNE_STAFF';
  return 'STAFF';
}

function pickSalary(rows: SalaryRow[], employeeId: string, asOf: string): SalaryRow | null {
  const mine = rows
    .filter((r) => r.employee_id === employeeId && r.effective_from <= asOf)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  return mine[0] ?? null;
}

function mastersFrom(s: SalaryRow, cat: PayCategory): SalaryMasters {
  // STAFF: Basic is 40% of the fixed monthly gross (decided component rule), so gross = basic / 0.40.
  // ctc_annual/12 is NOT used for staff (it includes employer contributions). Null/0 basic -> undefined (held).
  const staffGross = s.basic ? s.basic / 0.40 : undefined;
  return {
    BASIC: s.basic ?? undefined, HRA: s.hra ?? undefined, CONVEYANCE: s.conveyance ?? undefined,
    WASHING: s.washing ?? undefined, EDUCATION: s.education ?? undefined,
    HEAT: s.heat_allow ?? undefined,
    FIXED_GROSS: cat === 'STAFF' ? staffGross : (s.ctc_annual ? s.ctc_annual / 12 : undefined),
  };
}

const num = (v: unknown) => (typeof v === 'number' && !isNaN(v) ? v : 0);

/**
 * Map one attendance status to paid days. Returns an object describing the
 * effect; unknown statuses count as nothing (absent = no row in live DB).
 * Live DB codes: P / L / HL / WO. Word forms kept for legacy & test compat.
 */
function statusEffect(st: string): { present?: number; weekOff?: number; ph?: number; el?: number; cl?: number; sl?: number; plo?: number; late?: boolean } {
  switch (st) {
    case 'p': case 'present': return { present: 1 };
    case 'l': case 'late': return { present: 1, late: true };
    case 'hl': case 'half_day': return { present: 0.5 };
    case 'wo': case 'week_off': case 'weekly_off': return { weekOff: 1 };
    case 'h': case 'ph': case 'holiday': return { ph: 1 };
    case 'el': return { el: 1 };
    case 'cl': return { cl: 1 };
    case 'sl': return { sl: 1 };
    case 'plo': case 'paid_layoff': return { plo: 1 };
    default: return {}; // 'a' / 'absent' / unknown → unpaid, no bucket
  }
}

export function assemblePayrollInputs(year: number, month: number, feeds: FeedBundle): AssembleResult {
  const mm = String(month).padStart(2, '0');
  const periodStart = `${year}-${mm}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const periodEnd = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;

  const inputs: PayrollInput[] = [];
  const warnings: string[] = [];
  const blockedEmployees: { empCode: string; reason: string }[] = [];
  const reconciliation: ReconciliationRow[] = [];

  for (const emp of feeds.employees) {
    if (!emp.is_active && !feeds.statusEvents.some((e) => e.employee_id === emp.id)) continue;
    const cat = mapCategory(emp);

    // Lifecycle eligibility (mid-month exits prorate; pre-period exits excluded)
    const events = feeds.statusEvents
      .filter((e) => e.employee_id === emp.id)
      .map((e) => ({ status: e.status, effectiveFrom: e.effective_from }));
    const elig = isPayrollEligible(events, periodStart, periodEnd);
    if (!elig.eligible) { blockedEmployees.push({ empCode: emp.emp_code, reason: elig.reason ?? 'ineligible' }); continue; }

    // Working days: workers → site weekly-off; staff/consultants → full calendar
    const weeklyOff = cat === 'PERMANENT_WORKER'
      ? (emp.weekly_off_day ?? (emp.work_location === 'Pune' ? WEEKLY_OFF_WEEKDAY.PUNE : WEEKLY_OFF_WEEKDAY.WALUJ))
      : null;
    const wd = workingDaysInMonth(year, month, weeklyOff);

    // Attendance aggregation (admin-entered statuses; live codes P/L/HL/WO)
    const att = feeds.attendance.filter((a) => a.employee_id === emp.id && a.date >= periodStart && a.date <= periodEnd);
    const day = { present: 0, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 };
    let otHours = 0;
    let lateDays = 0;
    for (const a of att) {
      const eff = statusEffect((a.status || '').toLowerCase());
      day.present += eff.present ?? 0;
      day.weekOff += eff.weekOff ?? 0;
      day.ph += eff.ph ?? 0;
      day.el += eff.el ?? 0; day.cl += eff.cl ?? 0; day.sl += eff.sl ?? 0; day.plo += eff.plo ?? 0;
      if (eff.late) lateDays++;
      otHours += num(a.overtime_hours);
    }
    if (lateDays > 0) {
      warnings.push(`${emp.emp_code}: ${lateDays} late day(s) counted as present — apply late-deduction policy separately`);
    }
    // Approved leave without an attendance row still counts:
    for (const l of feeds.leaves.filter((l) => l.employee_id === emp.id && l.status === 'approved'
      && l.start_date <= periodEnd && l.end_date >= periodStart)) {
      const t = (l.type || '').toLowerCase();
      const d = num(l.days);
      if (t.includes('earned') || t === 'el') day.el += d;
      else if (t.includes('casual') || t === 'cl') day.cl += d;
      else if (t.includes('sick') || t === 'sl') day.sl += d;
    }

    // Reconciliation: admin entry vs punches
    for (const a of att) {
      const punched = !!(a.check_in_time || a.check_out_time);
      const st = (a.status || '').toLowerCase();
      let mismatch: ReconciliationRow['mismatch'] = null;
      if ((st === 'a' || st === 'absent') && punched) mismatch = 'ABSENT_BUT_PUNCHED';
      else if ((st === 'p' || st === 'l' || st === 'hl' || st === 'present' || st === 'half_day') && !punched) mismatch = 'PRESENT_NO_PUNCH';
      if (mismatch) reconciliation.push({
        empCode: emp.emp_code, date: a.date, adminStatus: a.status,
        punchIn: a.check_in_time, punchOut: a.check_out_time, mismatch,
      });
    }

    // Money inputs
    const sal = pickSalary(feeds.salaries, emp.id, periodEnd);
    if (!sal) warnings.push(`${emp.emp_code}: no salary structure as of ${periodEnd} — will be held by engine`);
    const canteen = feeds.canteen.filter((c) => c.employee_id === emp.id).reduce((s, c) => s + num(c.amount_inr), 0);
    const society = feeds.society.filter((c) => c.employee_id === emp.id).reduce((s, c) => s + num(c.total_recovery_inr), 0);
    const advance = feeds.advances
      .filter((a) => a.employee_id === emp.id && a.status === 'approved')
      .reduce((s, a) => s + Math.min(num(a.monthly_deduction), num(a.outstanding_balance)), 0);
    // Adjustments (PATCH_91): approved negative amounts -> deductions.other.
    // Positive amounts (ARREARS / DISPATCH_INCENTIVE / OTHER_ALLOWANCE / ENCASHMENT)
    // have no engine input yet — warn loudly instead of silently dropping them.
    const adj = (feeds.adjustments ?? []).filter((a) => a.employee_id === emp.id && a.approval_status === 'approved');
    const otherDeduction = adj
      .filter((a) => num(a.signed_amount_inr) < 0)
      .reduce((s, a) => s + Math.abs(num(a.signed_amount_inr)), 0);
    const unappliedPositive = adj.filter((a) => num(a.signed_amount_inr) > 0);
    if (unappliedPositive.length) {
      warnings.push(`${emp.emp_code}: ${unappliedPositive.length} approved positive adjustment(s) (₹${
        unappliedPositive.reduce((s, a) => s + num(a.signed_amount_inr), 0)
      }) not applied — engine has no earnings-adjustment input yet`);
    }
    // Efficiency: per-employee override, else plant-wide, else undefined (engine warns)
    const effRows = feeds.efficiency.filter((e) => e.approval_status === 'approved');
    const effMine = effRows.find((e) => e.employee_id === emp.id) ?? effRows.find((e) => e.employee_id === null);
    const efficiencyPct = cat === 'PERMANENT_WORKER' ? (effMine?.efficiency_pct ?? null) : undefined;
    if (cat === 'PERMANENT_WORKER' && efficiencyPct === null) {
      warnings.push(`${emp.emp_code}: no approved efficiency % for ${year}-${mm} — production allowance 0, flagged`);
    }

    inputs.push({
      empCode: emp.emp_code, category: cat, month, year, workingDays: wd,
      masters: cat === 'STAFF' || cat === 'PERMANENT_WORKER' ? (sal ? mastersFrom(sal, cat) : undefined) : undefined,
      rateProfile: cat === 'CONSULTANT' || cat === 'PUNE_STAFF'
        ? { basis: 'MONTHLY_GROSS_PRORATED', monthlyGross: sal?.ctc_annual ? sal.ctc_annual / 12 : undefined }
        : undefined,
      days: day, otHours, efficiencyPct,
      deductions: { canteen, society, advance, other: otherDeduction || undefined },
      gender: (() => { const g = (emp.gender ?? '').trim().toLowerCase(); return g === 'female' || g === 'f' ? 'F' : 'M'; })(),
    });
  }

  return { inputs, reconciliation, warnings, blockedEmployees };
}
