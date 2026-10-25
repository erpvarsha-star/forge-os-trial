/** decide_warning pure helpers. Run: npx tsx scripts/payroll-decide-warning.test.ts */
import {
  buildAdjustmentRow, dayRateFor, deductionSkippedReason, isDeductEligible, lateDeductionAmount,
  LATE_ADJUSTMENT_TYPE, runAction, sourceReference,
} from '../supabase/functions/payroll-run/lib/decideWarning'
import { lateDeductionAmount as srcAmount } from '../lib/payroll/latePolicy'

let pass = 0, fail = 0
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ok  ${n}`)) : (fail++, console.log(`FAIL  ${n} ${d}`)) }
const late = (nth: number, mins = 45) => ({ warning_type: 'late_excess', detail: { date: '2026-10-09', late_minutes: mins, kind: 'over_30', nth_over_30: nth, deduct_eligible: nth >= 4 } })

// amounts
check('45 min @1000 = 94', lateDeductionAmount(45, 1000) === 94, String(lateDeductionAmount(45, 1000)))
check('31 min @800 = 52', lateDeductionAmount(31, 800) === 52)
check('0 min = 0', lateDeductionAmount(0, 800) === 0)
check('bad rate = 0', lateDeductionAmount(40, 0) === 0 && lateDeductionAmount(40, NaN) === 0)
check('480 min = full day', lateDeductionAmount(480, 777) === 777)
check('edge copy matches lib/payroll source', [[45, 1000], [31, 800], [0, 5], [90, 1234.5], [481, 100]].every(([m, r]) => lateDeductionAmount(m, r) === srcAmount(m, r)))

// eligibility
check('late #1-3 not eligible', [1, 2, 3].every((n) => !isDeductEligible(late(n))))
check('late #4,5 eligible', isDeductEligible(late(4)) && isDeductEligible(late(5)))
check('flag without nth not eligible', !isDeductEligible({ warning_type: 'late_excess', detail: { deduct_eligible: true } }))
check('other warning types never eligible', !isDeductEligible({ warning_type: 'no_punch', detail: { deduct_eligible: true, nth_over_30: 9 } }))
check('old-format row not eligible', !isDeductEligible({ warning_type: 'late_excess', detail: { kind: 'over_free_quota', nth_free_late: 4 } }))
check('skip reason on ineligible deduct', deductionSkippedReason(late(2), 'deduct') === 'not eligible (late #2 < 4)')
check('no skip reason when eligible / waived / non-late', deductionSkippedReason(late(4), 'deduct') === null &&
  deductionSkippedReason(late(2), 'waived') === null && deductionSkippedReason({ warning_type: 'no_punch', detail: {} }, 'deduct') === null)

// idempotency key + row
check('source_reference format', sourceReference('abc-123') === 'warning:abc-123')
const row = buildAdjustmentRow({ payrollMonth: '2026-10', employeeId: 'emp', amount: 94, warningId: 'w1', lateMinutes: 45,
  date: '2026-10-09', nth: 4, actorEmployeeId: 'me', nowIso: '2026-10-25T00:00:00.000Z' })
check('row negative amount + approved', row.signed_amount_inr === -94 && row.approval_status === 'approved' && row.adjustment_type === LATE_ADJUSTMENT_TYPE)
check('row month/ref/actors', row.payroll_month === '2026-10' && row.source_reference === 'warning:w1' && row.approved_by === 'me' && row.entered_by === 'me' && row.approved_at === '2026-10-25T00:00:00.000Z')
check('row reason text', row.reason === 'Late arrival deduction: 45 min on 2026-10-09 (late #4 of month)', row.reason)
check('amount sign forced negative', buildAdjustmentRow({ ...{ payrollMonth: 'm', employeeId: 'e', warningId: 'w', lateMinutes: 1, date: 'd', nth: 4, actorEmployeeId: 'a', nowIso: 'n' }, amount: -5 }).signed_amount_inr === -5)
check('same warning -> same idempotency key', sourceReference('w1') === row.source_reference)

// run status handling
check('runAction', runAction('draft') === 'none' && runAction('calculated') === 'reopen' && runAction('in_review') === 'reopen' &&
  runAction('calculating') === 'busy' && ['approved', 'finalized', 'paid', 'archived', 'cancelled', 'payment_file_generated'].every((s) => runAction(s) === 'blocked'))

// day rate (mirrors engine per-day basis)
check('staff = gross / wd', dayRateFor({ category: 'STAFF', workingDays: 26, masters: { FIXED_GROSS: 26000 } }, 103) === 1000)
check('worker = fixed comps / wd + vda', dayRateFor({ category: 'PERMANENT_WORKER', workingDays: 26, masters: { BASIC: 13000, HRA: 0, CONVEYANCE: 0, WASHING: 0, EDUCATION: 0 } }, 100) === 600)
check('worker heat 150 adds 5.78/day', dayRateFor({ category: 'PERMANENT_WORKER', workingDays: 26, masters: { BASIC: 2600, HEAT: 150 } }, 0) === 105.78)
check('consultant daily', dayRateFor({ category: 'CONSULTANT', workingDays: 26, rateProfile: { basis: 'DAILY_RATE', rateAmount: 700 } }, 103) === 700)
check('consultant/pune monthly', dayRateFor({ category: 'PUNE_STAFF', workingDays: 26, rateProfile: { basis: 'MONTHLY_GROSS_PRORATED', monthlyGross: 26000 } }, 103) === 1000)
check('no basis -> 0', dayRateFor({ category: 'STAFF', workingDays: 26 }, 103) === 0 && dayRateFor({ category: 'CONSULTANT', workingDays: 26, rateProfile: { basis: 'DAILY_RATE' } }, 103) === 0 && dayRateFor({ category: 'STAFF', workingDays: 0, masters: { FIXED_GROSS: 1 } }, 1) === 0)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
