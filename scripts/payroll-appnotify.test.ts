/** payslip_ready pure parts. Run: npx tsx scripts/payroll-appnotify.test.ts */
import { monthLabelEn, monthLabelHi, buildPayslipRows, chunk, notifyPayslipReady } from '../supabase/functions/payroll-run/lib/appNotify.ts'

let pass = 0, fail = 0
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ok  ${n}`)) : (fail++, console.log(`FAIL  ${n} ${d}`)) }

check('month label EN', monthLabelEn(10, 2026) === 'October 2026')
check('month label HI', monthLabelHi(10, 2026) === 'अक्टूबर 2026')
check('month labels cover 12', [1,2,3,4,5,6,7,8,9,10,11,12].every((m) => monthLabelEn(m, 2026) && monthLabelHi(m, 2026) && !monthLabelEn(m, 2026).startsWith('undefined')))
const rows = buildPayslipRows(['A', 'B', 'A'], 'run1', 10, 2026)
check('dedupes codes', rows.length === 2)
check('row shape', rows[0].type === 'payslip_ready' && rows[0].title_en === 'Payslip ready' && rows[0].body_en === 'Your payslip for October 2026 is ready.'
  && JSON.stringify(rows[0].payload) === JSON.stringify({ run_id: 'run1', month: 10, year: 2026 }))
check('chunk 100', chunk(Array.from({ length: 250 }, (_, i) => i), 100).map((c) => c.length).join() === '100,100,50')

async function main() {
// idempotent skip + never throws
const fakeExisting: any = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: [{ id: 1 }], error: null }) }) }) }) }) }
const r1 = await notifyPayslipReady(fakeExisting, 'http://x', 'run1', 10, 2026)
check('skips when already notified', r1.skipped === 'already notified' && r1.inserted === 0)
const r2 = await notifyPayslipReady({ from: () => { throw new Error('boom') } }, 'http://x', 'run1', 10, 2026)
check('never throws', !!r2.error && r2.inserted === 0)
}
main().then(() => {
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
})
