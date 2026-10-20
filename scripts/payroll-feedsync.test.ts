/** Feed sync unit test — no DB, fabricated rows. Run: npx tsx scripts/payroll-feedsync.test.ts */
import { assemblePayrollInputs, mapCategory, FeedBundle, SalaryRow } from '../lib/payroll/feedSync';
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
  efficiency: [{ employee_id: null, efficiency_pct: 83, approval_status: 'approved' }],
  statusEvents: [
    { employee_id: 'x1', status: 'left', effective_from: '2026-09-20' }, // excluded from Oct
  ],
};

const r = assemblePayrollInputs(2026, 10, bundle);

const w1 = r.inputs.find((i) => i.empCode === 'VFL4008')!;
check('worker present', !!w1);
check('worker category', w1.category === 'PERMANENT_WORKER');
check('Waluj Oct wd = 26 (Friday off)', w1.workingDays === 26, `got ${w1.workingDays}`);
check('OT summed', w1.otHours === 2);
check('approved EL added', w1.days.el === 2);
check('advance capped at outstanding', w1.deductions.advance === 300, `got ${w1.deductions.advance}`);
check('canteen+society read', w1.deductions.canteen === 120 && w1.deductions.society === 450);
check('plant-wide efficiency applied', w1.efficiencyPct === 83);
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

const c1 = cIn('CON01');
const c1r = calculateOne(c1);
check('daily consultant: DAILY_RATE 700', c1.rateProfile?.basis === 'DAILY_RATE' && c1.rateProfile?.rateAmount === 700);
check('daily consultant: 20 days -> GROSS 14000, not held', c1r.earnings.GROSS === 14000 && !c1r.held, JSON.stringify(c1r));

const c2r = calculateOne(cIn('CON16'));
check('daily consultant + 2 OT hrs: not held, otPay 175', !c2r.held && c2r.otPay === 175, JSON.stringify(c2r));

const c3 = cIn('CON05');
check('monthly consultant unchanged: MONTHLY_GROSS_PRORATED 20000',
  c3.rateProfile?.basis === 'MONTHLY_GROSS_PRORATED' && c3.rateProfile?.monthlyGross === 20000);

const c4 = cIn('CON18');
const c4r = calculateOne(c4);
check('daily with null daily_rate -> held MISSING_RATE', c4r.held && c4r.blockers.includes('MISSING_RATE'), JSON.stringify(c4r));
check('daily with null daily_rate -> warning', cr.warnings.includes('CON18: daily rate missing'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
