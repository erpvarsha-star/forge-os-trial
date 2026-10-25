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
late('e1', 1, 10); late('e1', 2, 40); late('e1', 3, 31); late('e1', 4, 50, 'bus broke down') // 10 ignored; 3 flagged (nth 1..3)
for (let d = 1; d <= 3; d++) late('e2', d, 30)                                   // exactly 3 (boundary 30) -> none
att.push({ employee_id: 'e2', date: day(10), status: 'P', check_in_time: null, late_minutes: 0 }) // no punch
att.push({ employee_id: 'e3', date: day(5), status: 'P', check_in_time: null })  // Pune: excluded
att.push({ employee_id: 'e2', date: day(12), status: 'A', check_in_time: ci })   // punched but absent
att.push({ employee_id: 'e6', date: day(1), status: 'P', check_in_time: null })  // not in run
att.push({ employee_id: 'e2', date: day(14), status: 'WO', check_in_time: null }) // WO ignored

const w = computeRunWarnings({ attendance: att, employees, inputs })
const get = (c: string, t: string) => w.find((r) => r.employee_code === c && r.warning_type === t)
const lateOf = (c: string) => w.filter((r) => r.employee_code === c && r.warning_type === 'late_excess')

check('<=30 ignored, every >30 flagged', lateOf('VFL1').length === 3 && lateOf('VFL1').map((r) => r.detail.date).join() === [day(2), day(3), day(4)].join())
check('last late detail shape', JSON.stringify(lateOf('VFL1')[2].detail) ===
  JSON.stringify({ date: day(4), late_minutes: 50, late_reason: 'bus broke down', kind: 'over_30', nth_over_30: 3, deduct_eligible: false }),
  JSON.stringify(lateOf('VFL1')[2].detail))
check('exactly 3 lates of 30 min not flagged', lateOf('VFL2').length === 0)
check('no_punch detected with dates', JSON.stringify(get('VFL2', 'no_punch')?.detail) === JSON.stringify({ count: 1, dates: [day(10)] }))
check('Pune excluded from no_punch', !get('VFL3', 'no_punch'))
check('punched_absent detected', JSON.stringify(get('VFL2', 'punched_absent')?.detail) === JSON.stringify({ count: 1, dates: [day(12)] }))
check('employee outside run ignored', !w.some((r) => r.employee_code === 'VFL6'))
check('missing_efficiency for worker without entry', !!get('VFL4', 'missing_efficiency'))
check('no missing_efficiency when entry exists', !get('VFL5', 'missing_efficiency'))
check('missing_efficiency only for workers', !w.some((r) => r.warning_type === 'missing_efficiency' && r.employee_code !== 'VFL4'))
check('idempotent', JSON.stringify(computeRunWarnings({ attendance: att, employees, inputs })) === JSON.stringify(w))
check('countByType', JSON.stringify(countByType(w)) === JSON.stringify({ late_excess: 3, no_punch: 1, punched_absent: 1, missing_efficiency: 1 }), JSON.stringify(countByType(w)))
check('no warnings on empty', computeRunWarnings({ attendance: [], employees: [], inputs: [] }).length === 0)

// ---- late rule boundaries (fresh employee each case)
const lateRun = (mins: number[], reasons: (string | null)[] = []) => {
  const a: AttendanceRow[] = mins.map((m, i) => ({ employee_id: 'e1', date: day(i + 1), status: 'L', check_in_time: ci, late_minutes: m, late_reason: reasons[i] ?? null }))
  return computeRunWarnings({ attendance: a, employees, inputs: [{ empCode: 'VFL1', category: 'STAFF' }] })
    .filter((r) => r.warning_type === 'late_excess')
}
check('30 min is free', lateRun([30]).length === 0)
check('31 min flagged, nth 1, not eligible', (() => { const r = lateRun([31]); return r.length === 1 && r[0].detail.kind === 'over_30' && r[0].detail.nth_over_30 === 1 && r[0].detail.deduct_eligible === false })())
check('no legacy fields', !('nth_free_late' in lateRun([31])[0].detail) && lateRun([31])[0].detail.kind !== 'over_free_quota')
check('any number of <=30 lates never flagged', lateRun([5, 6, 7, 8, 30, 29, 1]).length === 0)
check('5 mixed lates: <=30 ignored and not counted in nth', (() => {
  const r = lateRun([40, 10, 35, 30, 60]) // days 1..5; flagged: d1(40) d3(35) d5(60)
  return r.length === 3 && r.map((x) => x.detail.nth_over_30).join() === '1,2,3' && r.map((x) => x.detail.date).join() === [day(1), day(3), day(5)].join()
})())
check('deduct_eligible exactly from the 4th', (() => {
  const r = lateRun([40, 41, 42, 43, 44, 45])
  return r.map((x) => x.detail.deduct_eligible).join() === 'false,false,false,true,true,true' && r.map((x) => x.detail.nth_over_30).join() === '1,2,3,4,5,6'
})())
check('mixed order by date not input order', (() => {
  const a: AttendanceRow[] = [
    { employee_id: 'e1', date: day(9), status: 'L', check_in_time: ci, late_minutes: 50 },
    { employee_id: 'e1', date: day(1), status: 'L', check_in_time: ci, late_minutes: 40 },
    { employee_id: 'e1', date: day(5), status: 'L', check_in_time: ci, late_minutes: 45 },
  ]
  const r = computeRunWarnings({ attendance: a, employees, inputs: [{ empCode: 'VFL1', category: 'STAFF' }] })
  return r.map((x) => `${x.detail.date}:${x.detail.nth_over_30}`).join() === `${day(1)}:1,${day(5)}:2,${day(9)}:3`
})())
check('late_minutes 0 / null ignored', lateRun([0, 0, 0, 0, 0]).length === 0)
check('reason carried, null when absent', lateRun([40], ['traffic'])[0].detail.late_reason === 'traffic' && lateRun([40])[0].detail.late_reason === null)
check('status P with late_minutes still counts (rule is minutes-based)', (() => {
  const a: AttendanceRow[] = [{ employee_id: 'e1', date: day(1), status: 'P', check_in_time: ci, late_minutes: 45 }]
  return computeRunWarnings({ attendance: a, employees, inputs: [{ empCode: 'VFL1', category: 'STAFF' }] }).length === 1
})())
check('multiple flagged rows are distinct keys', new Set(lateRun([40, 50, 60]).map((r) => warningKey(r))).size === 3)

// ---- idempotent sync diff
const desired = lateRun([40, 5, 6, 7, 8, 50]) // day1 (nth 1), day6 (nth 2)
const ex = (id: string, r: any, decision: string) => ({ id, employee_code: r.employee_code, warning_type: r.warning_type, detail: r.detail, decision })
check('diff: empty table inserts all', diffWarnings([], desired).toInsert.length === 2 && diffWarnings([], desired).toDeleteIds.length === 0)
check('diff: existing rows not re-inserted', diffWarnings([ex('a', desired[0], 'waived'), ex('b', desired[1], 'pending')], desired).toInsert.length === 0)
check('diff: unchanged pending row -> no update', diffWarnings([ex('b', desired[1], 'pending')], desired).toUpdate.length === 0)
const stale = { employee_code: 'VFL1', warning_type: 'late_excess', detail: { date: day(20) } }
check('diff: stale pending deleted', JSON.stringify(diffWarnings([ex('a', desired[0], 'pending'), ex('z', stale, 'pending')], desired).toDeleteIds) === '["z"]')
check('diff: stale decided never deleted', diffWarnings([ex('z', stale, 'deduct')], desired).toDeleteIds.length === 0)
const oldFmt = { employee_code: 'VFL1', warning_type: 'late_excess', detail: { date: day(1), late_minutes: 40, late_reason: null, kind: 'over_free_quota', nth_free_late: 4 } }
check('diff: old-format pending (same date) refreshed to new detail', (() => {
  const d = diffWarnings([ex('o', oldFmt, 'pending')], desired)
  return d.toUpdate.length === 1 && d.toUpdate[0].id === 'o' && (d.toUpdate[0].detail as any).kind === 'over_30'
})())
check('diff: old-format decided row left alone', (() => {
  const d = diffWarnings([ex('o', oldFmt, 'waived')], desired)
  return d.toUpdate.length === 0 && d.toDeleteIds.length === 0
})())
check('diff: old-format pending on a no-longer-late date is deleted', (() => {
  const o = { ...oldFmt, detail: { ...oldFmt.detail, date: day(4) } }
  return diffWarnings([ex('o', o, 'pending')], desired).toDeleteIds[0] === 'o'
})())
check('diff: nth change refreshes pending row', (() => {
  const d1 = lateRun([40, 50]) // nth 1,2
  const was = { ...d1[1], detail: { ...d1[1].detail, nth_over_30: 1, deduct_eligible: false } }
  const d = diffWarnings([ex('n', was, 'pending')], d1)
  return d.toUpdate.length === 1 && (d.toUpdate[0].detail as any).nth_over_30 === 2
})())
check('diff: undated key ignores detail', warningKey({ employee_code: 'X', warning_type: 'no_punch', detail: { dates: ['a'] } }) === warningKey({ employee_code: 'X', warning_type: 'no_punch', detail: { dates: ['b'] } }))
check('diff: legacy late_excess without date is stale', diffWarnings([ex('old', { employee_code: 'VFL1', warning_type: 'late_excess', detail: { late_days: 4 } }, 'pending')], desired).toDeleteIds[0] === 'old')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
