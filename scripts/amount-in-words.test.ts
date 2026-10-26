// Run: npx tsx scripts/amount-in-words.test.ts
import { amountInWords } from '../lib/amountInWords'

let passed = 0
let failed = 0
const eq = (input: number, expected: string) => {
  const got = amountInWords(input)
  if (got === expected) passed++
  else { failed++; console.error(`FAIL ${input}: got "${got}" expected "${expected}"`) }
}

eq(0, 'Rupees Zero Only')
eq(1, 'Rupees One Only')
eq(19, 'Rupees Nineteen Only')
eq(20, 'Rupees Twenty Only')
eq(99, 'Rupees Ninety Nine Only')
eq(100, 'Rupees One Hundred Only')
eq(101, 'Rupees One Hundred One Only')
eq(999, 'Rupees Nine Hundred Ninety Nine Only')
eq(1000, 'Rupees One Thousand Only')
eq(28400, 'Rupees Twenty Eight Thousand Four Hundred Only')
eq(99999, 'Rupees Ninety Nine Thousand Nine Hundred Ninety Nine Only')
eq(100000, 'Rupees One Lakh Only')
eq(123456, 'Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only')
eq(10000000, 'Rupees One Crore Only')
eq(10000001, 'Rupees One Crore One Only')
eq(1000000000, 'Rupees One Hundred Crore Only')
eq(1.5, 'Rupees One and Fifty Paise Only')
eq(0.05, 'Rupees Zero and Five Paise Only')
eq(28400.25, 'Rupees Twenty Eight Thousand Four Hundred and Twenty Five Paise Only')
eq(100.994, 'Rupees One Hundred and Ninety Nine Paise Only')   // rounds to .99
eq(100.996, 'Rupees One Hundred One Only')                       // rounds up to 101.00
eq(0.004, 'Rupees Zero Only')                                    // rounds to 0
eq(-5, 'Minus Rupees Five Only')

console.log(`${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
