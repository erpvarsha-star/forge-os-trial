/**
 * Forge OS — payslip PDF generator.
 *
 * Produces the same payslip HTML app/(worker)/payslip.tsx previously built
 * inline, now shared here so any screen can generate one. Uses expo-print
 * (HTML -> PDF) so the same template works on Android and iOS without a
 * native PDF library.
 */

import * as Print from 'expo-print'
import { APP_CONFIG } from './config'
import type { Employee, PayrollRecord } from '../types'

/** Builds the payslip HTML for one employee/month's payroll record. */
export function payslipHtml(employee: Employee, record: PayrollRecord): string {
  return `
    <html>
      <head><style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #E65C00; padding-bottom: 10px; margin-bottom: 20px; }
        .company { font-size: 20px; font-weight: bold; color: #E65C00; }
        .details { margin-bottom: 20px; }
        .row { display: flex; justify-content: space-between; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f3f4f6; }
        .net { font-size: 18px; font-weight: bold; color: #E65C00; text-align: right; margin-top: 10px; }
      </style></head>
      <body>
        <div class="header">
          <div class="company">${APP_CONFIG.companyName}</div>
          <div>Payslip - ${record.month}/${record.year}</div>
        </div>
        <div class="details">
          <div class="row"><span>Name:</span><span>${employee.name}</span></div>
          <div class="row"><span>Code:</span><span>${employee.emp_code}</span></div>
          <div class="row"><span>Department:</span><span>${employee.department}</span></div>
        </div>
        <table>
          <tr><th>Earnings</th><th>Amount (₹)</th></tr>
          <tr><td>Basic</td><td>${record.basic}</td></tr>
          <tr><td>HRA</td><td>${record.hra}</td></tr>
          <tr><td>Conveyance</td><td>${record.conveyance}</td></tr>
          <tr><td>Special Allowance</td><td>${record.special_allowance}</td></tr>
          <tr><td>Overtime</td><td>${record.overtime}</td></tr>
        </table>
        <table>
          <tr><th>Deductions</th><th>Amount (₹)</th></tr>
          <tr><td>PF</td><td>${record.pf}</td></tr>
          <tr><td>ESIC</td><td>${record.esic}</td></tr>
          <tr><td>Professional Tax</td><td>${record.pt}</td></tr>
          <tr><td>Advance Recovery</td><td>${record.advance_recovery}</td></tr>
          <tr><td>TDS</td><td>${record.tds}</td></tr>
        </table>
        <div class="net">Net Pay: ₹${record.net_pay.toFixed(2)}</div>
      </body>
    </html>
  `
}

/** Renders the payslip PDF on-device and returns its local file URI. */
export async function generatePayslip(employee: Employee, record: PayrollRecord): Promise<string> {
  const html = payslipHtml(employee, record)
  const { uri } = await Print.printToFileAsync({ html })
  return uri
}
