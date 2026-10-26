/**
 * Forge OS — payslip layout (shared by the Payslip tab and the PDF).
 * Turns a PayrollRecord (+ employee identity) into the row structure of the
 * owner's saved Staff / Worker slip templates. Pure functions, no I/O.
 * Money lines come from the pay_run_items snapshot (record.earnings_lines /
 * deduction_lines); legacy payroll_records rows are normalised into the same
 * key maps. Totals are the snapshot's, never re-summed.
 */
import type { PayrollRecord, PayslipExtras } from '../types'
import { amountInWords } from './amountInWords'

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** 'April 2026' from month '04' (or 4) and year. Never returns a bare number. */
export function monthLabel(month: string | number, year: number): string {
  const name = MONTH_NAMES[Number(month) - 1]
  return name ? `${name} ${year}` : `${month} ${year}`
}

/** Indian digit grouping with 2 decimals: 1234567.5 -> '12,34,567.50'. */
export function formatInr(v: number | null | undefined): string {
  const x = Math.round(Math.abs(Number(v ?? 0)) * 100) / 100
  const [int, dec] = x.toFixed(2).split('.')
  const last3 = int.slice(-3)
  const rest = int.slice(0, -3)
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3
  return `${Number(v ?? 0) < 0 && x !== 0 ? '-' : ''}${grouped}.${dec}`
}

/** 'YYYY-MM-DD' -> '05 Apr 2024' by string split (no Date, no timezone). */
export function formatDateStr(d: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? '')
  if (!m) return ''
  return `${m[3]} ${SHORT_MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`
}

export interface LabelDef { key: string; en: string; vars?: Record<string, string> }
export interface SlipRow { key: string; label: LabelDef; amount: number; rate?: string }
export interface AttendanceCell { label: LabelDef; value: string; strong?: boolean }
export interface FooterCell { label: LabelDef; value: string }

export interface SlipView {
  kind: 'staff' | 'worker' | 'flat'
  period: string
  name: string
  empCode: string
  department: string
  designation: string
  doj: string
  attendance: AttendanceCell[]
  earnings: SlipRow[]
  deductions: SlipRow[]
  otHours: number
  totalEarnings: number
  totalDeductions: number
  adjustment: number // net - (gross - deductions); 0 when it balances
  netPay: number
  netInWords: string
  idCells: FooterCell[]
  leaveCells: FooterCell[]
}

const W = (k: string) => `worker.${k}`
const LABELS: Record<string, LabelDef> = {
  BASIC: { key: W('basic'), en: 'Basic' },
  HRA: { key: W('hra'), en: 'HRA' },
  CONVEYANCE: { key: W('conveyance'), en: 'Conveyance Allowance' },
  EDUCATION: { key: W('payslipEducation'), en: 'Education Allowance' },
  MEDICAL: { key: W('payslipMedical'), en: 'Medical Allowance' },
  PRO_DEV: { key: W('payslipProfessionalDevelopment'), en: 'Professional Development Allowance' },
  COMMUNICATION: { key: W('payslipCommunication'), en: 'Communication Allowance' },
  UNIFORM: { key: W('payslipUniform'), en: 'Uniform Allowance' },
  WASHING: { key: W('payslipWashing'), en: 'Washing Allowance' },
  HEAT: { key: W('payslipHeatAllowance'), en: 'Heat Allowance' },
  VDA: { key: W('payslipVda'), en: 'VDA' },
  PROD_ALLOWANCE: { key: W('payslipProductionAllowance'), en: 'Production Allowance' },
  GROSS: { key: W('payslipGrossSalary'), en: 'Gross Salary' },
  ARREARS: { key: W('payslipArrears'), en: 'Arrears' },
  ARREARS_SEP26_30: { key: W('payslipArrearsBridge'), en: 'Arrears (26-30 Sep)' },
  OT: { key: W('payslipOvertime'), en: 'Overtime' },
  DISPATCH: { key: W('payslipDispatchIncentive'), en: 'Dispatch Incentive' },
  OTHER_ALLOWANCE: { key: W('payslipOtherAllowance'), en: 'Other Allowance' },
  LEAVE_ENCASHMENT: { key: W('payslipLeaveEncashment'), en: 'Leave Encashment' },
  SPECIAL: { key: W('special'), en: 'Special Allowance' },
  PF: { key: W('pf'), en: 'Provident Fund (employee)' },
  ESI: { key: W('esic'), en: 'ESI (employee)' },
  PT: { key: W('pt'), en: 'Professional Tax' },
  MLWF: { key: W('payslipMlwf'), en: 'M.L.W.F.' },
  ADVANCE: { key: W('advanceRecovery'), en: 'Salary Advance' },
  SOCIETY: { key: W('payslipSociety'), en: 'Society' },
  TDS: { key: W('tds'), en: 'TDS' },
  CANTEEN: { key: W('payslipCanteen'), en: 'Canteen' },
  OTHER: { key: W('payslipOtherDeduction'), en: 'Other Deduction' },
  PROD_OFFSET: { key: W('payslipProdOffset'), en: 'Production Allowance Offset' },
}

export type SlipCategory = 'STAFF' | 'PERMANENT_WORKER' | 'PUNE_STAFF' | 'CONSULTANT'
type AttField = 'working_days' | 'present' | 'weekly_off' | 'el' | 'cl' | 'sl' | 'ph'

export interface CategoryLayout {
  kind: 'staff' | 'worker' | 'flat'
  earnings: string[]           // row order, non-zero rows only
  alwaysEarn: string[]         // shown even when zero
  deductions: string[]
  alwaysDed: string[]
  attendance: AttField[]       // leading attendance cells; Days Payable always last
  labelOverrides?: Record<string, LabelDef>
}

// One entry per category: the four slips differ. STAFF and PERMANENT_WORKER
// follow the owner's saved Google Doc templates; the other two are honest
// fallbacks until the owner supplies templates.
export const LAYOUTS: Record<SlipCategory, CategoryLayout> = {
  // Staff template (doc 1T7kwVNm...): Present, Weekly Off, EL, CL, SL, PH, Days Payable.
  STAFF: {
    kind: 'staff',
    earnings: ['BASIC', 'HRA', 'CONVEYANCE', 'EDUCATION', 'MEDICAL', 'PRO_DEV', 'COMMUNICATION', 'UNIFORM', 'WASHING', 'ARREARS', 'ARREARS_SEP26_30', 'OT', 'DISPATCH', 'OTHER_ALLOWANCE'],
    alwaysEarn: ['BASIC'],
    deductions: ['PF', 'ESI', 'PT', 'MLWF', 'ADVANCE', 'SOCIETY', 'TDS', 'CANTEEN', 'OTHER'],
    alwaysDed: ['PF'],
    attendance: ['present', 'weekly_off', 'el', 'cl', 'sl', 'ph'],
    labelOverrides: { OTHER: { key: W('payslipOtherDeduction'), en: 'Other Deduction (Penalty)' } },
  },
  // Worker template (doc 1MSmi8qV...): Working Days (no Weekly Off), Washing before Education,
  // Heat/VDA/Production Allowance, Leave Encashment, no Medical/Pro-Dev/Communication/Uniform,
  // deductions add Production Allowance Offset, no TDS.
  PERMANENT_WORKER: {
    kind: 'worker',
    earnings: ['BASIC', 'HRA', 'CONVEYANCE', 'WASHING', 'EDUCATION', 'HEAT', 'VDA', 'PROD_ALLOWANCE', 'ARREARS', 'ARREARS_SEP26_30', 'OT', 'DISPATCH', 'OTHER_ALLOWANCE', 'LEAVE_ENCASHMENT'],
    alwaysEarn: ['BASIC'],
    deductions: ['PF', 'ESI', 'PT', 'MLWF', 'ADVANCE', 'SOCIETY', 'PROD_OFFSET', 'CANTEEN', 'OTHER'],
    alwaysDed: ['PF'],
    attendance: ['working_days', 'present', 'el', 'cl', 'sl', 'ph'],
  },
  // TODO: awaiting owner template (Pune staff). Simple fallback: GROSS + OT.
  PUNE_STAFF: {
    kind: 'flat',
    earnings: ['GROSS', 'ARREARS', 'ARREARS_SEP26_30', 'OT'],
    alwaysEarn: [],
    deductions: ['PF', 'ESI', 'PT', 'MLWF', 'ADVANCE', 'SOCIETY', 'TDS', 'CANTEEN', 'OTHER'],
    alwaysDed: [],
    attendance: [],
  },
  // TODO: awaiting owner template (Consultant). Simple fallback: GROSS + OT.
  CONSULTANT: {
    kind: 'flat',
    earnings: ['GROSS', 'ARREARS', 'ARREARS_SEP26_30', 'OT'],
    alwaysEarn: [],
    deductions: ['PF', 'ESI', 'PT', 'MLWF', 'ADVANCE', 'SOCIETY', 'TDS', 'CANTEEN', 'OTHER'],
    alwaysDed: [],
    attendance: [],
  },
}

/** Layout for a snapshot category; unknown/missing category is inferred from the lines. */
export function layoutFor(category: string | undefined, earnings: Record<string, number>): CategoryLayout {
  if (category && category in LAYOUTS) return LAYOUTS[category as SlipCategory]
  const worker = (earnings.HEAT ?? 0) || (earnings.VDA ?? 0) || (earnings.PROD_ALLOWANCE ?? 0)
  return worker ? LAYOUTS.PERMANENT_WORKER : LAYOUTS.STAFF
}

const num = (v: unknown) => Number(v ?? 0) || 0

/** Legacy payroll_records columns -> the same key maps the snapshot uses. */
function legacyLines(r: PayrollRecord): { e: Record<string, number>; d: Record<string, number> } {
  const e: Record<string, number> = {
    BASIC: num(r.basic), HRA: num(r.hra), CONVEYANCE: num(r.conveyance), SPECIAL: num(r.special_allowance),
    OT: num(r.overtime), EDUCATION: num(r.education), MEDICAL: num(r.medical),
    PRO_DEV: num(r.professional_development), COMMUNICATION: num(r.communication), UNIFORM: num(r.uniform),
    WASHING: num(r.washing), HEAT: num(r.heat_allowance), VDA: num(r.vda), PROD_ALLOWANCE: num(r.production_allowance),
    ARREARS: num(r.arrears), DISPATCH: num(r.dispatch_incentive), OTHER_ALLOWANCE: num(r.other_allowance),
    LEAVE_ENCASHMENT: num(r.leave_encashment),
  }
  const d: Record<string, number> = {
    PF: num(r.pf), ESI: num(r.esic), PT: num(r.pt), ADVANCE: num(r.advance_recovery), TDS: num(r.tds),
    CANTEEN: num(r.canteen), SOCIETY: num(r.society), MLWF: num(r.mlwf), OTHER: num(r.other_deduction),
    PROD_OFFSET: num(r.production_allowance_offset ?? r.production_efficiency_deduction),
  }
  return { e, d }
}

function buildRows(
  src: Record<string, number>, order: string[], alwaysShow: string[], otKey?: string, otHours = 0,
  overrides: Record<string, LabelDef> = {},
): SlipRow[] {
  const rows: SlipRow[] = []
  const known = new Set(order)
  for (const k of order) {
    const v = src[k] ?? 0
    if (v === 0 && !alwaysShow.includes(k)) continue
    const row: SlipRow = { key: k, label: overrides[k] ?? LABELS[k], amount: v }
    if (k === otKey && otHours) row.rate = `${otHours}`
    rows.push(row)
  }
  // Unknown snapshot keys stay visible, labelled 'Other (KEY)'.
  for (const [k, v] of Object.entries(src)) {
    if (known.has(k) || num(v) === 0) continue
    const label = LABELS[k] ?? { key: W('payslipOtherKey'), en: `Other (${k})`, vars: { key: k } }
    rows.push({ key: k, label, amount: num(v) })
  }
  return rows
}

export function buildSlipView(
  record: PayrollRecord,
  identity: { name: string; empCode: string; department?: string | null },
): SlipView {
  const legacy = legacyLines(record)
  const e = record.earnings_lines ?? legacy.e
  const d = record.deduction_lines ?? legacy.d
  const sum = (rows: SlipRow[]) => rows.reduce((s, r) => s + r.amount, 0)
  const lay = layoutFor(record.category, e)
  const kind = lay.kind
  const otHours = num(record.ot_hours)
  const ex: PayslipExtras = record.extras ?? {}

  const earnings = buildRows(e, lay.earnings, lay.alwaysEarn, 'OT', otHours, lay.labelOverrides)
  const deductions = buildRows(d, lay.deductions, lay.alwaysDed, undefined, 0, lay.labelOverrides)

  // Totals are what is printed, not the snapshot's: snapshot totalEarnings is
  // inconsistent about OT. Net is the authoritative snapshot netPay, and any
  // visible gap (>= 0.5 rupee) is shown as one 'Adjustment / rounding' line.
  const totalEarnings = sum(earnings)
  const totalDeductions = sum(deductions)
  const netPay = num(record.net_pay)
  const diff = Math.round((netPay - (totalEarnings - totalDeductions)) * 100) / 100
  const adjustment = Math.abs(diff) >= 0.5 ? diff : 0

  const L = (k: string, en: string): LabelDef => ({ key: W(k), en })
  const a = ex.attendance && ex.attendance.source !== 'none' ? ex.attendance : null
  const cell = (label: LabelDef, v: number | null | undefined, strong = false): AttendanceCell[] =>
    v === null || v === undefined ? [] : [{ label, value: `${v}`, strong }]
  const daysPayable = a?.days_payable ?? record.days_payable
  const attLabels: Record<AttField, LabelDef> = {
    working_days: L('payslipWorkingDays', 'Working Days'), present: L('payslipPresentDays', 'Present Days'),
    weekly_off: L('payslipWeeklyOff', 'Weekly Off'), el: L('payslipEl', 'EL'), cl: L('payslipCl', 'CL'),
    sl: L('payslipSl', 'SL'), ph: L('payslipPh', 'PH'),
  }
  const payable = cell(L('payslipDaysPayable', 'Days Payable'), daysPayable, true)
  const attendance: AttendanceCell[] = a
    ? [...lay.attendance.flatMap((f) => cell(attLabels[f], a[f])), ...payable]
    : payable

  const foot = (label: LabelDef, v: string | number | null | undefined): FooterCell[] =>
    v === null || v === undefined || v === '' ? [] : [{ label, value: `${v}` }]
  const la = ex.leave_available ?? {}

  return {
    kind,
    period: monthLabel(record.month, record.year),
    name: identity.name,
    empCode: identity.empCode,
    department: ex.department ?? identity.department ?? '',
    designation: ex.designation ?? '',
    doj: formatDateStr(ex.doj),
    attendance,
    earnings,
    deductions,
    otHours,
    totalEarnings,
    totalDeductions,
    adjustment,
    netPay,
    netInWords: amountInWords(netPay),
    idCells: [
      ...foot(L('payslipUan', 'UAN'), ex.uan),
      ...foot(L('payslipEsiNo', 'ESI No.'), ex.esi_no),
      ...foot(L('payslipPan', 'PAN'), ex.pan_masked),
    ],
    leaveCells: [
      ...foot(L('payslipElAvail', 'EL Available'), la.el),
      ...foot(L('payslipClAvail', 'CL Available'), la.cl),
      ...foot(L('payslipSlAvail', 'SL Available'), la.sl),
    ],
  }
}
