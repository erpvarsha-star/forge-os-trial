/** Statutory reports unit test — no DB, fabricated rows. Run: npx tsx scripts/statutory-reports.test.ts */
import {
  mergeRows, buildPfEcr, ecrRowFor, ecrLine, ncpDaysFor, pfWageOf,
  buildEsi, esiContribution, isEsiEligible,
  expectedPt, buildPt,
  buildMlwf, isMlwfMonth, mlwfHalfYearMonths,
  StatRow, statutoryWages,
} from '../lib/statutory'

let pass = 0, fail = 0
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ok  ${n}`)) : (fail++, console.log(`FAIL  ${n} ${d}`)) }

const staff = (code: string, wage: number, extra: Partial<StatRow> = {}): StatRow => ({
  empCode: code, name: `N ${code}`, category: 'STAFF', uan: '100000000001', esiNo: '1234567890', worked: 30,
  earnings: { BASIC: wage * 0.5, CONVEYANCE: wage * 0.2, EDUCATION: wage * 0.2, MEDICAL: wage * 0.1, HRA: 999 },
  deductions: { PF: Math.round(0.12 * Math.min(wage, 15000)), PT: 200 },
  totalEarnings: wage + 999, ...extra,
})

// ---- S1 PF ECR ----
check('pf wage = BASIC+CONV+EDU+MED only', pfWageOf({ BASIC: 100, CONVEYANCE: 10, EDUCATION: 5, MEDICAL: 1, HRA: 500, OT: 9 }) === 116)
{
  const e = ecrRowFor(staff('A1', 15000), 30)
  check('wage exactly 15000: EPF=EPS=EDLI=15000', e.epfWages === 15000 && e.epsWages === 15000 && e.edliWages === 15000)
  check('wage 15000: EE 1800, EPS 1250, diff 550', e.epfEe === 1800 && e.eps === 1250 && e.epfEpsDiff === 550, JSON.stringify(e))
}
{
  const r = staff('A2', 15001); r.deductions!.PF = Math.round(0.12 * 15001)
  const e = ecrRowFor(r, 30)
  check('wage 15001: EPF wages 15001, EPS/EDLI capped 15000', e.epfWages === 15001 && e.epsWages === 15000 && e.edliWages === 15000)
  check('wage 15001: EE = round(12%)=1800, EPS 1250', e.epfEe === 1800 && e.eps === 1250, JSON.stringify(e))
}
{
  const r = staff('A3', 22000); r.deductions!.PF = 1800 // payroll capped flat 1800 above ceiling
  const e = ecrRowFor(r, 30)
  check('capped PF above ceiling: EPF wages reported capped, no mismatch', e.epfWages === 15000 && e.epfEe === 1800 && !e.pfMismatch, JSON.stringify(e))
}
{
  const r = staff('A4', 10000); r.deductions!.PF = 500
  check('unexplained PF amount flagged as mismatch', ecrRowFor(r, 30).pfMismatch === true)
  const e = ecrRowFor(staff('A5', 10000), 30)
  check('10000: EE 1200, EPS round(833)=833, diff 367', e.epfEe === 1200 && e.eps === 833 && e.epfEpsDiff === 367, JSON.stringify(e))
}
{
  const e = ecrRowFor(staff('A6', 7000), 30)
  check('EPS rounding nearest: 8.33% of 7000 = 583.1 -> 583', e.eps === 583)
  const hi = ecrRowFor({ ...staff('A7', 1000), earnings: { BASIC: 6006 }, deductions: { PF: 721 } }, 30)
  check('EPS rounds half up to nearest (6006*.0833=500.3 -> 500)', hi.eps === 500, String(hi.eps))
}
{
  const e = ecrRowFor(staff('A1', 15000), 30)
  const ln = ecrLine(e)
  const cols = ln.split('#~#')
  check('ECR line has 11 columns', cols.length === 11, ln)
  check('ECR column order', cols[0] === '100000000001' && cols[1] === 'N A1' && cols[2] === '15999' && cols[3] === '15000' && cols[4] === '15000' && cols[5] === '15000' && cols[6] === '1800' && cols[7] === '1250' && cols[8] === '550' && cols[9] === '0' && cols[10] === '0', ln)
  const nm = ecrLine({ ...e, name: 'A#~#B\nC' })
  check('separator/newline in name neutralised', nm.split('#~#').length === 11 && !nm.includes('\n'))
}
{
  const res = buildPfEcr([
    staff('B1', 15000),
    staff('B2', 12000, { uan: '' }),
    staff('B3', 9000, { uan: null }),
    { ...staff('B4', 9000), deductions: { PF: 0 } },
    { ...staff('B5', 9000), deductions: {} },
  ], 30)
  check('ECR: 1 member line, no header, CRLF', res.rows.length === 1 && res.text === ecrLine(res.rows[0]) + '\r\n' && !res.text.includes('UAN'))
  check('missing UAN listed, not dropped silently', res.missingUan.join() === 'B2,B3')
  check('no-PF employees counted as not covered', res.notCovered === 2)
  check('empty ECR yields empty text', buildPfEcr([], 30).text === '')
}
check('NCP: staff calendar days - worked', ncpDaysFor('STAFF', 26, 30) === 4)
check('NCP: worked > days never negative', ncpDaysFor('PUNE_STAFF', 31, 30) === 0)
check('NCP: worker not derivable -> 0', ncpDaysFor('PERMANENT_WORKER', 20, 30) === 0)
check('NCP wired into ECR row', ecrRowFor(staff('C1', 15000, { worked: 24 }), 30).ncpDays === 6)

// ---- S2 ESI ----
check('ESI eligible 21000', isEsiEligible(21000) === true)
check('ESI not eligible 21001', isEsiEligible(21001) === false)
check('ESI IP 0.75% rounded UP: 10001 -> 76 (75.0075)', esiContribution(10001, 75) === 76)
check('ESI IP exact: 20000 -> 150 (no float overshoot)', esiContribution(20000, 75) === 150)
check('ESI ER 3.25% rounded UP: 10001 -> 326', esiContribution(10001, 325) === 326)
check('ESI ER exact: 20000 -> 650', esiContribution(20000, 325) === 650)
{
  const mk = (code: string, gross: number, esi: number, esiNo: string | null): StatRow => ({
    empCode: code, name: `E ${code}`, worked: 26, totalEarnings: gross, esiNo, deductions: { ESI: esi },
  })
  const r = buildEsi([mk('E1', 21000, 157.5, '111'), mk('E2', 21001, 0, '222'), mk('E3', 15000, 112.5, null), mk('E4', 9000, 67.5, '333')])
  check('ESI covered by deduction>0 only', r.rows.map((x) => x.empCode).join() === 'E1,E4')
  check('ESI missing ESI no listed', r.missingEsiNo.join() === 'E3')
  const lines = r.csv.replace(/^﻿/, '').trim().split('\r\n')
  check('ESI header', lines[0] === 'IP Number,IP Name,No of Days,Total Monthly Wages,Reason Code,Last Working Day,IP Contribution,Employer Contribution', lines[0])
  check('ESI row: blanks for reason/last day, rounded up', lines[1] === '111,E E1,26,21000,,,158,683', lines[1])
  check('ESI totals separate', r.totals.wages === 30000 && r.totals.ip === 158 + 68 && r.totals.er === 683 + 293 && r.totals.members === 2, JSON.stringify(r.totals))
}

// ---- S3 PT ----
check('PT 7500 -> 0', expectedPt(7500, 10, false) === 0)
check('PT 7501 -> 175', expectedPt(7501, 10, false) === 175)
check('PT 10000 -> 175', expectedPt(10000, 10, false) === 175)
check('PT 10001 -> 200', expectedPt(10001, 10, false) === 200)
check('PT February 10001 -> 300', expectedPt(10001, 2, false) === 300)
check('PT February 10000 still 175', expectedPt(10000, 2, false) === 175)
check('PT female 25000 exempt', expectedPt(25000, 10, true) === 0)
check('PT female 25001 pays 200', expectedPt(25001, 10, true) === 200)
check('PT female 9000 exempt (<=25000)', expectedPt(9000, 10, true) === 0)
check('PT explicit exemption', expectedPt(50000, 10, false, true) === 0)
{
  const rows: StatRow[] = [
    { empCode: 'P1', name: 'ok', category: 'STAFF', gender: 'male', totalEarnings: 12000, deductions: { PT: 200 } },
    { empCode: 'P2', name: 'bad', category: 'STAFF', gender: 'male', totalEarnings: 9000, deductions: { PT: 200 } },
    { empCode: 'P3', name: 'woman', category: 'STAFF', gender: 'female', totalEarnings: 20000, deductions: { PT: 200 } },
    { empCode: 'P4', name: 'none', category: 'STAFF', gender: 'male', totalEarnings: 5000, deductions: { PT: 0 } },
    { empCode: 'P5', name: 'cons', category: 'CONSULTANT', gender: 'male', totalEarnings: 30000, deductions: {} },
  ]
  const r = buildPt(rows, 10)
  check('PT rows exclude zero/zero and consultants', r.rows.map((x) => x.empCode).join() === 'P1,P2,P3')
  check('PT mismatch flagged (P2 slab 175, P3 woman exempt)', r.mismatches.join() === 'P2,P3', r.mismatches.join())
  check('PT totals', r.totals.pt === 600 && r.totals.expected === 200 + 175 + 0, JSON.stringify(r.totals))
  const l = r.csv.replace(/^﻿/, '').trim().split('\r\n')
  check('PT csv header + total row', l[0] === 'Emp Code,Name,Gross,PT Deducted,Expected PT,Mismatch' && l[l.length - 1].startsWith('TOTAL,'), l[l.length - 1])
  check('PT csv mismatch column', l[2].endsWith('MISMATCH') && !l[1].endsWith('MISMATCH'))
  const feb = buildPt([{ empCode: 'F1', name: 'f', category: 'STAFF', gender: 'male', totalEarnings: 20000, deductions: { PT: 300 } }], 2)
  check('PT February 300 matches, no mismatch', feb.mismatches.length === 0)
}

// ---- S4 MLWF ----
check('MLWF payable only June/December', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(isMlwfMonth).join() === '6,12')
check('MLWF half-year June = 1..6', mlwfHalfYearMonths(6).join() === '1,2,3,4,5,6')
check('MLWF half-year Dec = 7..12', mlwfHalfYearMonths(12).join() === '7,8,9,10,11,12')
check('MLWF non-payable month -> no months', mlwfHalfYearMonths(7).length === 0)
{
  const m = (code: string, amt: number): StatRow => ({ empCode: code, name: `M ${code}`, deductions: { MLWF: amt } })
  const r = buildMlwf({ 6: [m('W1', 25), m('W2', 0)], 5: [m('W1', 10)], 7: [m('W9', 25)] }, 6)
  check('MLWF lists only deducted, within half-year, sums', r.rows.length === 1 && r.rows[0].empCode === 'W1' && r.rows[0].total === 35 && r.totals.amount === 35, JSON.stringify(r.totals))
  check('MLWF out-of-half-year month ignored', !r.csv.includes('W9'))
  check('MLWF payable flag', r.payable === true && buildMlwf({}, 7).payable === false && buildMlwf({}, 7).rows.length === 0)
}

// ---- merge (top-up runs) ----
{
  const m = mergeRows([
    { empCode: 'V2', name: 'b', worked: 10, totalEarnings: 100, earnings: { BASIC: 60 }, deductions: { PF: 7.2 } },
    { empCode: 'V1', name: 'a', worked: 20, totalEarnings: 200.5, earnings: { BASIC: 100.1 }, deductions: { PF: 12 } },
    { empCode: 'V1', name: 'a', worked: 6, totalEarnings: 50, earnings: { BASIC: 30, MEDICAL: 5 }, deductions: { PF: 3.6, PT: 200 } },
  ])
  check('merge: one row per employee, sorted', m.length === 2 && m[0].empCode === 'V1')
  check('merge: amounts summed', m[0].worked === 26 && m[0].totalEarnings === 250.5 && m[0].earnings!.BASIC === 130.1 && m[0].earnings!.MEDICAL === 5 && m[0].deductions!.PF === 15.6 && m[0].deductions!.PT === 200, JSON.stringify(m[0]))
  check('merge tolerates lean rows', mergeRows([{ empCode: 'X', name: 'x' }, undefined as any]).length === 1)
}

// ---- extras excluded from statutory wages (owner decision 27 Oct 2026) ----
{
  check('statutoryWages subtracts extras', statutoryWages({ totalEarnings: 25000, extraEarningsTotal: 4000 }) === 21000)
  check('statutoryWages no extras unchanged', statutoryWages({ totalEarnings: 25000 }) === 25000 && statutoryWages({ totalEarnings: 25000, extraEarningsTotal: null }) === 25000)
  check('statutoryWages never negative', statutoryWages({ totalEarnings: 100, extraEarningsTotal: 500 }) === 0)
  const mkE = (extra?: number): StatRow => ({ empCode: 'X1', name: 'x', worked: 26, totalEarnings: 25000, extraEarningsTotal: extra, esiNo: '1', deductions: { ESI: 100 } })
  const withX = buildEsi([mkE(4000)]), noX = buildEsi([mkE(undefined)])
  check('ESI wages exclude extras', withX.csv.includes('21000') && !withX.csv.includes('25000'), withX.csv)
  check('ESI wages unchanged without extras', noX.csv.includes('25000'), noX.csv)
  const ptRows = [{ empCode: 'P9', name: 'p', category: 'STAFF', gender: 'male', totalEarnings: 12000, extraEarningsTotal: 4000, deductions: { PT: 200 } }]
  const ptR = buildPt(ptRows as StatRow[], 9)
  check('PT gross excludes extras (8000 -> expected 175, deducted 200 flagged)', JSON.stringify(ptR).includes('8000') || JSON.stringify(ptR).includes('175'), JSON.stringify(ptR).slice(0, 300))
  const pfR = buildPfEcr([{ empCode: 'F9', name: 'f', uan: '100000000001', worked: 26, totalEarnings: 30000, extraEarningsTotal: 5000, earnings: { BASIC: 12000 }, deductions: { PF: 1440 } }], 30)
  check('PF gross wages exclude extras', pfR.text.includes('25000') && !pfR.text.includes('30000'), pfR.text)
  const mg = mergeRows([{ empCode: 'M', name: 'm', totalEarnings: 100, extraEarningsTotal: 10 }, { empCode: 'M', name: 'm', totalEarnings: 50, extraEarningsTotal: 5 }])
  check('merge sums extraEarningsTotal', mg[0].extraEarningsTotal === 15 && mg[0].totalEarnings === 150)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
