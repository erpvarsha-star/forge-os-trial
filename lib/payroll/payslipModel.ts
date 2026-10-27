/**
 * Forge OS — Payslip presentation model (bilingual EN/HI).
 * Renders a pay_run_items.snapshot (PayrollResult) into the exact line layout
 * of the HR OS payslip templates, per category. Pure functions, no I/O —
 * the app screen and the PDF generator both consume this.
 *
 * Labels follow the legacy salary-slip wording workers already know,
 * with Hindi alongside (app language toggle picks .en / .hi).
 */

export interface BiLabel { en: string; hi: string }
export interface SlipLine { key: string; label: BiLabel; amount: number; kind: 'earning' | 'deduction' | 'info' }
export interface PayslipModel {
  empCode: string;
  category: string;
  periodLabel: string;             // 'October 2026'
  attendance: { label: BiLabel; value: string }[];
  earnings: SlipLine[];
  deductions: SlipLine[];
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  employerInfo: SlipLine[];        // shown collapsed: employer PF, bonus, gratuity
  arrearsNote?: BiLabel;           // one-time Sep 26–30 bridge, when present
}

export const L: Record<string, BiLabel> = {
  BASIC: { en: 'Basic', hi: 'मूल वेतन' },
  HRA: { en: 'HRA', hi: 'मकान किराया भत्ता' },
  CONVEYANCE: { en: 'Conveyance Allow.', hi: 'यातायात भत्ता' },
  WASHING: { en: 'Washing Allow.', hi: 'धुलाई भत्ता' },
  EDUCATION: { en: 'Education Allow.', hi: 'शिक्षा भत्ता' },
  MEDICAL: { en: 'Medical', hi: 'चिकित्सा' },
  PRO_DEV: { en: 'Professional Dev.', hi: 'व्यावसायिक विकास' },
  COMMUNICATION: { en: 'Communication', hi: 'संचार' },
  UNIFORM: { en: 'Uniform', hi: 'वर्दी' },
  HEAT: { en: 'Heat Allow.', hi: 'गर्मी भत्ता' },
  VDA: { en: 'V.D.A.', hi: 'महंगाई भत्ता' },
  PROD_ALLOWANCE: { en: 'Production Allow.', hi: 'उत्पादन भत्ता' },
  OT: { en: 'Overtime', hi: 'अतिकालिक काम' },
  GROSS: { en: 'Gross', hi: 'कुल वेतन' },
  ARREARS: { en: 'Arrears', hi: 'बकाया राशि' },
  ARREARS_SEP26_30: { en: 'Arrears (26–30 Sep bridge)', hi: 'बकाया (26–30 सितंबर)' },
  OTHER_ALLOWANCE: { en: 'Other Allowance', hi: 'अन्य भत्ता' },
  BUNG_OT: { en: 'Overtime', hi: 'अतिकालिक काम' },
  OUTSTATION_TRAVEL: { en: 'Outstation travel', hi: 'बाहरगाव प्रवास भत्ता' },
  PF: { en: 'Employee PF', hi: 'भविष्य निधि (PF)' },
  ESI: { en: 'ESI', hi: 'ईएसआई (ESI)' },
  PT: { en: 'Prof. Tax', hi: 'व्यवसाय कर (PT)' },
  MLWF: { en: 'MLWF', hi: 'मजूर कल्याण निधि' },
  TDS: { en: 'TDS', hi: 'टीडीएस (TDS)' },
  CANTEEN: { en: 'Canteen', hi: 'कैंटीन' },
  SOCIETY: { en: 'Society', hi: 'सोसायटी' },
  ADVANCE: { en: 'Salary Advance', hi: 'वेतन अग्रिम' },
  OTHER: { en: 'Other Deduction', hi: 'अन्य कटौती' },
  ER_PF: { en: 'Employer PF', hi: 'कंपनी PF' },
  BONUS: { en: 'Bonus (provision)', hi: 'बोनस (प्रावधान)' },
  GRATUITY: { en: 'Gratuity (provision)', hi: 'ग्रेच्युटी (प्रावधान)' },
  TOTAL_EARNINGS: { en: 'Total Earnings', hi: 'कुल आय' },
  TOTAL_DEDUCTIONS: { en: 'Total Deductions', hi: 'कुल कटौती' },
  NET_PAY: { en: 'Net Pay', hi: 'नेट वेतन' },
  PRESENT: { en: 'Present Days', hi: 'हाजर दिवस' },
  WEEKLY_OFF: { en: 'Week Off', hi: 'साप्ताहिक सुट्टी' },
  WORKED: { en: 'Days Payable', hi: 'वेतन दिवस' },
  OT_HOURS: { en: 'OT Hours', hi: 'अतिकालिक तास' },
};

const EARNING_ORDER: Record<string, string[]> = {
  STAFF: ['BASIC', 'HRA', 'CONVEYANCE', 'MEDICAL', 'EDUCATION', 'PRO_DEV', 'COMMUNICATION', 'UNIFORM', 'WASHING', 'ARREARS_SEP26_30', 'ARREARS', 'OT', 'OTHER_ALLOWANCE'],
  PERMANENT_WORKER: ['BASIC', 'HRA', 'CONVEYANCE', 'WASHING', 'EDUCATION', 'HEAT', 'VDA', 'PROD_ALLOWANCE', 'ARREARS_SEP26_30', 'ARREARS', 'OT', 'OTHER_ALLOWANCE'],
  CONSULTANT: ['GROSS', 'ARREARS_SEP26_30', 'ARREARS', 'OT', 'OTHER_ALLOWANCE'],
  PUNE_STAFF: ['GROSS', 'ARREARS_SEP26_30', 'ARREARS', 'OT', 'BUNG_OT', 'OUTSTATION_TRAVEL', 'OTHER_ALLOWANCE'],
};
const DEDUCTION_ORDER = ['PF', 'ESI', 'PT', 'MLWF', 'TDS', 'CANTEEN', 'SOCIETY', 'ADVANCE', 'OTHER'];

export interface SlipSnapshot {
  category: string;
  worked: number;
  earnings: Record<string, number>;
  deductions: Record<string, number>;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  otPay: number;
  employer?: { pf: number; bonus: number; gratuity: number };
  // optional context the runner/backfill attaches:
  days?: { present?: number; weekOff?: number };
  otHours?: number;
}

function lines(src: Record<string, number>, order: string[], kind: 'earning' | 'deduction'): SlipLine[] {
  const keys = [...order.filter((k) => (src[k] ?? 0) !== 0), ...Object.keys(src).filter((k) => !order.includes(k) && (src[k] ?? 0) !== 0)];
  return keys.map((k) => ({ key: k, label: L[k] ?? { en: k, hi: k }, amount: Math.round((src[k] ?? 0) * 100) / 100, kind }));
}

export function buildPayslip(empCode: string, periodLabel: string, s: SlipSnapshot): PayslipModel {
  const cat = s.category in EARNING_ORDER ? s.category : 'STAFF';
  const earnings = lines(s.earnings, EARNING_ORDER[cat], 'earning');
  const deductions = lines(s.deductions, DEDUCTION_ORDER, 'deduction');
  const hasBridge = (s.earnings['ARREARS_SEP26_30'] ?? 0) !== 0;
  return {
    empCode, category: cat, periodLabel,
    attendance: [
      ...(s.days?.present !== undefined ? [{ label: L.PRESENT, value: String(s.days.present) }] : []),
      ...(s.days?.weekOff !== undefined ? [{ label: L.WEEKLY_OFF, value: String(s.days.weekOff) }] : []),
      { label: L.WORKED, value: String(s.worked) },
      ...(s.otHours ? [{ label: L.OT_HOURS, value: String(s.otHours) }] : []),
    ],
    earnings, deductions,
    totalEarnings: s.totalEarnings, totalDeductions: s.totalDeductions, netPay: s.netPay,
    employerInfo: s.employer ? [
      { key: 'ER_PF', label: L.ER_PF, amount: s.employer.pf, kind: 'info' },
      { key: 'BONUS', label: L.BONUS, amount: s.employer.bonus, kind: 'info' },
      { key: 'GRATUITY', label: L.GRATUITY, amount: s.employer.gratuity, kind: 'info' },
    ] : [],
    arrearsNote: hasBridge
      ? { en: 'Includes one-time arrears for 26–30 Sep (cycle change to calendar month).', hi: '26–30 सितंबर की एकमुश्त बकाया राशि शामिल है (कैलेंडर माह में बदलाव)।' }
      : undefined,
  };
}
