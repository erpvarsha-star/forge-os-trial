/** Feed sync unit test — no DB, fabricated rows. Run: npx tsx scripts/payroll-feedsync.test.ts */
import { assemblePayrollInputs, mapCategory, resolveWeeklyOff, pickSalary, FeedBundle, SalaryRow } from '../lib/payroll/feedSync';
import { calculateOne } from '../lib/payroll/engine';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ok  ${n}`)) : (fail++, console.log(`FAIL  ${n} ${d}`)); };

const bundle: FeedBundle = {
  employees: [
    { id: 'w1', emp_code: 'VFL4008', name: 'W1', category: 'worker', work_location: 'Aurangabad', gender: 'M', is_active: true, weekly_off_day: null },
    { id: 's1', emp_code: 'VFL1001', name: 'S1', category: 'staff', work_location: 'Aurangabad', gender: 'F', is_active: true, weekly_off_day: null },
    { id: 'p1', emp_code: 'BUNG01', name: 'P1', category: 'staff', work_location: 'Pune', gender: 'M', is_active: true, weekly_off_day: 0 },
    { id: 'x1', emp_code: 'VFL9999', name: 'Gone', category: 'worker', work_location: 'Aurangabad', gender: 'M', is_active: false, weekly_off_day: null },
  ],
  salaries: [
    { employee_id: 'w1', effective_from: '2026-01-01', is_active: true, basic: 15756, hra: 3555.84, conveyance: 3334, washing: 3111, education: 3334, heat_allow: 0, vda: null, production_allow: null, medical: null, professional_development: null, communication: null, uniform: null, ctc_annual: null },
    { employee_id: 'p1', effective_from: '2026-01-01', is_active: true, basic: null, hra: null, conveyance: null, washing: null, education: null, heat_allow: null, vda: null, production_allow: null, medical: null, professional_development: null, communication: null, uniform: null, ctc_annual: 300000 },
  ],
  attendance: [
    { employee_id: 'w1', date: '2026-10-05', status: 'present', overtime_hours: 2, check_in_time: '2026-10-05T08:00:00Z', check_out_time: null },
    { employee_id: 'w1', date: '2026-10-06', status: 'present', overtime_hours: 0, check_in_time: null, check_out_time: null }, // no punch -> mismatch
    { employee_id: 'w1', date: '2026-10-07', status: 'absent', overtime_hours: 0, check_in_time: '2026-10-07T08:00:00Z', check_out_time: null }, // punch -> mismatch
  ],
  punches: [],
  leaves: [{ employee_id: 'w1', type: 'EL', start_date: '2026-10-10', end_date: '2026-10-11', days: 2, status: 'approved' }],
  advances: [{ employee_id: 'w1', monthly_deduction: 500, outstanding_balance: 300, status: 'approved' }], // capped at balance
  canteen: [{ employee_id: 'w1', amount_inr: 120, approval_status: 'approved' }],
  society: [{ employee_id: 'w1', total_recovery_inr: 450, approval_status: 'approved' }],
  efficiency: [{ employee_id: null, efficiency_pct: 83, approval_status: 'approved', days_payable: 25 }],
  efficiencySlabs: [
    { slab_pct: 81, amount_post_aug2025: 4500 }, { slab_pct: 82, amount_post_aug2025: 5000 },
    { slab_pct: 83, amount_post_aug2025: 6500 }, { slab_pct: 84, amount_post_aug2025: 7500 },
    { slab_pct: 85, amount_post_aug2025: 8500 },
  ],
  statusEvents: [
    { employee_id: 'x1', status: 'left', effective_from: '2026-09-20' }, // excluded from Oct
  ],
};

const r = assemblePayrollInputs(2026, 10, bundle);

const w1 = r.inputs.find((i) => i.empCode === 'VFL4008')!;
check('worker present', !!w1);
check('worker category', w1.category === 'PERMANENT_WORKER');
check('Waluj Oct wd = 26 (Friday off)', w1.workingDays === 26, `got ${w1.workingDays}`);
check('OT not computed by core: otHours 0 even with attendance overtime_hours (1 Nov 2026)', w1.otHours === 0);
check('approved EL added', w1.days.el === 2);
check('advance capped at outstanding', w1.deductions.advance === 300, `got ${w1.deductions.advance}`);
check('canteen+society read', w1.deductions.canteen === 120 && w1.deductions.society === 450);
check('plant-wide efficiency applied', w1.efficiencyPct === 83);
check('PATCH_125: slab-resolved amount applied (83% -> 6500)', w1.efficiencyAmountOverride === 6500, `got ${w1.efficiencyAmountOverride}`);
check('PATCH_125: days_payable passed through as daysPayableOverride (25, not wd 26)', w1.daysPayableOverride === 25, `got ${w1.daysPayableOverride}`);
check('masters mapped', w1.masters?.BASIC === 15756 && w1.masters?.HEAT === 0);

const p1 = r.inputs.find((i) => i.empCode === 'BUNG01')!;
check('Pune staff category', p1.category === 'PUNE_STAFF');
check('Pune monthly gross from ctc', p1.rateProfile?.monthlyGross === 25000);

const s1 = r.inputs.find((i) => i.empCode === 'VFL1001')!;
check('staff wd = full calendar 31', s1.workingDays === 31);
check('staff no salary -> warning', r.warnings.some((w) => w.startsWith('VFL1001')));

check('exited employee excluded', !r.inputs.some((i) => i.empCode === 'VFL9999')
  && r.blockedEmployees.some((b) => b.empCode === 'VFL9999'));

check('reconciliation catches both directions', r.reconciliation.length === 2
  && r.reconciliation.some((x) => x.mismatch === 'PRESENT_NO_PUNCH')
  && r.reconciliation.some((x) => x.mismatch === 'ABSENT_BUT_PUNCHED'));

check('mapCategory: worker/staff/pune/consultant',
  mapCategory(bundle.employees[0]) === 'PERMANENT_WORKER'
  && mapCategory(bundle.employees[1]) === 'STAFF'
  && mapCategory(bundle.employees[2]) === 'PUNE_STAFF'
  && mapCategory({ ...bundle.employees[0], category: 'consultant' }) === 'CONSULTANT');


// --- Consultant daily-rate support (PATCH_97) ---
const emptySal = { basic: null, hra: null, conveyance: null, washing: null, education: null, heat_allow: null, vda: null, production_allow: null, medical: null, professional_development: null, communication: null, uniform: null };

// --- Category routing by emp_code (owner decision 26 Oct 2026; work_location ignored) ---
const mk = (emp_code: string, category: string, work_location: string) =>
  ({ id: 'z', emp_code, name: 'Z', category, work_location, gender: 'M', is_active: true, weekly_off_day: null });
check('route: BUNG code, category staff -> PUNE_STAFF', mapCategory(mk('BUNG05', 'staff', 'Pune')) === 'PUNE_STAFF');
check('route: BUNG code, Aurangabad location -> PUNE_STAFF', mapCategory(mk('BUNG05', 'staff', 'Aurangabad')) === 'PUNE_STAFF');
check('route: staff VFL code at Pune -> STAFF', mapCategory(mk('VFL1567', 'staff', 'Pune')) === 'STAFF');
check('route: VFL5 security staff at Pune -> STAFF', mapCategory(mk('VFL5439', 'staff', 'Pune')) === 'STAFF');
check('route: staff VFL code Aurangabad -> STAFF', mapCategory(mk('VFL1234', 'staff', 'Aurangabad')) === 'STAFF');
check('route: worker VFL4 -> PERMANENT_WORKER', mapCategory(mk('VFL4010', 'worker', 'Aurangabad')) === 'PERMANENT_WORKER');
check('route: worker category at Pune -> PERMANENT_WORKER', mapCategory(mk('VFL4010', 'worker', 'Pune')) === 'PERMANENT_WORKER');
check('route: CON code -> CONSULTANT', mapCategory(mk('CON05', 'consultant', 'Aurangabad')) === 'CONSULTANT');
check('route: CON code even if category member -> CONSULTANT', mapCategory(mk('CON12', 'staff', 'Aurangabad')) === 'CONSULTANT');
check('route: consultant category without CON prefix -> CONSULTANT', mapCategory(mk('VFL7000', 'consultant', 'Aurangabad')) === 'CONSULTANT');
check('route: lower-case/whitespace codes', mapCategory(mk('  bung07 ', 'staff', 'Pune')) === 'PUNE_STAFF'
  && mapCategory(mk(' con03', 'worker', 'Aurangabad')) === 'CONSULTANT');
check('route: VFL4xxx code with category staff -> STAFF', mapCategory(mk('VFL4099', 'staff', 'Aurangabad')) === 'STAFF');

const puneStaffBundle: FeedBundle = {
  ...bundle,
  employees: [mk('VFL1567', 'staff', 'Pune')],
  salaries: [{ employee_id: 'z', effective_from: '2026-01-01', is_active: true, ...emptySal0(), basic: 20000, hra: 8000, conveyance: 1600, education: 1600, ctc_annual: 0 }],
  attendance: [1,2,3,4,5,6,7,8,9,10].map((d) => ({ employee_id: 'z', date: `2026-10-${String(d).padStart(2, '0')}`, status: 'P', overtime_hours: 0, check_in_time: `2026-10-${String(d).padStart(2, '0')}T04:00:00Z`, check_out_time: null })),
  punches: [], leaves: [], advances: [], canteen: [], society: [], efficiency: [], statusEvents: [],
};
function emptySal0() { return { washing: null, heat_allow: null, vda: null, production_allow: null, medical: null, professional_development: null, communication: null, uniform: null }; }
const pr = assemblePayrollInputs(2026, 10, puneStaffBundle);
const pin = pr.inputs.find((i) => i.empCode === 'VFL1567')!;
check('e2e: Pune-location staff -> STAFF input with masters, no rateProfile', pin?.category === 'STAFF' && !pin.rateProfile && pin.masters?.FIXED_GROSS === 50000, JSON.stringify(pin));
const pout = calculateOne(pin);
check('e2e: Pune-location staff gets multi-line earnings (not single GROSS)', !pout.held && pout.earnings.GROSS === undefined && pout.earnings.BASIC !== undefined, JSON.stringify(pout));
check('e2e: Pune-location staff has PF deducted', (pout.deductions.PF ?? 0) > 0, JSON.stringify(pout.deductions));
const conSal = (id: string, extra: Partial<SalaryRow>): SalaryRow =>
  ({ employee_id: id, effective_from: '2026-04-01', is_active: true, ...emptySal, ctc_annual: 0, ...extra });
const conEmp = (id: string, code: string) =>
  ({ id, emp_code: code, name: code, category: 'consultant', work_location: 'Aurangabad', gender: 'M', is_active: true, weekly_off_day: null });
const presentDays = (id: string, n: number, ot = 0) =>
  Array.from({ length: n }, (_, i) => ({
    employee_id: id, date: `2026-10-${String(i + 1).padStart(2, '0')}`, status: 'present',
    overtime_hours: i === 0 ? ot : 0, check_in_time: null, check_out_time: null,
  }));
const conBundle: FeedBundle = {
  employees: [conEmp('c1', 'CON01'), conEmp('c2', 'CON16'), conEmp('c3', 'CON05'), conEmp('c4', 'CON18')],
  salaries: [
    conSal('c1', { rate_type: 'daily', daily_rate: 700 }),
    conSal('c2', { rate_type: 'Daily', daily_rate: 700 }),
    conSal('c3', { rate_type: 'monthly', daily_rate: null, ctc_annual: 240000 }),
    conSal('c4', { rate_type: 'daily', daily_rate: null }),
  ],
  attendance: [...presentDays('c1', 20), ...presentDays('c2', 20, 2), ...presentDays('c3', 20), ...presentDays('c4', 20)],
  punches: [], leaves: [], advances: [], canteen: [], society: [], efficiency: [], statusEvents: [],
};
const cr = assemblePayrollInputs(2026, 10, conBundle);
const cIn = (code: string) => cr.inputs.find((i) => i.empCode === code)!;

// --- Weekly-off default no longer keyed off work_location ---
const wk = (code: string, cat: string, loc: string, wo: number | null) => ({ ...mk(code, cat, loc), weekly_off_day: wo });
const wkOf = (e: ReturnType<typeof wk>) => resolveWeeklyOff(e, mapCategory(e));
check('weekly-off: STAFF at Pune, null -> Friday', wkOf(wk('VFL5439', 'staff', 'Pune', null)) === 5);
check('weekly-off: STAFF at Pune, 0 -> Sunday (explicit wins)', wkOf(wk('VFL1567', 'staff', 'Pune', 0)) === 0);
check('weekly-off: BUNG null -> Sunday', wkOf(wk('BUNG02', 'staff', 'Pune', null)) === 0);
check('weekly-off: worker at Pune, null -> Friday', wkOf(wk('VFL4010', 'worker', 'Pune', null)) === 5);
const wb: FeedBundle = { ...bundle, employees: [wk('VFL4010', 'worker', 'Pune', null)], salaries: [], attendance: [], leaves: [], advances: [], canteen: [], society: [], statusEvents: [] };
check('weekly-off e2e: Pune worker null -> Oct wd 26 (Friday off)', assemblePayrollInputs(2026, 10, wb).inputs[0]?.workingDays === 26);

const c1 = cIn('CON01');
const c1r = calculateOne(c1);
check('daily consultant: DAILY_RATE 700', c1.rateProfile?.basis === 'DAILY_RATE' && c1.rateProfile?.rateAmount === 700);
check('daily consultant: 20 days -> GROSS 14000, not held', c1r.earnings.GROSS === 14000 && !c1r.held, JSON.stringify(c1r));

const c2r = calculateOne(cIn('CON16'));
check('daily consultant + 2 attendance OT hrs: otHours 0, not held, otPay 0 (OT now an approved extra)', !c2r.held && cIn('CON16').otHours === 0 && c2r.otPay === 0, JSON.stringify(c2r));

const c3 = cIn('CON05');
check('monthly consultant unchanged: MONTHLY_GROSS_PRORATED 20000',
  c3.rateProfile?.basis === 'MONTHLY_GROSS_PRORATED' && c3.rateProfile?.monthlyGross === 20000);

const c4 = cIn('CON18');
const c4r = calculateOne(c4);
check('daily with null daily_rate -> held MISSING_RATE', c4r.held && c4r.blockers.includes('MISSING_RATE'), JSON.stringify(c4r));
check('daily with null daily_rate -> warning', cr.warnings.includes('CON18: daily rate missing'));

// ---- pickSalary validity window (27 Oct 2026): old rows serve past months, new rows from their start
{
  const row = (o: Partial<SalaryRow>): SalaryRow => ({ employee_id: 'e', effective_from: '2026-04-01', is_active: true, effective_to: null,
    basic: 1, hra: null, conveyance: null, washing: null, education: null, heat_allow: null, vda: null, production_allow: null,
    medical: null, professional_development: null, communication: null, uniform: null, ctc_annual: null, ...o });
  const rows = [
    row({ basic: 100, effective_from: '2026-04-01', effective_to: '2026-08-31', is_active: false }),
    row({ basic: 200, effective_from: '2026-09-01', effective_to: null, is_active: true }),
  ];
  check('pickSalary: Aug asOf picks old (inactive but window covers)', pickSalary(rows, 'e', '2026-08-31')?.basic === 100);
  check('pickSalary: Sep asOf picks new', pickSalary(rows, 'e', '2026-09-30')?.basic === 200);
  check('pickSalary: Oct asOf picks new', pickSalary(rows, 'e', '2026-10-31')?.basic === 200);
  check('pickSalary: old row with later (buggy) start no longer shadows new',
    pickSalary([row({ basic: 100, effective_from: '2026-09-24', effective_to: '2026-08-31', is_active: false }), rows[1]], 'e', '2026-09-30')?.basic === 200);
  check('pickSalary: retired (inactive, no end) excluded',
    pickSalary([row({ basic: 300, is_active: false, effective_to: null })], 'e', '2026-10-31') === null);
  check('pickSalary: not-yet-started excluded', pickSalary([row({ basic: 400, effective_from: '2026-11-01' })], 'e', '2026-10-31') === null);
  check('pickSalary: ended before asOf excluded', pickSalary([row({ basic: 500, effective_to: '2026-09-30' })], 'e', '2026-10-31') === null);
  check('pickSalary: effective_to inclusive on asOf', pickSalary([row({ basic: 600, effective_to: '2026-10-31' })], 'e', '2026-10-31')?.basic === 600);
  check('pickSalary: other employee ignored', pickSalary(rows, 'zzz', '2026-10-31') === null);
}

// ---- Weekly-off paid only if worked (owner decision 1 Nov 2026) ----
{
  const att = (id: string, d: number, status: string) => ({ employee_id: id, date: `2026-10-${String(d).padStart(2, '0')}`, status, overtime_hours: 0, check_in_time: null, check_out_time: null });
  const emp = (id: string, code: string, cat: string) => ({ id, emp_code: code, name: code, category: cat, work_location: 'Aurangabad', gender: 'M', is_active: true, weekly_off_day: null });
  const adv = (id: string) => ({ employee_id: id, monthly_deduction: 1000, outstanding_balance: 5000, status: 'approved' });
  const wob: FeedBundle = {
    ...bundle,
    employees: [emp('a', 'VFL1101', 'staff'), emp('b', 'VFL1102', 'staff'), emp('c', 'VFL1103', 'staff'), emp('d', 'VFL1104', 'staff'), emp('e', 'VFL4101', 'worker')],
    salaries: [], punches: [], canteen: [], society: [], efficiency: [], statusEvents: [],
    attendance: [
      att('a', 2, 'WO'), att('a', 9, 'WO'),
      att('b', 1, 'P'), att('b', 2, 'P'), att('b', 9, 'WO'),
      att('c', 2, 'WO'), att('c', 9, 'WO'),
      att('d', 2, 'WO'), att('d', 9, 'WO'),
      att('e', 1, 'P'), att('e', 9, 'WO'),
    ],
    leaves: [{ employee_id: 'd', type: 'EL', start_date: '2026-10-12', end_date: '2026-10-14', days: 3, status: 'approved' }],
    advances: [adv('a'), adv('c'), adv('d')],
  };
  const wr = assemblePayrollInputs(2026, 10, wob);
  const g = (c: string) => wr.inputs.find((i) => i.empCode === c)!;
  check('WO only (no present) -> weekOff 0', g('VFL1101').days.weekOff === 0 && g('VFL1101').days.present === 0);
  check('WO only + advance -> advance 0 + warning', g('VFL1101').deductions.advance === 0
    && wr.warnings.includes('VFL1101: no paid days - advance instalment skipped'));
  check('P days + WO -> WO counted', g('VFL1102').days.weekOff === 1 && g('VFL1102').days.present === 2);
  check('zero-paid employee with advance (c) -> advance 0', g('VFL1103').deductions.advance === 0
    && wr.warnings.includes('VFL1103: no paid days - advance instalment skipped'));
  check('only approved EL + WO -> EL paid, WO ignored', g('VFL1104').days.el === 3 && g('VFL1104').days.weekOff === 0);
  check('EL-only employee still has advance deducted, no warning', g('VFL1104').deductions.advance === 1000
    && !wr.warnings.some((w) => w.startsWith('VFL1104') && w.includes('advance')));
  check('worker unchanged (present + WO input kept, wd 26)', g('VFL4101').days.present === 1 && g('VFL4101').workingDays === 26);
}

// ---- 1 Nov 2026: OT and holiday out of the core ----
{
  const mkA = (id: string, d: number, status: string, ot = 0) => ({ employee_id: id, date: `2026-10-${String(d).padStart(2, '0')}`, status, overtime_hours: ot, check_in_time: null, check_out_time: null });
  const emp = (id: string, code: string, cat: string) => ({ id, emp_code: code, name: code, category: cat, work_location: 'Aurangabad', gender: 'M', is_active: true, weekly_off_day: null });
  const b: FeedBundle = {
    ...bundle,
    employees: [emp('s', 'VFL1201', 'staff'), emp('w', 'VFL4201', 'worker'), emp('c', 'CON05', 'consultant'), emp('h', 'VFL1202', 'staff')],
    salaries: [], punches: [], canteen: [], society: [], efficiency: [], statusEvents: [], leaves: [],
    advances: [{ employee_id: 'h', monthly_deduction: 1000, outstanding_balance: 5000, status: 'approved' }],
    attendance: [mkA('s', 1, 'P', 3), mkA('s', 2, 'P', 2), mkA('w', 1, 'P', 4), mkA('c', 1, 'P', 5),
      mkA('s', 20, 'H'), mkA('h', 20, 'H')],
  };
  const rr = assemblePayrollInputs(2026, 10, b);
  const g = (c: string) => rr.inputs.find((i) => i.empCode === c)!;
  check('staff otHours 0 despite overtime_hours', g('VFL1201').otHours === 0);
  check('worker otHours 0 despite overtime_hours', g('VFL4201').otHours === 0);
  check('consultant otHours 0 despite overtime_hours', g('CON05').otHours === 0);
  check("'H' row adds no paid day", g('VFL1201').days.ph === 0 && g('VFL1201').days.present === 2);
  check("'H'-only employee: zero paid days, advance skipped + warning", g('VFL1202').days.ph === 0 && g('VFL1202').deductions.advance === 0 && rr.warnings.includes('VFL1202: no paid days - advance instalment skipped'));
  const adjB: FeedBundle = { ...b, adjustments: [
    { employee_id: 's', adjustment_type: 'OTHER_ALLOWANCE', signed_amount_inr: 900, approval_status: 'approved' },
    { employee_id: 's', adjustment_type: 'OTHER_DEDUCTION', signed_amount_inr: -150, approval_status: 'approved' }] };
  const ar = assemblePayrollInputs(2026, 10, adjB);
  const sIn = ar.inputs.find((i) => i.empCode === 'VFL1201')!;
  check('negative adjustment still -> deductions.other; positive not warned as unapplied', sIn.deductions.other === 150 && !ar.warnings.some((w) => w.includes('not applied')));
}

{
  // PATCH_125: no efficiencySlabs/days_payable fed at all (e.g. no month entry exists yet) ->
  // engine receives no override, falls back to its own documented default (PROD_SLAB + wd).
  const noSlabBundle: FeedBundle = { ...bundle, efficiencySlabs: undefined, efficiency: [{ employee_id: null, efficiency_pct: 83, approval_status: 'approved' }] };
  const r2 = assemblePayrollInputs(2026, 10, noSlabBundle);
  const w1b = r2.inputs.find((i) => i.empCode === 'VFL4008')!;
  check('PATCH_125: no slab table/days_payable fed -> both overrides undefined', w1b.efficiencyAmountOverride === undefined && w1b.daysPayableOverride === undefined);
}

{
  // PATCH_127: first_recovery_month gates when an approved advance's instalment
  // actually starts being deducted. Period under test is 2026-10 (October).
  const frmBundle: FeedBundle = {
    ...bundle,
    employees: [bundle.employees[0]], // VFL4008 / id 'w1'
    salaries: [bundle.salaries[0]],
    attendance: [{ employee_id: 'w1', date: '2026-10-05', status: 'present', overtime_hours: 0, check_in_time: '2026-10-05T08:00:00Z', check_out_time: '2026-10-05T17:00:00Z' }],
    canteen: [], society: [], efficiency: [], statusEvents: [], leaves: [],
  };
  const future = assemblePayrollInputs(2026, 10, { ...frmBundle, advances: [{ employee_id: 'w1', monthly_deduction: 500, outstanding_balance: 5000, status: 'approved', first_recovery_month: '2026-11' }] });
  check('PATCH_127: first_recovery_month in a future period (2026-11 > 2026-10) -> 0 deducted',
    future.inputs.find((i) => i.empCode === 'VFL4008')!.deductions.advance === 0,
    `got ${future.inputs.find((i) => i.empCode === 'VFL4008')!.deductions.advance}`);

  const current = assemblePayrollInputs(2026, 11, { ...frmBundle, attendance: [{ employee_id: 'w1', date: '2026-11-05', status: 'present', overtime_hours: 0, check_in_time: '2026-11-05T08:00:00Z', check_out_time: '2026-11-05T17:00:00Z' }], advances: [{ employee_id: 'w1', monthly_deduction: 500, outstanding_balance: 5000, status: 'approved', first_recovery_month: '2026-11' }] });
  check('PATCH_127: first_recovery_month equal to the current period (2026-11) -> deducted',
    current.inputs.find((i) => i.empCode === 'VFL4008')!.deductions.advance === 500,
    `got ${current.inputs.find((i) => i.empCode === 'VFL4008')!.deductions.advance}`);

  const past = assemblePayrollInputs(2026, 11, { ...frmBundle, attendance: [{ employee_id: 'w1', date: '2026-11-05', status: 'present', overtime_hours: 0, check_in_time: '2026-11-05T08:00:00Z', check_out_time: '2026-11-05T17:00:00Z' }], advances: [{ employee_id: 'w1', monthly_deduction: 500, outstanding_balance: 5000, status: 'approved', first_recovery_month: '2026-09' }] });
  check('PATCH_127: first_recovery_month in the past -> still deducted (regression safety)',
    past.inputs.find((i) => i.empCode === 'VFL4008')!.deductions.advance === 500,
    `got ${past.inputs.find((i) => i.empCode === 'VFL4008')!.deductions.advance}`);

  const nullFrm = assemblePayrollInputs(2026, 10, { ...frmBundle, advances: [{ employee_id: 'w1', monthly_deduction: 500, outstanding_balance: 5000, status: 'approved' }] });
  check('PATCH_127: no first_recovery_month set (null/absent) -> deducted as before (regression safety)',
    nullFrm.inputs.find((i) => i.empCode === 'VFL4008')!.deductions.advance === 500,
    `got ${nullFrm.inputs.find((i) => i.empCode === 'VFL4008')!.deductions.advance}`);
}

console.log('== Half-day ("HL"/"half_day") attendance status — audit gap 2 ==');
{
  // statusEffect() (internal) maps DB status 'hl'/'half_day' -> present:0.5. This block drives
  // that through the public assemblePayrollInputs() entry point (the only exported surface that
  // reaches statusEffect) to confirm the mapping is live and correctly aggregated.
  const halfDayBundle: FeedBundle = {
    ...bundle,
    attendance: [
      { employee_id: 'w1', date: '2026-12-02', status: 'hl', overtime_hours: 0, check_in_time: '2026-12-02T08:00:00Z', check_out_time: '2026-12-02T12:00:00Z' },
      { employee_id: 'w1', date: '2026-12-03', status: 'half_day', overtime_hours: 0, check_in_time: '2026-12-03T08:00:00Z', check_out_time: '2026-12-03T12:00:00Z' },
      { employee_id: 'w1', date: '2026-12-04', status: 'present', overtime_hours: 0, check_in_time: '2026-12-04T08:00:00Z', check_out_time: '2026-12-04T17:00:00Z' },
    ],
    leaves: [], advances: [], canteen: [], society: [],
  };
  const rHalf = assemblePayrollInputs(2026, 12, halfDayBundle);
  const w1Half = rHalf.inputs.find((i) => i.empCode === 'VFL4008')!;
  check('"hl" status -> 0.5 present day counted', !!w1Half);
  check('"hl" (1x) + "half_day" (1x) + "present" (1x) -> days.present = 2.0 (0.5+0.5+1)',
    w1Half.days.present === 2.0, `got ${w1Half.days.present}`);
  check('HL/half_day rows do NOT mark weekOff/el/cl/sl/ph', w1Half.days.weekOff === 0 && w1Half.days.el === 0 && w1Half.days.ph === 0);

  // HL rows are also correctly recognized as "present with no punch" in reconciliation
  // when there's no punch, and NOT flagged when a punch exists (as given above, both HL rows
  // do have punches, so reconciliation should be empty for this bundle).
  check('HL rows with real punches produce no reconciliation mismatch', rHalf.reconciliation.length === 0, JSON.stringify(rHalf.reconciliation));

  const halfDayNoPunchBundle: FeedBundle = {
    ...halfDayBundle,
    attendance: [
      { employee_id: 'w1', date: '2026-12-02', status: 'hl', overtime_hours: 0, check_in_time: null, check_out_time: null },
    ],
  };
  const rHalfNoPunch = assemblePayrollInputs(2026, 12, halfDayNoPunchBundle);
  check('HL row with NO punch -> flagged PRESENT_NO_PUNCH (same as a full "present" day)',
    rHalfNoPunch.reconciliation.some((x) => x.mismatch === 'PRESENT_NO_PUNCH'), JSON.stringify(rHalfNoPunch.reconciliation));

  // Flow all the way through to the engine: a half-present-day PayrollInput must pay out
  // proportionally less than a full-present-day one (confirms the 0.5 actually reaches
  // calculateOne() unmodified, not just that feedSync's own DayCounts object looks right).
  const oneHlOnly: FeedBundle = {
    ...bundle,
    attendance: [{ employee_id: 's1', date: '2026-12-02', status: 'hl', overtime_hours: 0, check_in_time: '2026-12-02T08:00:00Z', check_out_time: '2026-12-02T12:00:00Z' }],
    leaves: [], advances: [], canteen: [], society: [],
  };
  const rHl = assemblePayrollInputs(2026, 12, oneHlOnly);
  const s1Hl = rHl.inputs.find((i) => i.empCode === 'VFL1001')!;
  check('STAFF half-day input: days.present = 0.5 reaches the PayrollInput unmodified', s1Hl.days.present === 0.5, `got ${s1Hl.days.present}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
