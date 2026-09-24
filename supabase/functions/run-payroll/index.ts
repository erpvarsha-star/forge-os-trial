/**
 * run-payroll
 *
 * The salary calculation engine — Phase 3 of the salary consolidation
 * described in PENDING.md's "Salary consolidation" section. Computes one
 * employee's payroll for one month from their `employee_salary_structure`
 * (fixed CTC-derived rates) plus the confirmed-days breakdown and one-off
 * figures HR/Accounts/the canteen supply, and upserts the result into
 * `payroll_records`.
 *
 * Two callers, same function, same output regardless of source (per the
 * approved blueprint's "dual input path" decision): in-app HR-Admin
 * screens call it per employee immediately on save; the consolidated-sheet
 * Apps Script sync (not yet built) will call it once per sync run, looping
 * every changed row. Neither is "the real one" — both write the same table.
 *
 * Every formula below was read directly from the live spreadsheet formulas
 * during the review (not guessed) — see the plan file's "Formulas confirmed
 * from the actual spreadsheet formulas" section.
 *
 * BACKTESTED against real data (24 Sep 2026):
 *   - Basic, Conveyance, Washing, Education, HRA pro-ration: MATCH exactly.
 *   - PF: MATCHES exactly (₹1,800 = ₹1,800).
 *   - VDA: the blueprint's original assumption (pro-rates like Basic) was
 *     WRONG — 25-55% match across 1,718 real employee-months tested. The
 *     REAL formula, found by backtesting all 52 worker-sheet monthly tabs
 *     back to Apr 2022: `VDA = per-day VDA rate x Present Days` — Present
 *     Days ONLY, not Days Payable (excludes EL/CL/SL/PH, unlike every other
 *     component). CONFIRMED EXACT for all 172 employee-months checked
 *     across the 7 most recent tabs (Feb 2026 - Aug 2026, 100% match, zero
 *     exceptions). The per-day rate is a company-wide value that changes
 *     periodically and isn't in `employee_salary_structure` — see
 *     `payroll_monthly_rates` (PATCH_31).
 *   - OT Amount: formula CONFIRMED correct — 89.8% exact match across 1,123
 *     worker employee-months (47 of 52 months exact), USING
 *     `employee_salary_structure.vda` (the stored "VDA (F)" snapshot) as
 *     the hourly-rate input, NOT the monthly per-day rate above. Verified
 *     this is the right choice, not a leftover bug: swapping in the
 *     monthly rate x Working Days instead broke Jul/Jun/May 2026 (which
 *     matched exactly, 16/16, 19/19, 19/19, using the stored VDA_F) to fix
 *     nothing. The one real exception, Aug 2026 (₹13,137 computed vs
 *     ₹12,939 actual), traced to the live sheet's stored VDA_F for that
 *     month itself being stale (still showing July's ₹93/day-equivalent
 *     instead of August's revised ₹103/day) — a data-freshness bug in the
 *     SOURCE SHEET, not this formula. Keeping `employee_salary_structure`
 *     current when the union agreement revises VDA is what prevents this
 *     going forward, not a formula change.
 *     Staff OT: ~99%+ match across 1,510 employee-months.
 * Everything else (ESIC, PT, Production Efficiency, Heat Allowance) is
 * either newly-corrected-by-design (ESIC) or not yet checked against a
 * real row — see inline warnings.
 *
 * POST body: either a single employee input object, or { employees: [...] }
 * for a batch. See `EmployeeInput` below for the shape.
 */

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

interface EmployeeInput {
  employee_id: string;
  month: string; // '01'-'12'
  year: number;
  working_days: number;
  present_days: number;
  el?: number;
  cl?: number;
  sl?: number;
  ph?: number;
  ot_hours?: number;
  canteen?: number;
  society?: number;
  mlwf?: number;
  other_deduction?: number;
  arrears?: number;
  dispatch_incentive?: number;
  other_allowance?: number;
  advance_recovery?: number;
  tds?: number;
}

interface SalaryStructure {
  ctc_annual: number;
  basic: number;
  hra: number;
  conveyance: number;
  washing: number | null;
  education: number | null;
  heat_allow: number | null;
  vda: number | null;
  production_allow: number | null;
  medical: number | null;
  professional_development: number | null;
  communication: number | null;
  uniform: number | null;
}

const n = (v: number | null | undefined) => v ?? 0;
const round0 = (v: number) => Math.round(v);

/**
 * Pro-ration: fixed rate x (Days Payable / Working Days). Confirmed as the
 * general rule during the review; exact rounding behaviour wasn't visible
 * in the source formulas (the monthly tabs were values-only by the time
 * they were read), so this rounds to 2dp and leaves final rounding to the
 * net_pay total — the backtest against known Aug 2026 rows is what actually
 * validates this, not an assumption made here.
 */
function prorate(fixedRate: number, daysPayable: number, workingDays: number): number {
  if (workingDays <= 0) return 0;
  // Confirmed against real Aug 2026 data during the backtest: the sheet
  // rounds every prorated component to the nearest whole rupee (not 2dp).
  return Math.round(fixedRate * (daysPayable / workingDays));
}

/**
 * Employee PF — confirmed formula: 12% of (Basic + VDA), payable, capped at
 * the statutory ₹15,000 wage ceiling (hence the flat ₹1,800 above that).
 * Staff have no VDA component, so this collapses to 12% of Basic alone —
 * confirmed correct by Yash (labour-law-consulted ₹1,800 cap), not a guess.
 */
function calcPF(basicPayable: number, vdaPayable: number): number {
  const base = basicPayable + vdaPayable;
  return round0(Math.min(base, 15000) * 0.12);
}

/**
 * Employee ESIC — the CORRECT rule, per Yash (24 Sep 2026), not the sheet's
 * formula (which was a copy-paste of PF's — same cap, same flat fallback —
 * confirmed a bug, not replicated here). Real rule: 0.75% of gross, exempt
 * entirely above ₹21,000 gross. Eligibility is tested against the FIXED
 * gross (sum of the employee's fixed component rates) since ESIC
 * eligibility is normally set at CTC/appraisal time, not month to month;
 * the actual amount deducted is 0.75% of that month's PAYABLE gross.
 */
function calcESIC(grossFixed: number, grossPayable: number): number {
  if (grossFixed > 21000) return 0;
  return round0(grossPayable * 0.0075);
}

/**
 * OT Amount — confirmed formula for workers: ((Basic_F + VDA_F) /
 * Working_Days / 8) x 2 x OT_Hours (double the per-hour rate), where VDA_F
 * is `employee_salary_structure.vda` — the stored "VDA (F)" snapshot, NOT
 * the monthly per-day rate used for the VDA payable line item (see
 * `calcVDA` below — they are two different numbers in the source sheet).
 *
 * Tested this distinction directly: swapping VDA_F for "current month's
 * per-day rate x Working Days" broke Jul/Jun/May 2026 (which matched
 * exactly using the stored VDA_F, 16/16, 19/19, 19/19) to fix nothing —
 * Aug 2026's known OT mismatch is a real staleness bug in the SOURCE
 * SHEET's VDA_F field that month, not evidence VDA_F is the wrong input in
 * general. Keeping `employee_salary_structure.vda` here is correct as
 * long as it's kept current when the union agreement revises rates — a
 * data-freshness responsibility for whoever maintains that table, not
 * something this formula should paper over.
 *
 * Staff have no VDA, so `vdaF` is passed as 0 for them — matches the staff
 * backtest (~99%+ across 1,510 employee-months).
 */
function calcOT(basicF: number, vdaF: number, workingDays: number, otHours: number): number {
  if (workingDays <= 0 || !otHours) return 0;
  const hourlyRate = (basicF + vdaF) / workingDays / 8;
  return Math.round(hourlyRate * 2 * otHours * 100) / 100;
}

/**
 * VDA — confirmed formula (24 Sep 2026 backtest, see header comment):
 * per-day rate x Present Days ONLY. Deliberately does not take EL/CL/SL/PH
 * into account, unlike `prorate()` above — this is a real, backtest-proven
 * difference from every other component, not an oversight.
 */
function calcVDA(perDayRate: number, presentDays: number): number {
  return round0(perDayRate * presentDays);
}

/**
 * The company-wide per-day VDA rate for a given month, from
 * `payroll_monthly_rates` (PATCH_31) — entered once per month, applied to
 * every worker, same shape as `department_efficiency_actuals`. Cached per
 * batch call since every worker in a request shares the same lookup.
 */
async function getVdaRate(
  db: ReturnType<typeof supabaseAdmin>,
  month: string,
  year: number,
  cache: Map<string, number | null>
): Promise<{ rate: number | null; warning?: string }> {
  const key = `${year}-${month}`;
  if (!cache.has(key)) {
    const { data } = await db
      .from('payroll_monthly_rates')
      .select('vda_per_day_rate')
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();
    cache.set(key, data ? data.vda_per_day_rate : null);
  }
  const rate = cache.get(key)!;
  if (rate === null) {
    return {
      rate: null,
      warning: `No payroll_monthly_rates row for ${month}/${year} — VDA and worker OT not computed (left at 0) until HR enters this month's VDA per-day rate.`,
    };
  }
  return { rate };
}

/**
 * PT — slab lookup by gender + gross (payable), from `pt_slabs`. February
 * carries a documented ₹300 true-up instead of the normal ₹200 (see the
 * slab's own `remarks`) — a per-month exception on the same slab, not a
 * separate threshold, so it's applied here rather than modelled as a
 * second row.
 */
async function calcPT(
  db: ReturnType<typeof supabaseAdmin>,
  gender: string | null,
  grossPayable: number,
  month: string
): Promise<{ amount: number; warning?: string }> {
  if (!gender) {
    return { amount: 0, warning: 'PT not computed: employee.gender is not set yet.' };
  }
  const { data: slabs } = await db
    .from('pt_slabs')
    .select('min_gross, max_gross, pt_amount, remarks')
    .eq('gender', gender);

  const slab = (slabs ?? []).find(
    (s: { min_gross: number; max_gross: number | null }) =>
      grossPayable >= s.min_gross && (s.max_gross === null || grossPayable <= s.max_gross)
  );
  if (!slab) return { amount: 0, warning: `No PT slab matched gross ${grossPayable} for gender ${gender}.` };

  let amount = slab.pt_amount;
  if (month === '02' && slab.remarks && /february/i.test(slab.remarks) && amount === 200) {
    amount = 300;
  }
  return { amount };
}

/**
 * Production Efficiency — workers only. Slab lookup by department against
 * `efficiency_incentive_slabs`, using that department's achieved % for the
 * month from `department_efficiency_actuals` (entered once per department,
 * not per employee — per the approved blueprint). Below the lowest slab
 * threshold, the incentive is zero and the FULL fixed Production Allowance
 * (already included in Total Earning via pro-ration) gets clawed back —
 * confirmed from the real Aug 2026 Forge Shop data during the review.
 */
async function calcEfficiencyDeduction(
  db: ReturnType<typeof supabaseAdmin>,
  department: string | null,
  productionAllowPayable: number,
  month: string,
  year: number
): Promise<{ deduction: number; warning?: string }> {
  if (!department || productionAllowPayable <= 0) return { deduction: 0 };

  const { data: actual } = await db
    .from('department_efficiency_actuals')
    .select('achieved_pct')
    .eq('department', department)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  if (!actual) {
    return {
      deduction: 0,
      warning: `No department_efficiency_actuals row for ${department} ${month}/${year} — Production Efficiency not computed, full allowance left payable.`,
    };
  }

  const { data: slabs } = await db
    .from('efficiency_incentive_slabs')
    .select('threshold_pct, incentive_amount')
    .eq('department', department)
    .lte('period_start', `${year}-${month}-01`)
    .gte('period_end', `${year}-${month}-01`)
    .order('threshold_pct', { ascending: false });

  if (!slabs || slabs.length === 0) {
    return {
      deduction: 0,
      warning: `No efficiency_incentive_slabs found for ${department} covering ${year}-${month} — Production Efficiency not computed.`,
    };
  }

  const achieved = actual.achieved_pct;
  const matched = slabs.find((s: { threshold_pct: number }) => achieved >= s.threshold_pct);
  const incentiveEarned = matched ? matched.incentive_amount : 0;
  const deduction = Math.max(0, productionAllowPayable - incentiveEarned);
  return { deduction };
}

async function computeOne(
  db: ReturnType<typeof supabaseAdmin>,
  input: EmployeeInput,
  vdaRateCache: Map<string, number | null>
) {
  const { data: employee } = await db
    .from('employees')
    .select('id, category, department, gender')
    .eq('id', input.employee_id)
    .single();

  if (!employee) {
    return { employee_id: input.employee_id, error: 'employee not found' };
  }

  const { data: structure } = await db
    .from('employee_salary_structure')
    .select(
      'ctc_annual, basic, hra, conveyance, washing, education, heat_allow, vda, production_allow, medical, professional_development, communication, uniform'
    )
    .eq('employee_id', input.employee_id)
    .eq('is_active', true)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!structure) {
    return { employee_id: input.employee_id, error: 'no active employee_salary_structure row for this employee' };
  }
  const s = structure as SalaryStructure;

  const daysPayable = n(input.present_days) + n(input.el) + n(input.cl) + n(input.sl) + n(input.ph);
  const workingDays = input.working_days;
  const warnings: string[] = [];

  const isWorker = employee.category === 'worker';

  const basicP = prorate(s.basic, daysPayable, workingDays);
  const hraP = prorate(s.hra, daysPayable, workingDays);
  const conveyanceP = prorate(s.conveyance, daysPayable, workingDays);
  const educationP = prorate(n(s.education), daysPayable, workingDays);
  const washingP = prorate(n(s.washing), daysPayable, workingDays);

  let specialAllowanceP = 0; // catch-all for the components payroll_records collapses (matches PATCH_26's existing convention)
  let vdaP = 0;
  let productionAllowP = 0;

  if (isWorker) {
    const vdaResult = await getVdaRate(db, input.month, input.year, vdaRateCache);
    if (vdaResult.warning) warnings.push(vdaResult.warning);
    if (vdaResult.rate !== null) {
      vdaP = calcVDA(vdaResult.rate, n(input.present_days));
    }
    // Heat Allowance: confirmed quirk — pays only if the fixed rate is
    // exactly flagged 150 (eligibility marker, not a real rate); then it's
    // a per-day rate x Days Payable, not the usual fixed-rate proration.
    // The exact per-day rate cell (AM2 in the source) wasn't extracted, so
    // this uses the same general proration as everything else — flag for
    // the backtest to confirm against a real Heat-Allowance-eligible row.
    const heatAllowP = n(s.heat_allow) === 150 ? prorate(150, daysPayable, workingDays) : 0;
    if (n(s.heat_allow) === 150) warnings.push('Heat Allowance eligibility detected — verify against a real payslip; exact per-day rate not independently confirmed.');
    productionAllowP = prorate(n(s.production_allow), daysPayable, workingDays);
    specialAllowanceP = educationP + washingP + heatAllowP;
  } else {
    const medicalP = prorate(n(s.medical), daysPayable, workingDays);
    const profDevP = prorate(n(s.professional_development), daysPayable, workingDays);
    const commP = prorate(n(s.communication), daysPayable, workingDays);
    const uniformP = prorate(n(s.uniform), daysPayable, workingDays);
    specialAllowanceP = medicalP + educationP + profDevP + commP + uniformP + washingP;
  }

  const totalEarning = basicP + hraP + conveyanceP + specialAllowanceP + vdaP + productionAllowP;

  const otAmount = isWorker
    ? calcOT(s.basic, n(s.vda), workingDays, n(input.ot_hours))
    : calcOT(s.basic, 0, workingDays, n(input.ot_hours));

  const pf = calcPF(basicP, vdaP);

  const grossFixed =
    s.basic + s.hra + s.conveyance + n(s.washing) + n(s.education) +
    (isWorker ? n(s.vda) + n(s.production_allow) + n(s.heat_allow === 150 ? 0 : s.heat_allow) : n(s.medical) + n(s.professional_development) + n(s.communication) + n(s.uniform));
  const esic = calcESIC(grossFixed, totalEarning);

  const ptResult = await calcPT(db, employee.gender, totalEarning, input.month);
  if (ptResult.warning) warnings.push(ptResult.warning);

  let productionEfficiencyDeduction = 0;
  if (isWorker) {
    const effResult = await calcEfficiencyDeduction(db, employee.department, productionAllowP, input.month, input.year);
    productionEfficiencyDeduction = effResult.deduction;
    if (effResult.warning) warnings.push(effResult.warning);
  }

  const advanceRecovery = n(input.advance_recovery);
  const tds = n(input.tds);
  const canteen = n(input.canteen);
  const society = n(input.society);
  const mlwf = n(input.mlwf);
  const otherDeduction = n(input.other_deduction);
  const arrears = n(input.arrears);
  const dispatchIncentive = n(input.dispatch_incentive);
  const otherAllowance = n(input.other_allowance);

  const totalDeduction =
    pf + esic + ptResult.amount + productionEfficiencyDeduction + advanceRecovery + tds + canteen + society + mlwf + otherDeduction;

  const netPay = round0(
    totalEarning + otAmount + arrears + dispatchIncentive + otherAllowance - totalDeduction
  );

  const record = {
    employee_id: input.employee_id,
    month: input.month,
    year: input.year,
    basic: basicP,
    hra: hraP,
    conveyance: conveyanceP,
    special_allowance: specialAllowanceP,
    overtime: otAmount,
    pf,
    esic,
    pt: ptResult.amount,
    advance_recovery: advanceRecovery,
    tds,
    production_incentive: isWorker ? Math.max(0, productionAllowP - productionEfficiencyDeduction) : 0,
    canteen,
    society,
    mlwf,
    other_deduction: otherDeduction,
    arrears,
    dispatch_incentive: dispatchIncentive,
    other_allowance: otherAllowance,
    production_efficiency_deduction: productionEfficiencyDeduction,
    working_days: workingDays,
    present_days: input.present_days,
    el: n(input.el),
    cl: n(input.cl),
    sl: n(input.sl),
    ph: n(input.ph),
    days_payable: daysPayable,
    ot_hours: n(input.ot_hours),
    net_pay: netPay,
    status: 'final',
  };

  const { error: upsertError } = await db
    .from('payroll_records')
    .upsert(record, { onConflict: 'employee_id,month,year' });

  if (upsertError) {
    return { employee_id: input.employee_id, error: upsertError.message };
  }

  return { employee_id: input.employee_id, net_pay: netPay, warnings: warnings.length ? warnings : undefined };
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  let body: { employees?: EmployeeInput[] } & Partial<EmployeeInput>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const inputs: EmployeeInput[] = Array.isArray(body.employees) ? body.employees : [body as EmployeeInput];

  if (inputs.length === 0 || !inputs[0]?.employee_id) {
    return jsonResponse({ error: 'Provide either a single employee input or { employees: [...] }' }, 400);
  }

  const db = supabaseAdmin();

  try {
    const results = [];
    const vdaRateCache = new Map<string, number | null>();
    for (const input of inputs) {
      results.push(await computeOne(db, input, vdaRateCache));
    }
    return jsonResponse({ results });
  } catch (err) {
    console.error('run-payroll failed', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
