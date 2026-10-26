/**
 * Forge OS — payslip PDF generator.
 *
 * Builds the payslip HTML in the layout of the owner's saved Staff / Worker
 * slip templates (company header, identity block, attendance block, side by
 * side Earnings | Deductions table, net payable + words, IDs and leave
 * balances) and prints it with expo-print (HTML -> PDF) so the same template
 * works on Android and iOS without a native PDF library.
 */

import * as Print from 'expo-print'
import type { Employee, PayrollRecord } from '../types'
import { buildSlipView, formatInr, type SlipRow } from './payslipLayout'

const COMPANY = 'VARSHA FORGINGS PVT LTD'
const ADDRESS = 'B7, M.I.D.C AREA, WALUJ, AURANGABAD.'

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function pairedRows(earn: SlipRow[], ded: SlipRow[]): string {
  const n = Math.max(earn.length, ded.length)
  let out = ''
  for (let i = 0; i < n; i++) {
    const e = earn[i]
    const d = ded[i]
    out += `<tr>
      <td class="l">${e ? esc(e.label.en) : ''}</td>
      <td class="r">${e?.rate ? esc(e.rate) + ' hrs' : ''}</td>
      <td class="r">${e ? formatInr(e.amount) : ''}</td>
      <td class="l">${d ? esc(d.label.en) : ''}</td>
      <td class="r">${d ? formatInr(d.amount) : ''}</td>
    </tr>`
  }
  return out
}

/** Builds the payslip HTML for one employee/month's payroll record. */
export function payslipHtml(employee: Employee, record: PayrollRecord): string {
  const v = buildSlipView(record, {
    name: employee.name,
    empCode: employee.emp_code,
    department: employee.department,
  })

  const attendance = v.attendance.length
    ? `<table class="grid"><tr>${v.attendance.map((c) => `<th>${esc(c.label.en)}</th>`).join('')}</tr>
        <tr>${v.attendance.map((c) => `<td class="c${c.strong ? ' b' : ''}">${esc(c.value)}</td>`).join('')}</tr></table>`
    : ''

  const footCells = (cells: { label: { en: string }; value: string }[]) =>
    cells.map((c) => `<tr><th class="l">${esc(c.label.en)}</th><td class="l">${esc(c.value)}</td></tr>`).join('')
  const footer = v.idCells.length || v.leaveCells.length
    ? `<table class="grid foot"><tr>
        <td class="half"><table class="inner">${footCells(v.idCells)}</table></td>
        <td class="half"><table class="inner">${footCells(v.leaveCells)}</table></td>
      </tr></table>`
    : ''

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4; margin: 12mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; margin: 0; }
      .head { text-align: center; margin-bottom: 8px; }
      .company { font-size: 18px; font-weight: bold; }
      .period { font-size: 13px; font-weight: bold; margin-top: 6px; }
      table { width: 100%; border-collapse: collapse; margin: 6px 0; table-layout: fixed; }
      th, td { border: 1px solid #999; padding: 4px 6px; word-wrap: break-word; overflow-wrap: anywhere; }
      th { background: #f3f4f6; }
      .l { text-align: left; } .r { text-align: right; } .c { text-align: center; } .b { font-weight: bold; }
      .tot td { font-weight: bold; background: #f3f4f6; }
      .net td { font-size: 13px; font-weight: bold; }
      .words { font-style: italic; }
      .inner { margin: 0; } .inner th, .inner td { border: none; padding: 2px 4px; }
      .half { width: 50%; vertical-align: top; }
      .note { font-size: 9px; font-style: italic; margin-top: 8px; color: #444; }
    </style>
  </head>
  <body>
    <div class="head">
      <div class="company">${COMPANY}</div>
      <div>${ADDRESS}</div>
      <div class="period">Payment Slip For The Month Of ${esc(v.period)}</div>
    </div>
    <table class="grid">
      <tr><th class="l" style="width:18%">Name</th><td class="l" style="width:32%">${esc(v.name)}</td>
          <th class="l" style="width:18%">Emp ID</th><td class="l" style="width:32%">${esc(v.empCode)}</td></tr>
      <tr><th class="l">Department</th><td class="l">${esc(v.department)}</td>
          <th class="l">Designation</th><td class="l">${esc(v.designation)}</td></tr>
      ${v.doj ? `<tr><th class="l">Date of Joining</th><td class="l">${esc(v.doj)}</td><td></td><td></td></tr>` : ''}
    </table>
    ${attendance}
    <table class="grid">
      <tr><th style="width:30%">EARNINGS</th><th style="width:12%">Rate (Rs.) / Hrs</th><th style="width:16%">Earned (Rs.)</th>
          <th style="width:28%">EMPLOYEE CASH DEDUCTIONS</th><th style="width:14%">Amount (Rs.)</th></tr>
      ${pairedRows(v.earnings, v.deductions)}
      <tr class="tot"><td class="l">Gross Earnings</td><td></td><td class="r">${formatInr(v.totalEarnings)}</td>
          <td class="l">Total Deductions</td><td class="r">${formatInr(v.totalDeductions)}</td></tr>
    </table>
    <table class="grid net">
      ${v.adjustment ? `<tr><td class="l" style="font-weight:normal">Adjustment / rounding</td><td class="r" style="font-weight:normal">${formatInr(v.adjustment)}</td></tr>` : ''}
      <tr><td class="l">NET PAYABLE (Rs.)</td><td class="r">${formatInr(v.netPay)}</td></tr>
      <tr><td class="l words" colspan="2" style="font-weight:normal">In words: ${esc(v.netInWords)}</td></tr>
    </table>
    ${footer}
    <div class="note">Amounts in Indian Rupees. Shows employee cash earnings and deductions only; employer contributions and provisions are not part of this slip.</div>
  </body>
</html>`
}

/** Renders the payslip PDF on-device and returns its local file URI. */
export async function generatePayslip(employee: Employee, record: PayrollRecord): Promise<string> {
  const html = payslipHtml(employee, record)
  const { uri } = await Print.printToFileAsync({ html })
  return uri
}
