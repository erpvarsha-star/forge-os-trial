// Run: npx tsx scripts/payslip-totals.test.ts  (synthetic numbers only)
import { buildSlipView } from '../lib/payslipLayout'
import type { PayrollRecord } from '../types'

let passed = 0
let failed = 0
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else { failed++; console.error('FAIL', msg) } }

const rec = (category: string, e: Record<string, number>, d: Record<string, number>, net: number, snapTotE?: number): PayrollRecord =>
  ({ id: 'x', employee_id: 'e', month: '10', year: 2026, net_pay: net, earnings_lines: e, deduction_lines: d,
     category, total_earnings: snapTotE, total_deductions: 0 }) as unknown as PayrollRecord
const id = { name: 'T', empCode: 'X1' }

// Staff: snapshot totalEarnings excludes OT, net includes it.
{
  const v = buildSlipView(rec('STAFF', { BASIC: 10000, HRA: 4000, OT: 1000 }, { PF: 1200, PT: 200 }, 13600, 14000), id)
  ok(v.totalEarnings === 15000, 'staff excl: gross is sum of printed lines')
  ok(v.totalDeductions === 1400, 'staff excl: deductions sum')
  ok(v.adjustment === 0, 'staff excl: balances, no adjustment')
}
// Staff: snapshot totalEarnings includes OT.
{
  const v = buildSlipView(rec('STAFF', { BASIC: 10000, HRA: 4000, OT: 1000 }, { PF: 1200 }, 13800, 15000), id)
  ok(v.totalEarnings === 15000 && v.adjustment === 0, 'staff incl: balanced')
}
// Worker consistent.
{
  const v = buildSlipView(rec('PERMANENT_WORKER', { BASIC: 9000, VDA: 1000, OT: 500 }, { PF: 1080, ESI: 79 }, 9341), id)
  ok(v.totalEarnings === 10500 && v.totalDeductions === 1159 && v.adjustment === 0, 'worker consistent')
}
// Consultant, no deductions.
{
  const v = buildSlipView(rec('CONSULTANT', { GROSS: 30000, OT: 500 }, {}, 30500), id)
  ok(v.totalEarnings === 30500 && v.totalDeductions === 0 && v.adjustment === 0, 'consultant no deductions')
}
// Pune: net exceeds gross - deductions (extra allowance in net) -> positive adjustment.
{
  const v = buildSlipView(rec('PUNE_STAFF', { GROSS: 25000 }, { PF: 1800 }, 24200), id)
  ok(v.adjustment === 1000, 'pune positive adjustment 1000')
  const w = buildSlipView(rec('PUNE_STAFF', { GROSS: 25000 }, { PF: 1800 }, 22000), id)
  ok(w.adjustment === -1200, 'negative adjustment sign')
}
// Rounding rules.
{
  const a = buildSlipView(rec('STAFF', { BASIC: 1000 }, { PF: 100 }, 900.4), id)
  ok(a.adjustment === 0, '0.4 rounds to nothing, no line')
  const b = buildSlipView(rec('STAFF', { BASIC: 1000 }, { PF: 100 }, 900.8), id)
  ok(b.adjustment === 0.8, '0.8 shown (non-zero at whole-rupee display), paise kept')
  const c = buildSlipView(rec('STAFF', { BASIC: 1000 }, { PF: 100 }, 899.5), id)
  ok(c.adjustment === -0.5, '-0.5 shown')
}
// Unknown key counted in printed gross.
{
  const v = buildSlipView(rec('STAFF', { BASIC: 1000, MYSTERY: 50 }, { PF: 100 }, 950), id)
  ok(v.totalEarnings === 1050 && v.adjustment === 0, 'unknown key included in gross')
}
console.log(`${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
