/** Export CSV unit test — no DB, fabricated rows. Run: npx tsx scripts/payroll-export.test.ts */
import { buildSalarySheetCsv, buildBankFileCsv } from '../lib/payroll/exportCsv'

let pass = 0, fail = 0
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ok  ${n}`)) : (fail++, console.log(`FAIL  ${n} ${d}`)) }

const rows: any[] = [
  { empCode: 'VFL1002', name: 'Rao, "Ravi" K', category: 'STAFF', worked: 26, earnings: { BASIC: 1000, HRA: 400 }, deductions: { PF: 120 }, totalEarnings: 1400, totalDeductions: 120, netPay: 1280 },
  { empCode: 'VFL1001', name: 'Plain', category: 'WORKER', worked: 25, earnings: { BASIC: 900, OT: 50.5 }, deductions: { PT: 200 }, totalEarnings: 950.5, totalDeductions: 200, netPay: 750.5 },
  { empCode: 'VFL1010', name: 'Lean', netPay: 0 }, // historical/lean snapshot
  { empCode: 'VFL1009', name: 'NoBank', netPay: 500, earnings: null, deductions: null },
]
const sheet = buildSalarySheetCsv(rows)
const lines = sheet.replace(/^﻿/, '').trim().split('\r\n')
check('BOM present', sheet.charCodeAt(0) === 0xFEFF)
check('header union + order', lines[0] === 'Emp Code,Name,Category,Days Worked,BASIC,HRA,OT,Total Earnings,PF,PT,Total Deductions,Net Pay', lines[0])
check('quoting comma+quote', lines.some((l) => l.includes('"Rao, ""Ravi"" K"')))
check('sorted by emp code', lines[1].startsWith('VFL1001') && lines[2].startsWith('VFL1002') && lines[4].startsWith('VFL1010'), lines.map((l) => l.slice(0, 7)).join('|'))
check('missing key -> 0.00', lines[2].includes(',1000.00,400.00,0.00,'))
check('2-decimal numbers', lines[1].includes('950.50') && lines[1].endsWith('750.50'))
let threw = false
try { buildSalarySheetCsv([{ empCode: 'X', name: 'Y' } as any, undefined as any].filter(Boolean)); buildSalarySheetCsv([]) } catch { threw = true }
check('lean rows do not throw', !threw)
check('formula injection neutralised', buildSalarySheetCsv([{ empCode: 'A', name: '=cmd()' }]).includes("'=cmd()"))

const bank: any[] = [
  { empCode: 'VFL1003', name: 'Zero', netPay: 0, bankName: 'B', accountNo: '1', ifsc: 'I' },
  { empCode: 'VFL1002', name: 'NoAcct', netPay: 100, bankName: null, accountNo: null, ifsc: null },
  { empCode: 'VFL1001', name: 'Ok', netPay: 250.5, bankName: 'Test Bank', accountNo: '000', ifsc: 'TEST0000001' },
  { empCode: 'VFL1004', name: 'Neg', netPay: -5, bankName: 'B', accountNo: '1', ifsc: 'I' },
]
const b = buildBankFileCsv(bank, 10, 2026)
const bl = b.csv.replace(/^﻿/, '').trim().split('\r\n')
check('bank BOM', b.csv.charCodeAt(0) === 0xFEFF)
check('bank header', bl[0] === 'Emp Code,Name,Bank Name,Account No,IFSC,Net Pay,Narration')
check('netPay<=0 excluded', bl.length === 3 && !b.csv.includes('VFL1003') && !b.csv.includes('VFL1004'))
check('sorted', bl[1].startsWith('VFL1001') && bl[2].startsWith('VFL1002'))
check('missing bank emitted with empty cells', bl[2] === 'VFL1002,NoAcct,,,,100.00,Salary Oct 2026', bl[2])
check('missingBank list', b.missingBank.length === 1 && b.missingBank[0] === 'VFL1002')
check('narration', bl[1].endsWith('250.50,Salary Oct 2026'))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
