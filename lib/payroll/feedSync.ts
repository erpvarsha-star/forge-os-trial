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

function mastersFrom(s: SalaryRow): SalaryMasters {
  return {
    BASIC: s.basic ?? undefined, HRA: s.hra ?? undefined, CONVEYANCE: s.conveyance ?? undefined,
    WASHING: s.washing ?? undefined, EDUCATION: s.education ?? undefined,
    HEAT: s.heat_allow ?? undefined,
    FIXED_GROSS: s.ctc_annual ? s.ctc_annual / 12 : undefined,
  };
}

const num = (v: unknown) => (typeof v === 'number' && !isNaN(v) ? v : 0);

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

    // Attendance aggregation (admin-entered statuses)
    const att = feeds.attendance.filter((a) => a.employee_id === emp.id && a.date >= periodStart && a.date <= periodEnd);
    const day = { present: 0, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 };
    let otHours = 0;
    for (const a of att) {
      const st = (a.status || '').toLowerCase();
      if (st === 'present' || st === 'half_day') day.present += st === 'half_day' ? 0.5 : 1;
      else if (st === 'week_off' || st === 'weekly_off') day.weekOff++;
      else if (st === 'ph' || st === 'holiday') day.ph++;
      else if (st === 'el') day.el++; else if (st === 'cl') day.cl++;
      else if (st === 'sl') day.sl++; else if (st === 'plo' || st === 'paid_layoff') day.plo++;
      otHours += num(a.overtime_hours);
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
      if ((st === 'absent') && punched) mismatch = 'ABSENT_BUT_PUNCHED';
      else if ((st === 'present' || st === 'half_day') && !punched) mismatch = 'PRESENT_NO_PUNCH';
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
    // Efficiency: per-employee override, else plant-wide, else undefined (engine warns)
    const effRows = feeds.efficiency.filter((e) => e.approval_status === 'approved');
    const effMine = effRows.find((e) => e.employee_id === emp.id) ?? effRows.find((e) => e.employee_id === null);
    const efficiencyPct = cat === 'PERMANENT_WORKER' ? (effMine?.efficiency_pct ?? null) : undefined;
    if (cat === 'PERMANENT_WORKER' && efficiencyPct === null) {
      warnings.push(`${emp.emp_code}: no approved efficiency % for ${year}-${mm} — production allowance 0, flagged`);
    }

    inputs.push({
      empCode: emp.emp_code, category: cat, month, year, workingDays: wd,
      masters: cat === 'STAFF' || cat === 'PERMANENT_WORKER' ? (sal ? mastersFrom(sal) : undefined) : undefined,
      rateProfile: cat === 'CONSULTANT' || cat === 'PUNE_STAFF'
        ? { basis: 'MONTHLY_GROSS_PRORATED', monthlyGross: sal?.ctc_annual ? sal.ctc_annual / 12 : undefined }
        : undefined,
      days: day, otHours, efficiencyPct,
      deductions: { canteen, society, advance },
      gender: emp.gender === 'F' ? 'F' : 'M',
    });
  }

  return { inputs, reconciliation, warnings, blockedEmployees };
}
