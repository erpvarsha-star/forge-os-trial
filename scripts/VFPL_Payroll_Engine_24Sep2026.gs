/**
 * ============================================================================
 * VFPL PAYROLL CALCULATION ENGINE (24-Sep-2026)
 * Target spreadsheet: VFL HR OS 2026 27
 *   ID: 10-OpV86Gvi_TlBPQ6zKQC6y7MLWqietELGU3G06exIM
 *
 * DEPLOYMENT:
 *   1. Open the spreadsheet → Extensions → Apps Script → paste this file → Save
 *   2. Run setupPayrollTriggers() once to authorise all scopes
 *   3. Fill required config tabs before running (see CONFIG REQUIREMENTS below)
 *   4. Run runPayrollEngine() for a dry-run first (writes to PAYROLL_DRAFT)
 *   5. After Finance/HR approval: run promotePayrollDraft() to copy to
 *      PAYROLL_STAFF and PAYROLL_WORKER
 *
 * CONFIG REQUIREMENTS — fill these tabs before first run:
 *   PAYROLL_PERIOD   A2=Month(text, e.g."Aug 2026")  B2=Year(4-digit)
 *                    C2=Working Days  D2=Period Start Date  E2=Period End Date
 *   STATUTORY_CONFIG See STATUTORY_CONFIG_SCHEMA constant below for row layout.
 *                    PT slabs must come from HR/statutory source — not hardcoded.
 *   LEAVE_CONFIG     One row per employee: emp_code, el_balance, cl_balance,
 *                    sl_balance (annual entitlement minus used)
 *
 * FORMULA CORRECTIONS APPLIED (from FORMULA_AUDIT, confirmed Sep 2026):
 *   1. Worker VDA: physical_present_days × ₹103 (not payable days)
 *   2. Worker Heat Allowance: ₹5.78/day (not ₹5.80; eligible flag = 'Y' in
 *      EMPLOYEE_MASTER heat_allow_eligible column)
 *   3. Staff rounding: all prorated components kept as floats; Math.round()
 *      applied only to net_pay at the very end
 *   4. Production Efficiency slab: 81%→₹4500 / 82%→₹5000 / 83%→₹6500 /
 *      84%→₹7500 / 85%→₹8500 (worker only; staff incentive deferred)
 *   5. ESIC (employee): 0.75% of gross; exempt entirely if gross > 21,000
 *      (NOT the ₹15,000-cap copy-paste from PF that was in the old sheet)
 *   6. PF (employee): 12% of (Basic + VDA) but capped at ₹1,800 max
 *      (equivalent to 12% of ₹15,000 wage ceiling, confirmed by Yash)
 *   7. OT rate: ((basic_fixed + vda_fixed) / working_days / 8) × 2 × ot_hours
 *      Uses FIXED component amounts, not prorated
 *   8. PT: read from STATUTORY_CONFIG PT_SLABS rows — never hardcoded here;
 *      leave as ₹0 until Yash confirms the Maharashtra slab table and it is
 *      entered in STATUTORY_CONFIG
 *
 * ARCHITECTURE:
 *   - This engine is the authoritative calculation layer.
 *   - It reads only from INPUT_* tabs and EMPLOYEE_MASTER.
 *   - It does NOT call Supabase. Supabase export is a separate, optional step
 *     after HR + Finance approve the PAYROLL_DRAFT output.
 *   - syncOpsDashboardToSupabase() in ALERT.gs is unrelated — do not call it
 *     from here.
 * ============================================================================
 */

// ── Sheet name constants ──────────────────────────────────────────────────────
var SHT_EMPLOYEE_MASTER     = 'EMPLOYEE_MASTER';
var SHT_PAYROLL_PERIOD      = 'PAYROLL_PERIOD';
var SHT_STATUTORY_CONFIG    = 'STATUTORY_CONFIG';
var SHT_INPUT_ATTENDANCE    = 'INPUT_ATTENDANCE';
var SHT_INPUT_OT            = 'INPUT_OT';
var SHT_INPUT_EFFICIENCY    = 'INPUT_EFFICIENCY';
var SHT_INPUT_CANTEEN       = 'INPUT_CANTEEN';
var SHT_INPUT_ADVANCE       = 'INPUT_ADVANCE';
var SHT_INPUT_SOCIETY       = 'INPUT_SOCIETY';
var SHT_INPUT_MISC          = 'INPUT_MISC';
var SHT_PAYROLL_DRAFT       = 'PAYROLL_DRAFT';
var SHT_PAYROLL_STAFF       = 'PAYROLL_STAFF';
var SHT_PAYROLL_WORKER      = 'PAYROLL_WORKER';

// ── STATUTORY_CONFIG row layout (A=key, B=value or JSON) ─────────────────────
// Expected keys in column A:
//   PF_WAGE_CEILING      (number, e.g. 15000)
//   PF_EMPLOYEE_RATE     (decimal, e.g. 0.12)
//   PF_MAX_EMPLOYEE      (number, e.g. 1800)
//   ESI_EMPLOYEE_RATE    (decimal, e.g. 0.0075)
//   ESI_EXEMPT_ABOVE     (number, e.g. 21000)
//   BONUS_STAFF_RATE     (decimal, e.g. 0.0833)  — annual, informational only
//   BONUS_WORKER_RATE    (decimal, e.g. 0.18)    — annual, informational only
//   GRATUITY_RATE        (decimal, e.g. 0.0483)  — informational only
//   PT_SLABS             (JSON array: [{min:0,max:7500,pt:0},{min:7501,max:10000,pt:175},…])
//   WORKER_VDA_RATE      (number, e.g. 103)      — ₹ per physical present day
//   WORKER_HEAT_RATE     (number, e.g. 5.78)     — ₹ per physical present day (eligible only)
var STATUTORY_CONFIG_SCHEMA = {
  PF_WAGE_CEILING:   'PF_WAGE_CEILING',
  PF_EMPLOYEE_RATE:  'PF_EMPLOYEE_RATE',
  PF_MAX_EMPLOYEE:   'PF_MAX_EMPLOYEE',
  ESI_EMPLOYEE_RATE: 'ESI_EMPLOYEE_RATE',
  ESI_EXEMPT_ABOVE:  'ESI_EXEMPT_ABOVE',
  PT_SLABS:          'PT_SLABS',
  WORKER_VDA_RATE:   'WORKER_VDA_RATE',
  WORKER_HEAT_RATE:  'WORKER_HEAT_RATE',
};

// ── Output column order (both PAYROLL_STAFF and PAYROLL_WORKER) ───────────────
// Note: employer-side PF/ESI are included as informational columns, clearly
// labelled, so Accounts can reconcile against the statutory challans.
// They are NOT deducted from net_pay (employee-side only affects take-home).
var OUTPUT_HEADERS = [
  'emp_code','name','department','category','month','year','working_days',
  'present_days','payable_days','el_availed','cl_availed','sl_availed',
  // Earnings
  'basic','hra','conveyance','vda','washing_allow','education_allow',
  'heat_allow','production_allow','special_allow','medical_allow',
  'professional_dev','communication_allow','uniform_allow',
  'ot_hours','ot_amount',
  'production_efficiency_pct','production_efficiency_incentive',
  'gross_earnings',
  // Employee deductions
  'pf_employee','esi_employee','pt',
  'advance_deduction','canteen','society','mlwf',
  'arrears','dispatch_incentive','other_allowance','tds','other_deduction',
  'total_deductions',
  // Net
  'net_pay',
  // Employer provisions (informational, not deducted from net_pay)
  'pf_employer','esi_employer',
  // Meta
  'status','notes',
];

// ── EMPLOYEE_MASTER column map (0-based) ──────────────────────────────────────
// Adjust if your sheet header order differs.
var EM_COL = {
  emp_code:         0,
  name:             1,
  department:       2,
  category:         3,   // 'STAFF' or 'WORKER'
  designation:      4,
  basic_fixed:      5,
  hra_fixed:        6,
  conveyance_fixed: 7,
  vda_fixed:        8,   // worker only; staff may be 0
  washing_fixed:    9,
  education_fixed:  10,
  heat_allow_eligible: 11, // 'Y' or 'N'; worker only
  production_allow_fixed: 12, // worker only
  special_allow_fixed:    13,
  medical_allow_fixed:    14, // staff only
  professional_dev_fixed: 15, // staff only
  communication_fixed:    16, // staff only
  uniform_fixed:          17, // staff only
  is_active:              18,
};

// ── INPUT_ATTENDANCE column map (0-based, one row per employee per month) ─────
var ATT_COL = {
  emp_code:      0,
  present_days:  1,   // physical present (used for VDA and heat allow)
  wo_days:       2,
  el_availed:    3,
  cl_availed:    4,
  sl_availed:    5,
  ph_days:       6,
  payable_days:  7,   // confirmed by Dept Head → Accounts → HR
  working_days:  8,   // calendar working days for the month (standard for all)
};

// ── INPUT_OT column map ───────────────────────────────────────────────────────
var OT_COL = {
  emp_code:  0,
  ot_hours:  1,   // approved hours; sourced from OT approval form, not typed by HR
};

// ── INPUT_EFFICIENCY column map ───────────────────────────────────────────────
var EFF_COL = {
  department: 0,
  efficiency_pct: 1, // e.g. 82 for 82%
};

// ── INPUT_CANTEEN/ADVANCE/SOCIETY/MISC column map ─────────────────────────────
var DED_COL = {
  emp_code: 0,
  amount:   1,
  notes:    2,
};

// ── Efficiency slab (worker only; FORMULA_AUDIT confirmed) ───────────────────
var EFFICIENCY_SLABS = [
  { threshold: 85, incentive: 8500 },
  { threshold: 84, incentive: 7500 },
  { threshold: 83, incentive: 6500 },
  { threshold: 82, incentive: 5000 },
  { threshold: 81, incentive: 4500 },
  // Below 81%: production_allow is clawed back (set to 0), incentive = 0
];

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Runs the full payroll calculation and writes results to PAYROLL_DRAFT.
 * Call this from the Apps Script menu or trigger.
 * Review the draft; then call promotePayrollDraft() after approval.
 */
function runPayrollEngine() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var period  = readPayrollPeriod_(ss);
  var stat    = readStatutoryConfig_(ss);
  var empMap  = readEmployeeMaster_(ss);
  var attMap  = readInputSheet_(ss, SHT_INPUT_ATTENDANCE, ATT_COL.emp_code);
  var otMap   = readInputSheet_(ss, SHT_INPUT_OT,         OT_COL.emp_code);
  var effMap  = readEfficiencyByDept_(ss);
  var canMap  = readDeductionSheet_(ss, SHT_INPUT_CANTEEN);
  var advMap  = readDeductionSheet_(ss, SHT_INPUT_ADVANCE);
  var socMap  = readDeductionSheet_(ss, SHT_INPUT_SOCIETY);
  var miscMap = readMiscSheet_(ss);

  var rows = [];
  Object.keys(empMap).forEach(function(empCode) {
    var emp = empMap[empCode];
    if (emp[EM_COL.is_active] !== 'Y' && emp[EM_COL.is_active] !== true) return;

    var att  = attMap[empCode]  || null;
    var ot   = otMap[empCode]   || null;
    var can  = canMap[empCode]  || 0;
    var adv  = advMap[empCode]  || 0;
    var soc  = socMap[empCode]  || 0;
    var misc = miscMap[empCode] || {};

    var category = (emp[EM_COL.category] || '').toString().toUpperCase();
    var dept     = emp[EM_COL.department] || '';
    var effPct   = effMap[dept] != null ? effMap[dept] : null;

    var result;
    if (category === 'WORKER') {
      result = calcWorker_(emp, att, ot, effPct, can, adv, soc, misc, period, stat);
    } else {
      result = calcStaff_(emp, att, ot, can, adv, soc, misc, period, stat);
    }

    rows.push(buildOutputRow_(emp, att, ot, result, period, category, effPct, can, adv, soc, misc));
  });

  writeDraft_(ss, rows);
  SpreadsheetApp.getUi().alert(
    'Payroll draft written to ' + SHT_PAYROLL_DRAFT + '.\n' +
    rows.length + ' employees processed.\n\n' +
    'Review all rows before calling promotePayrollDraft().'
  );
}

/**
 * After Finance/HR approval: copies PAYROLL_DRAFT to PAYROLL_STAFF and
 * PAYROLL_WORKER (appending to any existing data) and marks rows in draft
 * as APPROVED.
 */
function promotePayrollDraft() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var draft = ss.getSheetByName(SHT_PAYROLL_DRAFT);
  if (!draft) { throw new Error('PAYROLL_DRAFT sheet not found.'); }

  var data  = draft.getDataRange().getValues();
  var hdrs  = data[0];
  var catIdx = hdrs.indexOf('category');
  var stIdx  = hdrs.indexOf('status');

  var staffRows  = [hdrs];
  var workerRows = [hdrs];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue; // skip blank rows
    var cat = (row[catIdx] || '').toString().toUpperCase();
    if (cat === 'WORKER') workerRows.push(row);
    else staffRows.push(row);
    // Mark as promoted
    draft.getRange(i + 1, stIdx + 1).setValue('PROMOTED');
  }

  appendToSheet_(ss, SHT_PAYROLL_STAFF,  staffRows.slice(1));
  appendToSheet_(ss, SHT_PAYROLL_WORKER, workerRows.slice(1));

  SpreadsheetApp.getUi().alert(
    'Promoted:\n' +
    (staffRows.length  - 1) + ' staff rows → ' + SHT_PAYROLL_STAFF  + '\n' +
    (workerRows.length - 1) + ' worker rows → ' + SHT_PAYROLL_WORKER
  );
}

// =============================================================================
// WORKER CALCULATION
// =============================================================================

function calcWorker_(emp, att, ot, effPct, can, adv, soc, misc, period, stat) {
  var workingDays  = att ? parseNum_(att[ATT_COL.working_days])  : period.working_days;
  var payableDays  = att ? parseNum_(att[ATT_COL.payable_days])  : 0;
  var presentDays  = att ? parseNum_(att[ATT_COL.present_days])  : 0; // physical
  var otHours      = ot  ? parseNum_(ot[OT_COL.ot_hours])        : 0;

  if (workingDays === 0) workingDays = period.working_days;

  var basicFixed   = parseNum_(emp[EM_COL.basic_fixed]);
  var vdaFixed     = parseNum_(emp[EM_COL.vda_fixed]);
  var convFixed    = parseNum_(emp[EM_COL.conveyance_fixed]);
  var washFixed    = parseNum_(emp[EM_COL.washing_fixed]);
  var eduFixed     = parseNum_(emp[EM_COL.education_fixed]);
  var prodAllFixed = parseNum_(emp[EM_COL.production_allow_fixed]);
  var specFixed    = parseNum_(emp[EM_COL.special_allow_fixed]);
  var heatEligible = (emp[EM_COL.heat_allow_eligible] || '').toString().toUpperCase() === 'Y';

  var factor = workingDays > 0 ? payableDays / workingDays : 0;

  // ── Earnings ────────────────────────────────────────────────────────────────
  var basic       = basicFixed * factor;
  var conveyance  = convFixed  * factor;
  var washing     = washFixed  * factor;
  var education   = eduFixed   * factor;

  // VDA: PHYSICAL present days × rate (FORMULA_AUDIT correction #1)
  var vda = presentDays * stat.worker_vda_rate;

  // Heat Allow: PHYSICAL present days × ₹5.78 (eligible only) (correction #2)
  var heatAllow = heatEligible ? presentDays * stat.worker_heat_rate : 0;

  // Production Allow: subject to efficiency claw-back below
  var prodAllow = prodAllFixed * factor;

  // OT: (basic_FIXED + vda_FIXED) / working_days / 8 × 2 × ot_hours (correction #7)
  var otAmount = 0;
  if (otHours > 0 && workingDays > 0) {
    var otHourlyBase = (basicFixed + vdaFixed) / workingDays / 8;
    otAmount = otHourlyBase * 2 * otHours;
  }

  // Efficiency (slab lookup; claw-back if below 81%) (correction #4)
  var effIncentive = 0;
  if (effPct != null) {
    var effNum = parseNum_(effPct);
    if (effNum < 81) {
      prodAllow = 0; // full claw-back
    } else {
      for (var i = 0; i < EFFICIENCY_SLABS.length; i++) {
        if (effNum >= EFFICIENCY_SLABS[i].threshold) {
          effIncentive = EFFICIENCY_SLABS[i].incentive;
          break;
        }
      }
    }
  }

  var grossEarnings = basic + vda + conveyance + washing + education +
                      heatAllow + prodAllow + specFixed * factor +
                      otAmount + effIncentive;

  // ── Deductions ──────────────────────────────────────────────────────────────
  var pfEmployee  = calcPfEmployee_(basic + vda, stat);
  var esiEmployee = calcEsiEmployee_(grossEarnings, stat);
  var pt          = calcPT_(grossEarnings, stat);

  var mlwf         = parseNum_(misc.mlwf)              || 0;
  var arrears      = parseNum_(misc.arrears)            || 0;
  var dispatch     = parseNum_(misc.dispatch_incentive) || 0;
  var otherAllow   = parseNum_(misc.other_allowance)    || 0;
  var tds          = parseNum_(misc.tds)                || 0;
  var otherDed     = parseNum_(misc.other_deduction)    || 0;

  // Arrears and dispatch_incentive are treated as OTHER EARNINGS adjustments
  var totalEarnings = grossEarnings + arrears + dispatch + otherAllow;

  var totalDeductions = pfEmployee + esiEmployee + pt + adv + can + soc +
                        mlwf + tds + otherDed;
  var netPay = Math.round(totalEarnings - totalDeductions);

  // Employer provisions (informational)
  var pfEmployer  = (basic + vda) <= stat.pf_wage_ceiling
    ? (basic + vda) * 0.1301
    : stat.pf_wage_ceiling * 0.1301;
  var esiEmployer = grossEarnings <= stat.esi_exempt_above ? grossEarnings * 0.0325 : 0;

  return {
    basic, vda, conveyance, washing, education,
    heat_allow: heatAllow, production_allow: prodAllow,
    special_allow: specFixed * factor,
    ot_amount: otAmount,
    production_efficiency_incentive: effIncentive,
    gross_earnings: totalEarnings,
    pf_employee: pfEmployee, esi_employee: esiEmployee, pt,
    advance_deduction: adv, canteen: can, society: soc,
    mlwf, arrears, dispatch_incentive: dispatch,
    other_allowance: otherAllow, tds, other_deduction: otherDed,
    total_deductions: totalDeductions,
    net_pay: netPay,
    pf_employer: pfEmployer, esi_employer: esiEmployer,
  };
}

// =============================================================================
// STAFF CALCULATION
// =============================================================================

function calcStaff_(emp, att, ot, can, adv, soc, misc, period, stat) {
  var workingDays = att ? parseNum_(att[ATT_COL.working_days]) : period.working_days;
  var payableDays = att ? parseNum_(att[ATT_COL.payable_days]) : 0;
  var otHours     = ot  ? parseNum_(ot[OT_COL.ot_hours])       : 0;

  if (workingDays === 0) workingDays = period.working_days;

  var basicFixed   = parseNum_(emp[EM_COL.basic_fixed]);
  var hraFixed     = parseNum_(emp[EM_COL.hra_fixed]);
  var convFixed    = parseNum_(emp[EM_COL.conveyance_fixed]);
  var specFixed    = parseNum_(emp[EM_COL.special_allow_fixed]);
  var medFixed     = parseNum_(emp[EM_COL.medical_allow_fixed]);
  var proDevFixed  = parseNum_(emp[EM_COL.professional_dev_fixed]);
  var commFixed    = parseNum_(emp[EM_COL.communication_fixed]);
  var uniFixed     = parseNum_(emp[EM_COL.uniform_fixed]);
  var washFixed    = parseNum_(emp[EM_COL.washing_fixed]);

  var factor = workingDays > 0 ? payableDays / workingDays : 0;

  // ── Earnings (NO intermediate rounding — correction #3) ────────────────────
  var basic       = basicFixed   * factor;
  var hra         = hraFixed     * factor;
  var conveyance  = convFixed    * factor;
  var special     = specFixed    * factor;
  var medical     = medFixed     * factor;
  var profDev     = proDevFixed  * factor;
  var comm        = commFixed    * factor;
  var uniform     = uniFixed     * factor;
  var washing     = washFixed    * factor;

  // OT: same rule as worker — fixed component bases (correction #7)
  var otAmount = 0;
  if (otHours > 0 && workingDays > 0) {
    var otHourlyBase = basicFixed / workingDays / 8;
    otAmount = otHourlyBase * 2 * otHours;
  }

  // Staff incentive: deferred until ~3 months of real app usage — placeholder 0
  var staffIncentive = 0;

  var grossEarnings = basic + hra + conveyance + special + medical +
                      profDev + comm + uniform + washing +
                      otAmount + staffIncentive;

  // ── Deductions ──────────────────────────────────────────────────────────────
  var pfEmployee  = calcPfEmployee_(basic, stat); // PF base = Basic only for staff
  var esiEmployee = calcEsiEmployee_(grossEarnings, stat);
  var pt          = calcPT_(grossEarnings, stat);

  var mlwf       = parseNum_(misc.mlwf)              || 0;
  var arrears    = parseNum_(misc.arrears)            || 0;
  var dispatch   = parseNum_(misc.dispatch_incentive) || 0;
  var otherAllow = parseNum_(misc.other_allowance)    || 0;
  var tds        = parseNum_(misc.tds)                || 0;
  var otherDed   = parseNum_(misc.other_deduction)    || 0;

  var totalEarnings = grossEarnings + arrears + dispatch + otherAllow;

  var totalDeductions = pfEmployee + esiEmployee + pt + adv + can + soc +
                        mlwf + tds + otherDed;
  // Round only at final net pay (correction #3)
  var netPay = Math.round(totalEarnings - totalDeductions);

  var pfEmployer  = basic <= stat.pf_wage_ceiling
    ? basic * 0.1301
    : stat.pf_wage_ceiling * 0.1301;
  var esiEmployer = grossEarnings <= stat.esi_exempt_above ? grossEarnings * 0.0325 : 0;

  return {
    basic, hra, conveyance,
    vda: 0, washing, education: 0, heat_allow: 0,
    production_allow: 0, special_allow: special,
    medical_allow: medical, professional_dev: profDev,
    communication_allow: comm, uniform_allow: uniform,
    ot_amount: otAmount,
    production_efficiency_incentive: 0,
    gross_earnings: totalEarnings,
    pf_employee: pfEmployee, esi_employee: esiEmployee, pt,
    advance_deduction: adv, canteen: can, society: soc,
    mlwf, arrears, dispatch_incentive: dispatch,
    other_allowance: otherAllow, tds, other_deduction: otherDed,
    total_deductions: totalDeductions,
    net_pay: netPay,
    pf_employer: pfEmployer, esi_employer: esiEmployer,
  };
}

// =============================================================================
// STATUTORY HELPERS
// =============================================================================

function calcPfEmployee_(pfBase, stat) {
  // 12% of min(pfBase, wage_ceiling), hard capped at PF_MAX_EMPLOYEE (₹1,800)
  var capped = Math.min(pfBase, stat.pf_wage_ceiling);
  return Math.min(Math.round(capped * stat.pf_employee_rate), stat.pf_max_employee);
}

function calcEsiEmployee_(gross, stat) {
  // 0.75% of gross; ZERO if gross > ESI exempt threshold (correction #5)
  if (gross > stat.esi_exempt_above) return 0;
  return Math.round(gross * stat.esi_employee_rate);
}

function calcPT_(gross, stat) {
  // Slab lookup against PT_SLABS from STATUTORY_CONFIG.
  // Returns 0 if slabs not configured yet (do not hardcode Maharashtra slabs
  // — they must be verified by HR/Accounts first).
  if (!stat.pt_slabs || stat.pt_slabs.length === 0) return 0;
  for (var i = 0; i < stat.pt_slabs.length; i++) {
    var slab = stat.pt_slabs[i];
    if (gross >= slab.min && (slab.max == null || gross <= slab.max)) {
      return slab.pt;
    }
  }
  return 0;
}

// =============================================================================
// DATA READERS
// =============================================================================

function readPayrollPeriod_(ss) {
  var sht = ss.getSheetByName(SHT_PAYROLL_PERIOD);
  if (!sht) throw new Error('PAYROLL_PERIOD sheet not found. Create it first.');
  var row = sht.getRange(2, 1, 1, 5).getValues()[0];
  return {
    month:        row[0] || '',
    year:         parseInt(row[1]) || new Date().getFullYear(),
    working_days: parseInt(row[2]) || 26,
    period_start: row[3] || '',
    period_end:   row[4] || '',
  };
}

function readStatutoryConfig_(ss) {
  var sht = ss.getSheetByName(SHT_STATUTORY_CONFIG);
  if (!sht) throw new Error('STATUTORY_CONFIG sheet not found.');
  var data = sht.getDataRange().getValues();
  var cfg  = {};
  data.forEach(function(row) {
    if (row[0]) cfg[row[0].toString().trim().toUpperCase()] = row[1];
  });

  var ptSlabsRaw = cfg['PT_SLABS'];
  var ptSlabs = [];
  if (ptSlabsRaw) {
    try { ptSlabs = JSON.parse(ptSlabsRaw.toString()); } catch(e) { ptSlabs = []; }
  }

  return {
    pf_wage_ceiling:   parseNum_(cfg['PF_WAGE_CEILING'])   || 15000,
    pf_employee_rate:  parseNum_(cfg['PF_EMPLOYEE_RATE'])  || 0.12,
    pf_max_employee:   parseNum_(cfg['PF_MAX_EMPLOYEE'])   || 1800,
    esi_employee_rate: parseNum_(cfg['ESI_EMPLOYEE_RATE']) || 0.0075,
    esi_exempt_above:  parseNum_(cfg['ESI_EXEMPT_ABOVE'])  || 21000,
    worker_vda_rate:   parseNum_(cfg['WORKER_VDA_RATE'])   || 103,
    worker_heat_rate:  parseNum_(cfg['WORKER_HEAT_RATE'])  || 5.78,
    pt_slabs:          ptSlabs,
  };
}

function readEmployeeMaster_(ss) {
  var sht = ss.getSheetByName(SHT_EMPLOYEE_MASTER);
  if (!sht) throw new Error('EMPLOYEE_MASTER sheet not found.');
  var data = sht.getDataRange().getValues();
  var map  = {};
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var code = row[EM_COL.emp_code];
    if (code) map[code.toString().trim()] = row;
  }
  return map;
}

// Generic reader for single-key INPUT sheets (keyed by emp_code in column 0)
function readInputSheet_(ss, sheetName, keyCol) {
  var sht = ss.getSheetByName(sheetName);
  if (!sht) return {};
  var data = sht.getDataRange().getValues();
  var map  = {};
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var key = row[keyCol];
    if (key) map[key.toString().trim()] = row;
  }
  return map;
}

// Efficiency keyed by department
function readEfficiencyByDept_(ss) {
  var sht = ss.getSheetByName(SHT_INPUT_EFFICIENCY);
  if (!sht) return {};
  var data = sht.getDataRange().getValues();
  var map  = {};
  for (var i = 1; i < data.length; i++) {
    var dept = data[i][EFF_COL.department];
    var pct  = data[i][EFF_COL.efficiency_pct];
    if (dept) map[dept.toString().trim()] = pct;
  }
  return map;
}

// Deduction sheets: returns map of emp_code → amount (number)
function readDeductionSheet_(ss, sheetName) {
  var sht = ss.getSheetByName(sheetName);
  if (!sht) return {};
  var data = sht.getDataRange().getValues();
  var map  = {};
  for (var i = 1; i < data.length; i++) {
    var code   = data[i][DED_COL.emp_code];
    var amount = data[i][DED_COL.amount];
    if (code) map[code.toString().trim()] = parseNum_(amount) || 0;
  }
  return map;
}

// MISC sheet: emp_code → {mlwf, arrears, dispatch_incentive, other_allowance, tds, other_deduction}
function readMiscSheet_(ss) {
  var sht = ss.getSheetByName(SHT_INPUT_MISC);
  if (!sht) return {};
  var data = sht.getDataRange().getValues();
  if (data.length < 2) return {};
  // Expect headers in row 1: emp_code, mlwf, arrears, dispatch_incentive,
  //                           other_allowance, tds, other_deduction
  var hdrs = data[0].map(function(h) { return h.toString().toLowerCase().trim(); });
  var map  = {};
  for (var i = 1; i < data.length; i++) {
    var row  = data[i];
    var code = row[hdrs.indexOf('emp_code')];
    if (!code) continue;
    map[code.toString().trim()] = {
      mlwf:               row[hdrs.indexOf('mlwf')]               || 0,
      arrears:            row[hdrs.indexOf('arrears')]             || 0,
      dispatch_incentive: row[hdrs.indexOf('dispatch_incentive')]  || 0,
      other_allowance:    row[hdrs.indexOf('other_allowance')]     || 0,
      tds:                row[hdrs.indexOf('tds')]                 || 0,
      other_deduction:    row[hdrs.indexOf('other_deduction')]     || 0,
    };
  }
  return map;
}

// =============================================================================
// OUTPUT HELPERS
// =============================================================================

function buildOutputRow_(emp, att, ot, result, period, category, effPct, can, adv, soc, misc) {
  var otHours     = ot  ? parseNum_(ot[OT_COL.ot_hours])          : 0;
  var workingDays = att ? parseNum_(att[ATT_COL.working_days])     : period.working_days;
  var payableDays = att ? parseNum_(att[ATT_COL.payable_days])     : 0;
  var presentDays = att ? parseNum_(att[ATT_COL.present_days])     : 0;
  var el          = att ? parseNum_(att[ATT_COL.el_availed])       : 0;
  var cl          = att ? parseNum_(att[ATT_COL.cl_availed])       : 0;
  var sl          = att ? parseNum_(att[ATT_COL.sl_availed])       : 0;

  var row = {};
  row['emp_code']   = emp[EM_COL.emp_code];
  row['name']       = emp[EM_COL.name];
  row['department'] = emp[EM_COL.department];
  row['category']   = category;
  row['month']      = period.month;
  row['year']       = period.year;
  row['working_days']  = workingDays;
  row['present_days']  = presentDays;
  row['payable_days']  = payableDays;
  row['el_availed']    = el;
  row['cl_availed']    = cl;
  row['sl_availed']    = sl;
  row['ot_hours']      = otHours;
  row['production_efficiency_pct'] = effPct != null ? effPct : '';

  // Copy all calculated fields
  OUTPUT_HEADERS.slice(12).forEach(function(col) {
    if (result.hasOwnProperty(col)) row[col] = result[col];
  });

  row['status'] = 'DRAFT';
  row['notes']  = att ? '' : 'No attendance record — all days treated as absent';

  return OUTPUT_HEADERS.map(function(h) { return row[h] != null ? row[h] : 0; });
}

function writeDraft_(ss, rows) {
  var sht = ss.getSheetByName(SHT_PAYROLL_DRAFT);
  if (!sht) sht = ss.insertSheet(SHT_PAYROLL_DRAFT);
  else sht.clearContents();

  sht.getRange(1, 1, 1, OUTPUT_HEADERS.length).setValues([OUTPUT_HEADERS]);
  if (rows.length > 0) {
    sht.getRange(2, 1, rows.length, OUTPUT_HEADERS.length).setValues(rows);
  }

  // Freeze header, auto-resize
  sht.setFrozenRows(1);
  sht.autoResizeColumns(1, OUTPUT_HEADERS.length);

  // Colour net_pay column green for quick scan
  var netIdx = OUTPUT_HEADERS.indexOf('net_pay') + 1;
  if (netIdx > 0) {
    sht.getRange(2, netIdx, Math.max(rows.length, 1)).setBackground('#d9ead3');
  }
}

function appendToSheet_(ss, sheetName, rows) {
  var sht = ss.getSheetByName(sheetName);
  if (!sht) sht = ss.insertSheet(sheetName);
  if (rows.length === 0) return;
  var lastRow = sht.getLastRow();
  if (lastRow === 0) {
    sht.getRange(1, 1, 1, OUTPUT_HEADERS.length).setValues([OUTPUT_HEADERS]);
    lastRow = 1;
  }
  sht.getRange(lastRow + 1, 1, rows.length, OUTPUT_HEADERS.length).setValues(rows);
}

// =============================================================================
// UTILITIES
// =============================================================================

function parseNum_(val) {
  if (val == null || val === '') return 0;
  var n = parseFloat(val.toString().replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

/**
 * Installs a menu in the spreadsheet for manual triggering.
 * Run once after pasting this script.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Payroll Engine')
    .addItem('Run — generate PAYROLL_DRAFT',       'runPayrollEngine')
    .addSeparator()
    .addItem('Promote draft → PAYROLL_STAFF/WORKER', 'promotePayrollDraft')
    .addSeparator()
    .addItem('Validate config tabs',                'validateConfig')
    .addToUi();
}

/**
 * Pre-flight check: verifies all required config tabs exist and are non-empty.
 * Run this before runPayrollEngine() to catch missing setup early.
 */
function validateConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var issues = [];

  function checkSheet(name, desc) {
    var sht = ss.getSheetByName(name);
    if (!sht) { issues.push('MISSING: ' + name + ' — ' + desc); return; }
    var val = sht.getRange('B2').getValue();
    if (!val) issues.push('EMPTY: ' + name + '!B2 — ' + desc + ' (at minimum B2 must be set)');
  }

  checkSheet(SHT_PAYROLL_PERIOD,   'Month, Year, Working Days required in row 2');
  checkSheet(SHT_STATUTORY_CONFIG, 'PF/ESI/PT config rows required');
  checkSheet(SHT_EMPLOYEE_MASTER,  'Employee roster with component amounts');
  checkSheet(SHT_INPUT_ATTENDANCE, 'Payable days and present days per employee');

  // Warn if PT slabs not configured
  try {
    var stat = readStatutoryConfig_(ss);
    if (!stat.pt_slabs || stat.pt_slabs.length === 0) {
      issues.push('WARNING: PT_SLABS not configured in ' + SHT_STATUTORY_CONFIG +
                  ' — PT will be calculated as ₹0. Add Maharashtra slab JSON once HR/Accounts confirm.');
    }
  } catch(e) {}

  if (issues.length === 0) {
    SpreadsheetApp.getUi().alert('✓ All config tabs present. Ready to run payroll engine.');
  } else {
    SpreadsheetApp.getUi().alert('Config issues found:\n\n' + issues.join('\n'));
  }
}

/**
 * One-time setup: adds a menu trigger. Run manually after pasting the script.
 */
function setupPayrollTriggers() {
  // The onOpen() function is automatically called by Google Sheets.
  // This function is here as a named entry point for the user to run
  // during initial setup to trigger OAuth consent.
  validateConfig();
}
