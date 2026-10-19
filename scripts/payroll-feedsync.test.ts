/** Feed sync unit test — no DB, fabricated rows. Run: npx tsx scripts/payroll-feedsync.test.ts */
import { assemblePayrollInputs, mapCategory, FeedBundle } from '../lib/payroll/feedSync';

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

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
