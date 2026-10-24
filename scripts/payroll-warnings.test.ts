/** Run warnings unit test — pure, fabricated rows. Run: npx tsx scripts/payroll-warnings.test.ts */
import { computeRunWarnings, countByType, type AttendanceRow } from '../supabase/functions/payroll-run/lib/warnings.ts'

let pass = 0, fail = 0
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ok  ${n}`)) : (fail++, console.log(`FAIL  ${n} ${d}`)) }

const employees = [
  { id: 'e1', emp_code: 'VFL1', category: 'staff', work_location: 'Aurangabad' },
  { id: 'e2', emp_code: 'VFL2', category: 'staff', work_location: 'Aurangabad' },
  { id: 'e3', emp_code: 'VFL3', category: 'staff', work_location: 'Pune' },
  { id: 'e4', emp_code: 'VFL4', category: 'worker', work_location: 'Aurangabad' },
  { id: 'e5', emp_code: 'VFL5', category: 'worker', work_location: 'Aurangabad' },
  { id: 'e6', emp_code: 'VFL6', category: 'staff', work_location: 'Aurangabad' },
]
const inputs = [
  { empCode: 'VFL1', category: 'STAFF' }, { empCode: 'VFL2', category: 'STAFF' },
  { empCode: 'VFL3', category: 'PUNE_STAFF' },
  { empCode: 'VFL4', category: 'PERMANENT_WORKER', efficiencyPct: null },
  { empCode: 'VFL5', category: 'PERMANENT_WORKER', efficiencyPct: 85 },
]
const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}`
const ci = '2026-10-01T03:00:00Z'
const att: AttendanceRow[] = []
for (let d = 1; d <= 4; d++) att.push({ employee_id: 'e1', date: day(d), status: 'L', check_in_time: ci }) // 4 late
for (let d = 1; d <= 3; d++) att.push({ employee_id: 'e2', date: day(d), status: 'L', check_in_time: ci }) // exactly 3
att.push({ employee_id: 'e2', date: day(10), status: 'P', check_in_time: null })       // no punch
att.push({ employee_id: 'e3', date: day(5), status: 'P', check_in_time: null })        // Pune: excluded
att.push({ employee_id: 'e2', date: day(12), status: 'A', check_in_time: ci })         // punched but absent
att.push({ employee_id: 'e6', date: day(1), status: 'P', check_in_time: null })        // not in run
att.push({ employee_id: 'e2', date: day(14), status: 'WO', check_in_time: null })      // WO ignored

const w = computeRunWarnings({ attendance: att, employees, inputs })
const get = (c: string, t: string) => w.find((r) => r.employee_code === c && r.warning_type === t)

check('>3 late flagged', get('VFL1', 'late_excess')?.detail.late_days === 4)
check('exactly 3 late not flagged', !get('VFL2', 'late_excess'))
check('no_punch detected with dates', JSON.stringify(get('VFL2', 'no_punch')?.detail) === JSON.stringify({ count: 1, dates: [day(10)] }))
check('Pune excluded from no_punch', !get('VFL3', 'no_punch'))
check('punched_absent detected', JSON.stringify(get('VFL2', 'punched_absent')?.detail) === JSON.stringify({ count: 1, dates: [day(12)] }))
check('employee outside run ignored', !w.some((r) => r.employee_code === 'VFL6'))
check('missing_efficiency for worker without entry', !!get('VFL4', 'missing_efficiency'))
check('no missing_efficiency when entry exists', !get('VFL5', 'missing_efficiency'))
check('missing_efficiency only for workers', !w.some((r) => r.warning_type === 'missing_efficiency' && r.employee_code !== 'VFL4'))
check('one row per employee per type', new Set(w.map((r) => r.employee_code + r.warning_type)).size === w.length)
check('idempotent', JSON.stringify(computeRunWarnings({ attendance: att, employees, inputs })) === JSON.stringify(w))
check('countByType', JSON.stringify(countByType(w)) === JSON.stringify({ late_excess: 1, no_punch: 1, punched_absent: 1, missing_efficiency: 1 }), JSON.stringify(countByType(w)))
check('no warnings on empty', computeRunWarnings({ attendance: [], employees: [], inputs: [] }).length === 0)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
