/** latePolicy unit test. Run: npx tsx scripts/payroll-latepolicy.test.ts */
import { lateDeductionAmount } from '../lib/payroll/latePolicy'
let pass = 0, fail = 0
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ok  ${n}`)) : (fail++, console.log(`FAIL  ${n} ${d}`)) }
check('480 min = one full day rate', lateDeductionAmount(480, 800) === 800)
check('240 min = half', lateDeductionAmount(240, 800) === 400)
check('45 min of 800', lateDeductionAmount(45, 800) === 75)
check('rounds to whole rupees', lateDeductionAmount(31, 1000) === 65 && lateDeductionAmount(45, 1000) === 94 && lateDeductionAmount(31, 800) === 52, String(lateDeductionAmount(31, 1000)))
check('zero/negative minutes -> 0', lateDeductionAmount(0, 800) === 0 && lateDeductionAmount(-5, 800) === 0)
check('zero rate -> 0', lateDeductionAmount(30, 0) === 0)
check('NaN safe', lateDeductionAmount(NaN, 800) === 0)
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
