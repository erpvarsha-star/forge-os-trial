/**
 * Forge OS — payslip PDF generator.
 *
 * Reproduces the VFL paper payslip format (Module 5, Master System
 * Definition Section 1): earnings — Basic, HRA, Conveyance, Washing,
 * Education, VDA, Heat, OT, Dispatch Incentive, Production Allowance —
 * and deductions — PF 12%, ESIC 0.75% (if gross ≤ ₹21,000), PT ₹200,
 * MLWF ₹25, Advance Recovery.
 *
 * Rendering uses `expo-print` (HTML → PDF) so the same template works on
 * both Android and iOS without native PDF libraries. HR Admin can generate
 * a payslip for any employee; a member can generate their own.
 */

import * as Print from 'expo-print';
import { PAYROLL, PLANT } from './config';
import type { EmployeeRow } from '../types/database';

export interface PayslipEarnings {
  basic: number;
  hra: number;
  conveyance: number;
  washing: number;
  education: number;
  vda: number;
  heat: number;
  ot: number;
  dispatchIncentive: number;
  productionAllowance: number;
}

export interface PayslipInput {
  employee: Pick<
    EmployeeRow,
    'employee_code' | 'full_name' | 'designation' | 'department_id' | 'pf_number' | 'uan' | 'esic_number' | 'bank_account_number'
  >;
  departmentName: string;
  month: number; // 1-12
  year: number;
  earnings: PayslipEarnings;
  daysInMonth: number;
  daysPresent: number;
  advanceRecovery?: number;
  esicApplicable?: boolean; // if omitted, derived from gross vs esicGrossCeiling
}

export interface PayslipDeductions {
  pf: number;
  esic: number;
  pt: number;
  mlwf: number;
  advanceRecovery: number;
  total: number;
}

export interface PayslipResult {
  grossEarnings: number;
  deductions: PayslipDeductions;
  netPay: number;
  earnings: PayslipEarnings;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Computes gross, statutory deductions, and net pay for one employee/month. */
export function computePayslip(input: PayslipInput): PayslipResult {
  const { earnings, advanceRecovery = 0 } = input;

  const grossEarnings = round2(
    earnings.basic +
      earnings.hra +
      earnings.conveyance +
      earnings.washing +
      earnings.education +
      earnings.vda +
      earnings.heat +
      earnings.ot +
      earnings.dispatchIncentive +
      earnings.productionAllowance
  );

  // PF is calculated on Basic + VDA per statutory convention.
  const pfWages = earnings.basic + earnings.vda;
  const pf = round2((pfWages * PAYROLL.pfRatePct) / 100);

  const esicApplicable = input.esicApplicable ?? grossEarnings <= PAYROLL.esicGrossCeiling;
  const esic = esicApplicable ? round2((grossEarnings * PAYROLL.esicRatePct) / 100) : 0;

  const pt = PAYROLL.ptAmount;
  const mlwf = PAYROLL.mlwfAmount;

  const deductions: PayslipDeductions = {
    pf,
    esic,
    pt,
    mlwf,
    advanceRecovery: round2(advanceRecovery),
    total: round2(pf + esic + pt + mlwf + advanceRecovery),
  };

  const netPay = round2(grossEarnings - deductions.total);

  return { grossEarnings, deductions, netPay, earnings };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatInr = (n: number) =>
  `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function earningsRows(e: PayslipEarnings): Array<[string, number]> {
  return [
    ['Basic', e.basic],
    ['HRA', e.hra],
    ['Conveyance', e.conveyance],
    ['Washing Allowance', e.washing],
    ['Education Allowance', e.education],
    ['VDA', e.vda],
    ['Heat Allowance', e.heat],
    ['Overtime (OT)', e.ot],
    ['Dispatch Incentive', e.dispatchIncentive],
    ['Production Allowance', e.productionAllowance],
  ];
}

function deductionRows(d: PayslipDeductions): Array<[string, number]> {
  return [
    ['PF (12%)', d.pf],
    ['ESIC (0.75%)', d.esic],
    ['Professional Tax', d.pt],
    ['MLWF', d.mlwf],
    ['Advance Recovery', d.advanceRecovery],
  ];
}

/** Renders the payslip as a self-contained HTML string, styled to match the VFL paper format. */
export function payslipHtml(input: PayslipInput): string {
  const result = computePayslip(input);
  const monthLabel = `${MONTH_NAMES[input.month - 1]} ${input.year}`;
  const attendanceLabel = `${input.daysPresent} / ${input.daysInMonth} days`;

  const earningsHtml = earningsRows(result.earnings)
    .map(([label, value]) => `<tr><td>${label}</td><td class="amt">${formatInr(value)}</td></tr>`)
    .join('');

  const deductionsHtml = deductionRows(result.deductions)
    .map(([label, value]) => `<tr><td>${label}</td><td class="amt">${formatInr(value)}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 24px; }
  .header { text-align: center; border-bottom: 2px solid #E87722; padding-bottom: 8px; margin-bottom: 12px; }
  .header h1 { margin: 0; font-size: 18px; color: #E87722; }
  .header p { margin: 2px 0; font-size: 11px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 12px; }
  .meta table { width: 48%; border-collapse: collapse; }
  .meta td { padding: 3px 4px; font-size: 11px; }
  .meta td.label { color: #555; width: 45%; }
  .columns { display: flex; gap: 12px; }
  .col { width: 50%; }
  h3 { background: #E87722; color: #fff; padding: 4px 8px; font-size: 12px; margin: 0 0 4px 0; }
  table.lines { width: 100%; border-collapse: collapse; }
  table.lines td { padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
  td.amt { text-align: right; font-variant-numeric: tabular-nums; }
  .totals td { font-weight: bold; border-top: 2px solid #333; }
  .netpay { margin-top: 16px; text-align: center; background: #0F6E56; color: #fff; padding: 10px; border-radius: 4px; }
  .netpay .amount { font-size: 20px; font-weight: bold; }
  .footer { margin-top: 20px; font-size: 9px; color: #777; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <h1>${PLANT.name}</h1>
    <p>${PLANT.location}</p>
    <p>Payslip — ${monthLabel}</p>
  </div>

  <div class="meta">
    <table>
      <tr><td class="label">Employee Name</td><td>${input.employee.full_name}</td></tr>
      <tr><td class="label">Employee Code</td><td>${input.employee.employee_code}</td></tr>
      <tr><td class="label">Designation</td><td>${input.employee.designation ?? '-'}</td></tr>
      <tr><td class="label">Department</td><td>${input.departmentName}</td></tr>
    </table>
    <table>
      <tr><td class="label">PF Number</td><td>${input.employee.pf_number ?? '-'}</td></tr>
      <tr><td class="label">UAN</td><td>${input.employee.uan ?? '-'}</td></tr>
      <tr><td class="label">ESIC Number</td><td>${input.employee.esic_number ?? '-'}</td></tr>
      <tr><td class="label">Attendance</td><td>${attendanceLabel}</td></tr>
    </table>
  </div>

  <div class="columns">
    <div class="col">
      <h3>Earnings</h3>
      <table class="lines">
        ${earningsHtml}
        <tr class="totals"><td>Gross Earnings</td><td class="amt">${formatInr(result.grossEarnings)}</td></tr>
      </table>
    </div>
    <div class="col">
      <h3>Deductions</h3>
      <table class="lines">
        ${deductionsHtml}
        <tr class="totals"><td>Total Deductions</td><td class="amt">${formatInr(result.deductions.total)}</td></tr>
      </table>
    </div>
  </div>

  <div class="netpay">
    <div>Net Pay</div>
    <div class="amount">${formatInr(result.netPay)}</div>
  </div>

  <div class="footer">
    This is a system-generated payslip from Forge OS and does not require a signature.
    Bank A/c: ${input.employee.bank_account_number ?? '-'}
  </div>
</body>
</html>`;
}

/**
 * Generates the payslip PDF on-device and returns its local file URI.
 * Caller is responsible for sharing/downloading it (e.g. via expo-sharing).
 */
export async function generatePayslipPdf(input: PayslipInput): Promise<{ uri: string; result: PayslipResult }> {
  const html = payslipHtml(input);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return { uri, result: computePayslip(input) };
}
