/** Run warnings unit test — pure, fabricated rows. Run: npx tsx scripts/payroll-warnings.test.ts */
import { computeRunWarnings, countByType, diffWarnings, warningKey, type AttendanceRow } from '../supabase/functions/payroll-run/lib/warnings'

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
const late = (id: string, d: number, m: number, reason: string | null = null, status = 'L') =>
  att.push({ employee_id: id, date: day(d), status, check_in_time: ci, late_minutes: m, late_reason: reason })
for (let d = 1; d <= 4; d++) late('e1', d, 10, d === 4 ? 'bus broke down' : null) // 4 free-size lates -> 4th flagged
for (let d = 1; d <= 3; d++) late('e2', d, 30)                                   // exactly 3 (boundary 30) -> none
att.push({ employee_id: 'e2', date: day(10), status: 'P', check_in_time: null, late_minutes: 0 }) // no punch
att.push({ employee_id: 'e3', date: day(5), status: 'P', check_in_time: null })  // Pune: excluded
att.push({ employee_id: 'e2', date: day(12), status: 'A', check_in_time: ci })   // punched but absent
att.push({ employee_id: 'e6', date: day(1), status: 'P', check_in_time: null })  // not in run
att.push({ employee_id: 'e2', date: day(14), status: 'WO', check_in_time: null }) // WO ignored

const w = computeRunWarnings({ attendance: att, employees, inputs })
const get = (c: string, t: string) => w.find((r) => r.employee_code === c && r.warning_type === t)
const lateOf = (c: string) => w.filter((r) => r.employee_code === c && r.warning_type === 'late_excess')

check('4th free late flagged, only it', lateOf('VFL1').length === 1 && lateOf('VFL1')[0].detail.date === day(4))
check('4th late detail shape', JSON.stringify(lateOf('VFL1')[0].detail) ===
  JSON.stringify({ date: day(4), late_minutes: 10, late_reason: 'bus broke down', kind: 'over_free_quota', nth_free_late: 4 }),
  JSON.stringify(lateOf('VFL1')[0].detail))
check('exactly 3 lates of 30 min not flagged', lateOf('VFL2').length === 0)
check('no_punch detected with dates', JSON.stringify(get('VFL2', 'no_punch')?.detail) === JSON.stringify({ count: 1, dates: [day(10)] }))
check('Pune excluded from no_punch', !get('VFL3', 'no_punch'))
check('punched_absent detected', JSON.stringify(get('VFL2', 'punched_absent')?.detail) === JSON.stringify({ count: 1, dates: [day(12)] }))
check('employee outside run ignored', !w.some((r) => r.employee_code === 'VFL6'))
check('missing_efficiency for worker without entry', !!get('VFL4', 'missing_efficiency'))
check('no missing_efficiency when entry exists', !get('VFL5', 'missing_efficiency'))
check('missing_efficiency only for workers', !w.some((r) => r.warning_type === 'missing_efficiency' && r.employee_code !== 'VFL4'))
check('idempotent', JSON.stringify(computeRunWarnings({ attendance: att, employees, inputs })) === JSON.stringify(w))
check('countByType', JSON.stringify(countByType(w)) === JSON.stringify({ late_excess: 1, no_punch: 1, punched_absent: 1, missing_efficiency: 1 }), JSON.stringify(countByType(w)))
check('no warnings on empty', computeRunWarnings({ attendance: [], employees: [], inputs: [] }).length === 0)

// ---- late rule boundaries (fresh employee each case)
const lateRun = (mins: number[], reasons: (string | null)[] = []) => {
  const a: AttendanceRow[] = mins.map((m, i) => ({ employee_id: 'e1', date: day(i + 1), status: 'L', check_in_time: ci, late_minutes: m, late_reason: reasons[i] ?? null }))
  return computeRunWarnings({ attendance: a, employees, inputs: [{ empCode: 'VFL1', category: 'STAFF' }] })
    .filter((r) => r.warning_type === 'late_excess')
}
check('30 min is free', lateRun([30]).length === 0)
check('31 min is flagged first time', lateRun([31]).length === 1 && lateRun([31])[0].detail.kind === 'over_30')
check('over_30 has no nth_free_late', !('nth_free_late' in lateRun([31])[0].detail))
check('3 free lates not flagged', lateRun([5, 6, 7]).length === 0)
check('4th free flagged (nth 4)', lateRun([5, 6, 7, 8]).length === 1 && lateRun([5, 6, 7, 8])[0].detail.nth_free_late === 4)
check('5 free lates -> 4th and 5th flagged', lateRun([5, 5, 5, 5, 5]).length === 2)
check('>30 does not consume quota', lateRun([40, 5, 6, 7]).length === 1) // only the 40; 3 free still free
check('>30 plus 4 free -> 40 and 4th free flagged', lateRun([40, 5, 6, 7, 8]).length === 2)
check('mixed order by date not input order', (() => {
  const a: AttendanceRow[] = [
    { employee_id: 'e1', date: day(9), status: 'L', check_in_time: ci, late_minutes: 5 },
    { employee_id: 'e1', date: day(1), status: 'L', check_in_time: ci, late_minutes: 5 },
    { employee_id: 'e1', date: day(5), status: 'L', check_in_time: ci, late_minutes: 5 },
    { employee_id: 'e1', date: day(7), status: 'L', check_in_time: ci, late_minutes: 5 },
  ]
  const r = computeRunWarnings({ attendance: a, employees, inputs: [{ empCode: 'VFL1', category: 'STAFF' }] })
  return r.length === 1 && r[0].detail.date === day(9)
})())
check('late_minutes 0 / null ignored', lateRun([0, 0, 0, 0, 0]).length === 0)
check('reason carried, null when absent', lateRun([40], ['traffic'])[0].detail.late_reason === 'traffic' && lateRun([40])[0].detail.late_reason === null)
check('status P with late_minutes still counts (rule is minutes-based)', (() => {
  const a: AttendanceRow[] = [{ employee_id: 'e1', date: day(1), status: 'P', check_in_time: ci, late_minutes: 45 }]
  return computeRunWarnings({ attendance: a, employees, inputs: [{ empCode: 'VFL1', category: 'STAFF' }] }).length === 1
})())
check('multiple flagged rows are distinct keys', new Set(lateRun([40, 50, 60]).map((r) => warningKey(r))).size === 3)

// ---- idempotent sync diff
const desired = lateRun([40, 5, 6, 7, 8]) // day1 (over_30), day5 (4th free)
const ex = (id: string, r: any, decision: string) => ({ id, employee_code: r.employee_code, warning_type: r.warning_type, detail: r.detail, decision })
check('diff: empty table inserts all', diffWarnings([], desired).toInsert.length === 2 && diffWarnings([], desired).toDeleteIds.length === 0)
check('diff: existing rows not re-inserted', diffWarnings([ex('a', desired[0], 'waived'), ex('b', desired[1], 'pending')], desired).toInsert.length === 0)
check('diff: stale pending deleted', JSON.stringify(diffWarnings([ex('a', desired[0], 'pending'), ex('z', { employee_code: 'VFL1', warning_type: 'late_excess', detail: { date: day(20) } }, 'pending')], desired).toDeleteIds) === '["z"]')
check('diff: stale decided never deleted', diffWarnings([ex('z', { employee_code: 'VFL1', warning_type: 'late_excess', detail: { date: day(20) } }, 'deduct')], desired).toDeleteIds.length === 0)
check('diff: undated key ignores detail', warningKey({ employee_code: 'X', warning_type: 'no_punch', detail: { dates: ['a'] } }) === warningKey({ employee_code: 'X', warning_type: 'no_punch', detail: { dates: ['b'] } }))
check('diff: legacy late_excess without date is stale', diffWarnings([ex('old', { employee_code: 'VFL1', warning_type: 'late_excess', detail: { late_days: 4 } }, 'pending')], desired).toDeleteIds[0] === 'old')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
