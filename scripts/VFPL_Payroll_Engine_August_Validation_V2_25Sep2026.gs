/**
 * VFPL PAYROLL ENGINE — AUGUST 2026 VALIDATION V2
 * Date: 25-Sep-2026
 * Target spreadsheet: VFL HR OS 2026 27
 * Spreadsheet ID: 10-OpV86Gvi_TlBPQ6zKQC6y7MLWqietELGU3G06exIM
 *
 * PURPOSE
 * -------
 * Apply the payroll calculation rules supplied by Accounts / labour consultant
 * to the actual August 2026 HR OS data and compare the generated result with
 * what was paid in August.
 *
 * IMPORTANT SAFETY
 * ----------------
 * - VALIDATION ONLY. It NEVER writes PAYROLL_STAFF or PAYROLL_WORKER.
 * - It NEVER sends email, creates triggers, pays employees, or calls Supabase.
 * - It writes only to 4 owned P3V2_* QA tabs.
 * - Source payroll / leave / OT workbooks are READ-ONLY.
 * - Existing production/source tabs are never cleared or rewritten.
 *
 * ACCOUNTANT / LABOUR-CONSULTANT RULES RETAINED
 * ---------------------------------------------
 * 1) Worker VDA = physical present days × 103.
 * 2) Worker heat = eligible worked days × 5.78. Eligibility is mapped from
 *    SALARY_STRUCTURE.HEAT_MASTER_INR = 150 because the current EMPLOYEE_MASTER
 *    does not contain a heat eligibility field.
 * 3) Staff keeps full precision for gross/net calculation; displayed component
 *    comparisons are rounded to rupees because the historical sheet displays
 *    those allowance components rounded.
 * 4) Worker efficiency slab: 81→4500, 82→5000, 83→6500, 84→7500, 85→8500.
 *    Below 81 = zero eligible efficiency amount. If August employee efficiency
 *    % is unavailable, the historical efficiency deduction is replayed ONLY to
 *    permit net comparison and an explicit exception is logged.
 * 5) ESI employee rule supplied by Accounts: 0.75% of gross, zero if gross >21000.
 * 6) PF employee: 12% of (Basic + VDA), capped at 1800. Staff VDA = 0.
 * 7) OT supplied rule: fixed Basic (+ fixed VDA for workers) / working days /8×2×hours.
 *    For August, this is intentionally compared against historical paid OT; any
 *    discrepancy is surfaced, not hidden.
 * 8) PT is NOT silently assumed. If no approved PT_SLABS config exists, August
 *    historical PT is replayed for net comparison and each affected row is
 *    marked PT_REPLAY_BENCHMARK.
 *
 * AUGUST INPUT BASIS
 * ------------------
 * - Attendance / present / WO / EL / CL / SL / payable/worked days:
 *   RAW_STAFF_AUG26 and RAW_WORKER_AUG26 finalized August payroll inputs.
 * - Canteen / Society / Advance / TDS / MLWF / other deductions / arrears /
 *   dispatch / other allowance / leave encashment:
 *   finalized August input columns in the RAW_* snapshots (treated as inputs,
 *   not recalculated rules).
 * - OT hours: payroll-period OT archive from the read-only Staff Payroll source
 *   OT tab, August column. This source totals 5,186 hours for the 94 August
 *   employees and is the pay-period input used for this validation.
 * - Salary rates: SALARY_STRUCTURE, source month 2026-08.
 * - Actual paid benchmark: RAW_STAFF_AUG26 / RAW_WORKER_AUG26.
 *
 * RUN ORDER
 * ---------
 * 1. Paste this file as a NEW Apps Script file, e.g. Payroll_Aug_V2.gs
 * 2. Save.
 * 3. Run validateAugustPayrollInputsV2()
 * 4. If validation says READY, run runAugustPayrollValidationV2()
 * 5. Review P3V2_AUG_SUMMARY and P3V2_AUG_EXCEPTIONS.
 *
 * DO NOT run the 24-Sep promoter function. This file has no promotion function.
 */

var P3V2_CFG = {
  TARGET_ID: '10-OpV86Gvi_TlBPQ6zKQC6y7MLWqietELGU3G06exIM',
  STAFF_PAYROLL_SOURCE_ID: '1Cct6oXSGiXJHhgKSb5W3UGVsjXGHE7Q_zo952KjUwA8',
  VERSION: 'P3V2-AUG-25SEP2026',
  PAYROLL_MONTH: '2026-08',
  RULES: {
    PF_WAGE_CEILING: 15000,
    PF_EMPLOYEE_RATE: 0.12,
    PF_MAX_EMPLOYEE: 1800,
    ESI_EMPLOYEE_RATE: 0.0075,
    ESI_EXEMPT_ABOVE: 21000,
    WORKER_VDA_RATE: 103,
    WORKER_HEAT_RATE: 5.78
  },
  EFFICIENCY_SLABS: {
    81: 4500,
    82: 5000,
    83: 6500,
    84: 7500,
    85: 8500
  },
  OWNED_TABS: {
    DRAFT: 'P3V2_AUG_DRAFT',
    COMPARE: 'P3V2_AUG_COMPARE',
    EXCEPTIONS: 'P3V2_AUG_EXCEPTIONS',
    SUMMARY: 'P3V2_AUG_SUMMARY'
  }
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Payroll August V2')
    .addItem('1. Validate August inputs', 'validateAugustPayrollInputsV2')
    .addItem('2. Run August validation', 'runAugustPayrollValidationV2')
    .addToUi();
}

function validateAugustPayrollInputsV2() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  assertTarget_(ss);

  var required = [
    'EMPLOYEE_MASTER', 'SALARY_STRUCTURE', 'RAW_STAFF_AUG26', 'RAW_WORKER_AUG26'
  ];
  var problems = [];
  required.forEach(function(name) {
    if (!ss.getSheetByName(name)) problems.push('MISSING TAB: ' + name);
  });

  if (problems.length === 0) {
    try {
      var rates = readSalaryStructure_(ss);
      if (Object.keys(rates).length !== 94) {
        problems.push('SALARY_STRUCTURE August rows expected 94, found ' + Object.keys(rates).length);
      }
      var staff = readRawStaff_(ss);
      var worker = readRawWorker_(ss);
      if (staff.length !== 75) problems.push('RAW_STAFF_AUG26 expected 75 employee rows, found ' + staff.length);
      if (worker.length !== 19) problems.push('RAW_WORKER_AUG26 expected 19 employee rows, found ' + worker.length);
      var ot = readAugustPayrollPeriodOt_();
      var otSum = sumMap_(ot);
      if (Math.abs(otSum - 5186) > 0.000001) {
        problems.push('August payroll-period OT expected 5,186 hours, found ' + otSum);
      }
    } catch (e) {
      problems.push('VALIDATION ERROR: ' + e.message);
    }
  }

  var message;
  if (problems.length) {
    message = 'NOT READY\n\n' + problems.join('\n');
  } else {
    message = 'READY FOR AUGUST VALIDATION\n\n' +
      '94 employees found (75 Staff + 19 Workers).\n' +
      'August pay-period OT = 5,186 hours.\n\n' +
      'Next run: runAugustPayrollValidationV2()';
  }
  uiAlert_(message);
  return { ready: problems.length === 0, problems: problems };
}

function runAugustPayrollValidationV2() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  assertTarget_(ss);

  var pre = validateAugustPayrollInputsV2Core_(ss);
  if (!pre.ready) throw new Error('Preflight failed: ' + pre.problems.join(' | '));

  var salary = readSalaryStructure_(ss);
  var staff = readRawStaff_(ss);
  var workers = readRawWorker_(ss);
  var otMap = readAugustPayrollPeriodOt_();
  var ptConfig = readPtSlabsIfApproved_(ss);
  var effMap = readOptionalAugustEfficiency_(ss);

  var draftRows = [];
  var compareRows = [];
  var exceptionRows = [];
  var stats = {
    total: 0, staff: 0, worker: 0,
    exactNet: 0, netDiff: 0,
    componentComparisons: 0, componentExact: 0, componentDiff: 0,
    otHourExact: 0, otAmountExact: 0,
    ptReplayRows: 0, efficiencyReplayRows: 0
  };

  staff.forEach(function(src) {
    var s = salary[src.emp_id];
    if (!s) throw new Error('No SALARY_STRUCTURE row for ' + src.emp_id);
    var otHours = num_(otMap[src.emp_id]);
    var calc = calcStaffAugustV2_(src, s, otHours, ptConfig);
    collectResult_(src, calc, 'STAFF', draftRows, compareRows, exceptionRows, stats);
  });

  workers.forEach(function(src) {
    var s = salary[src.emp_id];
    if (!s) throw new Error('No SALARY_STRUCTURE row for ' + src.emp_id);
    var otHours = num_(otMap[src.emp_id]);
    var eff = effMap[src.emp_id] || null;
    var calc = calcWorkerAugustV2_(src, s, otHours, eff, ptConfig);
    collectResult_(src, calc, 'WORKER', draftRows, compareRows, exceptionRows, stats);
  });

  if (stats.total !== 94) throw new Error('Safety stop: expected 94 employees, calculated ' + stats.total);

  writeOwnedTab_(ss, P3V2_CFG.OWNED_TABS.DRAFT, draftHeaders_(), draftRows);
  writeOwnedTab_(ss, P3V2_CFG.OWNED_TABS.COMPARE, compareHeaders_(), compareRows);
  writeOwnedTab_(ss, P3V2_CFG.OWNED_TABS.EXCEPTIONS, exceptionHeaders_(), exceptionRows);
  writeSummary_(ss, stats, exceptionRows, ptConfig, effMap);

  uiAlert_(
    'August V2 validation complete.\n\n' +
    'Employees: ' + stats.total + '\n' +
    'Exact generated net: ' + stats.exactNet + '\n' +
    'Net differences: ' + stats.netDiff + '\n' +
    'Exceptions logged: ' + exceptionRows.length + '\n\n' +
    'Review ' + P3V2_CFG.OWNED_TABS.SUMMARY + ' first.\n' +
    'No production payroll tabs were changed.'
  );
}

function validateAugustPayrollInputsV2Core_(ss) {
  var problems = [];
  ['EMPLOYEE_MASTER','SALARY_STRUCTURE','RAW_STAFF_AUG26','RAW_WORKER_AUG26'].forEach(function(n) {
    if (!ss.getSheetByName(n)) problems.push('Missing ' + n);
  });
  if (problems.length) return {ready:false, problems:problems};
  try {
    var s = readSalaryStructure_(ss);
    var a = readRawStaff_(ss);
    var w = readRawWorker_(ss);
    var o = readAugustPayrollPeriodOt_();
    if (Object.keys(s).length !== 94) problems.push('SALARY_STRUCTURE August count !=94');
    if (a.length !== 75) problems.push('Staff count !=75');
    if (w.length !== 19) problems.push('Worker count !=19');
    if (Math.abs(sumMap_(o) - 5186) > 0.000001) problems.push('August pay-period OT !=5186');
  } catch(e) { problems.push(e.message); }
  return {ready:problems.length===0, problems:problems};
}

// -----------------------------------------------------------------------------
// ACCOUNTANT / CONSULTANT CALCULATIONS
// -----------------------------------------------------------------------------

function calcStaffAugustV2_(src, sal, otHours, ptConfig) {
  var wd = src.working_days;
  var payable = src.worked_days;
  var factor = wd > 0 ? payable / wd : 0;

  // Consultant instruction: retain precision for net calculation.
  var basicRaw = sal.basic_pm * factor;
  var hraRaw = sal.hra_pm * factor;
  var conveyRaw = sal.convey_pm * factor;
  var eduRaw = sal.education_pm * factor;
  var medRaw = sal.medical_pm * factor;
  var proRaw = sal.pro_dev_pm * factor;
  var commRaw = sal.communication_pm * factor;
  var uniformRaw = sal.uniform_pm * factor;
  var washingRaw = sal.washing_pm * factor;

  // Historical base gross uses full-precision source fixed gross × payable factor.
  var baseGrossRaw = sal.fixed_gross_pm * factor;

  var otAmount = wd > 0 ? ((sal.basic_pm / wd) / 8) * 2 * otHours : 0;

  // Preserve Accounts-head engine treatment: ESI base is payroll gross before
  // arrears/dispatch/other post-gross adjustments.
  var grossForEsi = baseGrossRaw + otAmount;
  var pf = calcPf_(basicRaw);
  var esi = calcEsi_(grossForEsi);
  var ptInfo = calcPtOrReplay_(grossForEsi, src.paid_pt, ptConfig);

  var deductions = pf + esi + ptInfo.amount + src.canteen + src.society + src.salary_advance +
                   src.tds + src.mlwf + src.other_deduction;
  var totalEarnings = baseGrossRaw + src.arrears + otAmount + src.dispatch_incentive + src.other_allowance;
  var net = Math.round(totalEarnings - deductions);

  return {
    values: {
      BASIC: Math.round(basicRaw), HRA: Math.round(hraRaw), CONVEYANCE: Math.round(conveyRaw),
      EDUCATION: Math.round(eduRaw), MEDICAL: Math.round(medRaw), PRO_DEV: Math.round(proRaw),
      COMMUNICATION: Math.round(commRaw), UNIFORM: Math.round(uniformRaw), WASHING: Math.round(washingRaw),
      BASE_GROSS: baseGrossRaw, OT_HOURS: otHours, OT_AMOUNT: otAmount,
      PF_EMPLOYEE: pf, ESI_EMPLOYEE: esi, PT: ptInfo.amount,
      CANTEEN: src.canteen, SOCIETY: src.society, ADVANCE: src.salary_advance,
      TDS: src.tds, MLWF: src.mlwf, OTHER_DEDUCTION: src.other_deduction,
      ARREARS: src.arrears, DISPATCH: src.dispatch_incentive, OTHER_ALLOWANCE: src.other_allowance,
      TOTAL_DEDUCTIONS: deductions, TOTAL_EARNINGS: totalEarnings, NET_PAY: net
    },
    actual: src.actual,
    flags: ptInfo.replayed ? ['PT_REPLAY_BENCHMARK'] : [],
    notes: ptInfo.replayed ? 'PT config absent/unapproved; historical August PT replayed only for net comparison.' : ''
  };
}

function calcWorkerAugustV2_(src, sal, otHours, eff, ptConfig) {
  var wd = src.working_days;
  var payable = src.worked_days;
  var present = src.present_days;
  var factor = wd > 0 ? payable / wd : 0;

  // Historical worker component formulas round each earned component.
  var basic = Math.round(sal.basic_pm * factor);
  var hra = Math.round(sal.hra_pm * factor);
  var convey = Math.round(sal.convey_pm * factor);
  var washing = Math.round(sal.washing_pm * factor);
  var education = Math.round(sal.education_pm * factor);
  var heat = sal.heat_master === 150 ? Math.round(payable * P3V2_CFG.RULES.WORKER_HEAT_RATE) : 0;
  var vda = Math.round(present * P3V2_CFG.RULES.WORKER_VDA_RATE);

  // Production allowance remains a separate earning component.
  var production = sal.production_master;

  // Accountant-supplied OT rule: fixed Basic + fixed VDA, not prorated.
  var otAmount = wd > 0 ? (((sal.basic_pm + sal.vda_master) / wd) / 8) * 2 * otHours : 0;

  var effInfo = calcEfficiencyOrReplay_(src, eff, production);

  var baseGross = basic + hra + convey + washing + education;
  var totalEarnings = baseGross + heat + vda + production + otAmount + src.dispatch_incentive +
                      src.other_allowance + src.leave_encashment + src.arrears;

  var pf = calcPf_(basic + vda);
  // Preserve Accounts-head engine treatment: ESI base is worker payroll gross
  // before post-gross dispatch/other/leave-encashment/arrears adjustments.
  var grossForEsi = baseGross + heat + vda + production + otAmount;
  var esi = calcEsi_(grossForEsi);
  var ptInfo = calcPtOrReplay_(totalEarnings, src.paid_pt, ptConfig);

  // Production efficiency is a deduction/adjustment distinct from production earning.
  var deductions = pf + esi + ptInfo.amount + src.canteen + src.society + src.salary_advance +
                   effInfo.deduction + src.mlwf + src.other_deduction;
  var net = Math.round(totalEarnings - deductions);

  var flags = [];
  if (ptInfo.replayed) flags.push('PT_REPLAY_BENCHMARK');
  if (effInfo.replayed) flags.push('EFFICIENCY_REPLAY_BENCHMARK');

  return {
    values: {
      BASIC: basic, HRA: hra, CONVEYANCE: convey, WASHING: washing, EDUCATION: education,
      HEAT: heat, VDA: vda, PRODUCTION_ALLOWANCE: production,
      EFFICIENCY_PCT: effInfo.pct, EFFICIENCY_ELIGIBLE_AMOUNT: effInfo.eligible,
      EFFICIENCY_DEDUCTION: effInfo.deduction,
      BASE_GROSS: baseGross, OT_HOURS: otHours, OT_AMOUNT: otAmount,
      PF_EMPLOYEE: pf, ESI_EMPLOYEE: esi, PT: ptInfo.amount,
      CANTEEN: src.canteen, SOCIETY: src.society, ADVANCE: src.salary_advance,
      MLWF: src.mlwf, OTHER_DEDUCTION: src.other_deduction,
      DISPATCH: src.dispatch_incentive, OTHER_ALLOWANCE: src.other_allowance,
      LEAVE_ENCASHMENT: src.leave_encashment, ARREARS: src.arrears,
      TOTAL_DEDUCTIONS: deductions, TOTAL_EARNINGS: totalEarnings, NET_PAY: net
    },
    actual: src.actual,
    flags: flags,
    notes: flags.join('; ')
  };
}

function calcPf_(pfBase) {
  var r = P3V2_CFG.RULES;
  var eligible = Math.min(pfBase, r.PF_WAGE_CEILING);
  return Math.min(Math.round(eligible * r.PF_EMPLOYEE_RATE), r.PF_MAX_EMPLOYEE);
}

function calcEsi_(gross) {
  var r = P3V2_CFG.RULES;
  if (gross > r.ESI_EXEMPT_ABOVE) return 0;
  return Math.round(gross * r.ESI_EMPLOYEE_RATE);
}

function calcPtOrReplay_(gross, historicalPt, ptConfig) {
  if (ptConfig && ptConfig.length) {
    for (var i = 0; i < ptConfig.length; i++) {
      var s = ptConfig[i];
      if (gross >= s.min && (s.max == null || gross <= s.max)) {
        return {amount:num_(s.pt), replayed:false};
      }
    }
    return {amount:0, replayed:false};
  }
  return {amount:num_(historicalPt), replayed:true};
}

function calcEfficiencyOrReplay_(src, eff, productionAllowance) {
  if (eff && eff.pct != null && eff.pct !== '') {
    var pct = num_(eff.pct);
    var roundedPct = Math.floor(pct);
    var eligible = 0;
    if (roundedPct >= 85) eligible = 8500;
    else if (roundedPct >= 84) eligible = 7500;
    else if (roundedPct >= 83) eligible = 6500;
    else if (roundedPct >= 82) eligible = 5000;
    else if (roundedPct >= 81) eligible = 4500;
    else eligible = 0;

    // Physical-present-day adjustment supplied by management: the exact proration
    // denominator is not encoded because it has not been independently documented.
    // If INPUT_EFFICIENCY supplies an approved_amount, use it. Otherwise use slab
    // amount as eligible amount and surface a review note through exceptions.
    if (eff.approved_amount != null && eff.approved_amount !== '') eligible = num_(eff.approved_amount);

    return {
      pct:pct,
      eligible:eligible,
      deduction:Math.max(0, productionAllowance - eligible),
      replayed:false
    };
  }

  return {
    pct:'',
    eligible:Math.max(0, productionAllowance - src.production_efficiency_deduction),
    deduction:src.production_efficiency_deduction,
    replayed:true
  };
}

// -----------------------------------------------------------------------------
// INPUT READERS — LIVE HR OS SCHEMA
// -----------------------------------------------------------------------------

function readSalaryStructure_(ss) {
  var sh = ss.getSheetByName('SALARY_STRUCTURE');
  if (!sh) throw new Error('SALARY_STRUCTURE missing');
  var data = sh.getDataRange().getValues();
  var h = headerMap_(data[0]);
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var id = cleanId_(r[h.EMP_ID]);
    if (!id) continue;
    if (String(r[h.SOURCE_PAYROLL_MONTH]) !== P3V2_CFG.PAYROLL_MONTH) continue;
    var cat = String(r[h.PAYROLL_CATEGORY] || '').toUpperCase();
    if (cat !== 'STAFF' && cat !== 'PERMANENT_WORKER') continue;
    map[id] = {
      category: cat,
      basic_pm: num_(r[h.BASIC_PM_INR]),
      hra_pm: num_(r[h.HRA_PM_INR]),
      convey_pm: num_(r[h.CONVEYANCE_PM_INR]),
      education_pm: num_(r[h.EDUCATION_PM_INR]),
      medical_pm: num_(r[h.MEDICAL_PM_INR]),
      pro_dev_pm: num_(r[h.PRO_DEV_PM_INR]),
      communication_pm: num_(r[h.COMMUNICATION_PM_INR]),
      uniform_pm: num_(r[h.UNIFORM_PM_INR]),
      washing_pm: num_(r[h.WASHING_PM_INR]),
      heat_master: num_(r[h.HEAT_MASTER_INR]),
      vda_master: num_(r[h.VDA_MASTER_INR]),
      production_master: num_(r[h.PRODUCTION_MASTER_INR]),
      fixed_gross_pm: num_(r[h.FIXED_GROSS_PM_AS_SOURCE_INR]),
      version_state: String(r[h.VERSION_STATE] || '')
    };
  }
  return map;
}

function readRawStaff_(ss) {
  var sh = ss.getSheetByName('RAW_STAFF_AUG26');
  var data = sh.getRange(4,1,75,70).getValues();
  var out = [];
  for (var i=0;i<data.length;i++) {
    var r=data[i], id=cleanId_(r[0]); if(!id) continue;
    out.push({
      population:'STAFF', emp_id:id, name:r[1], source_row:i+4,
      working_days:num_(r[27]), present_days:num_(r[28]), wo_days:num_(r[29]),
      el:num_(r[30]), cl:num_(r[31]), sl:num_(r[32]), ph:num_(r[33]), worked_days:num_(r[34]),
      arrears:num_(r[45]), canteen:num_(r[54]), society:num_(r[55]), salary_advance:num_(r[56]),
      tds:num_(r[57]), mlwf:num_(r[58]), other_deduction:num_(r[59]),
      dispatch_incentive:num_(r[65]), other_allowance:num_(r[66]),
      paid_pt:num_(r[49]),
      actual:{
        BASIC:num_(r[36]), HRA:num_(r[37]), CONVEYANCE:num_(r[38]), EDUCATION:num_(r[39]),
        MEDICAL:num_(r[40]), PRO_DEV:num_(r[41]), COMMUNICATION:num_(r[42]), UNIFORM:num_(r[43]), WASHING:num_(r[44]),
        BASE_GROSS:num_(r[46]), OT_HOURS:num_(r[63]), OT_AMOUNT:num_(r[64]),
        PF_EMPLOYEE:num_(r[47]), ESI_EMPLOYEE:num_(r[48]), PT:num_(r[49]),
        CANTEEN:num_(r[54]), SOCIETY:num_(r[55]), ADVANCE:num_(r[56]), TDS:num_(r[57]), MLWF:num_(r[58]),
        OTHER_DEDUCTION:num_(r[59]), ARREARS:num_(r[45]), DISPATCH:num_(r[65]), OTHER_ALLOWANCE:num_(r[66]),
        TOTAL_DEDUCTIONS:num_(r[61]), NET_PAY:num_(r[62])
      }
    });
  }
  return out;
}

function readRawWorker_(ss) {
  var sh = ss.getSheetByName('RAW_WORKER_AUG26');
  var data = sh.getRange(4,1,19,68).getValues();
  var out=[];
  for (var i=0;i<data.length;i++) {
    var r=data[i], id=cleanId_(r[0]); if(!id) continue;
    out.push({
      population:'WORKER', emp_id:id, name:r[1], source_row:i+4,
      working_days:num_(r[25]), present_days:num_(r[26]), wo_days:num_(r[27]),
      el:num_(r[28]), cl:num_(r[29]), sl:num_(r[30]), worked_days:num_(r[31]),
      canteen:num_(r[50]), society:num_(r[51]), salary_advance:num_(r[52]),
      production_efficiency_deduction:num_(r[53]), mlwf:num_(r[54]), other_deduction:num_(r[55]),
      dispatch_incentive:num_(r[60]), other_allowance:num_(r[61]), leave_encashment:num_(r[62]), arrears:num_(r[63]),
      paid_pt:num_(r[45]),
      actual:{
        BASIC:num_(r[33]), HRA:num_(r[34]), CONVEYANCE:num_(r[35]), WASHING:num_(r[36]), EDUCATION:num_(r[37]),
        HEAT:num_(r[38]), VDA:num_(r[39]), PRODUCTION_ALLOWANCE:num_(r[40]), BASE_GROSS:num_(r[41]),
        PF_EMPLOYEE:num_(r[43]), ESI_EMPLOYEE:num_(r[44]), PT:num_(r[45]),
        CANTEEN:num_(r[50]), SOCIETY:num_(r[51]), ADVANCE:num_(r[52]), EFFICIENCY_DEDUCTION:num_(r[53]),
        MLWF:num_(r[54]), OTHER_DEDUCTION:num_(r[55]), TOTAL_DEDUCTIONS:num_(r[56]), NET_PAY:num_(r[57]),
        OT_HOURS:num_(r[58]), OT_AMOUNT:num_(r[59]), DISPATCH:num_(r[60]), OTHER_ALLOWANCE:num_(r[61]),
        LEAVE_ENCASHMENT:num_(r[62]), ARREARS:num_(r[63]), TOTAL_EARNINGS:num_(r[42])
      }
    });
  }
  return out;
}

function readAugustPayrollPeriodOt_() {
  var src = SpreadsheetApp.openById(P3V2_CFG.STAFF_PAYROLL_SOURCE_ID);
  var sh = src.getSheetByName('OT');
  if (!sh) throw new Error('Read-only source OT tab missing');
  var data = sh.getRange(1,1,sh.getLastRow(),7).getValues();
  var map={};
  for(var i=2;i<data.length;i++) {
    var id=cleanId_(data[i][0]); if(!id) continue;
    var hrs=num_(data[i][6]);
    if (map.hasOwnProperty(id)) throw new Error('Duplicate Employee ID in payroll-period OT source: '+id);
    map[id]=hrs;
  }
  return map;
}

function readPtSlabsIfApproved_(ss) {
  var sh=ss.getSheetByName('STATUTORY_CONFIG');
  if(!sh || sh.getLastRow()<1) return [];
  var data=sh.getDataRange().getValues(), raw='';
  for(var i=0;i<data.length;i++) if(String(data[i][0]||'').trim().toUpperCase()==='PT_SLABS') raw=data[i][1];
  if(!raw) return [];
  try { var slabs=JSON.parse(String(raw)); return Array.isArray(slabs)?slabs:[]; }
  catch(e) { return []; }
}

function readOptionalAugustEfficiency_(ss) {
  var sh=ss.getSheetByName('INPUT_EFFICIENCY');
  if(!sh || sh.getLastRow()<2) return {};
  var data=sh.getDataRange().getValues();
  var hm=headerMap_(data[0]);
  var empIx=firstHeader_(hm,['EMP_ID','EMP_CODE','EMPLOYEE_ID']);
  var monthIx=firstHeader_(hm,['PAYROLL_MONTH','PERIOD','MONTH']);
  var pctIx=firstHeader_(hm,['EFFICIENCY_PCT','EFFICIENCY_PERCENT','EFFICIENCY_ACHIEVED_PCT']);
  var amountIx=firstHeader_(hm,['APPROVED_AMOUNT_INR','INCENTIVE_AMOUNT_INR','EFFICIENCY_AMOUNT_INR']);
  var approvalIx=firstHeader_(hm,['APPROVAL_STATUS','STATUS']);
  if(empIx<0 || pctIx<0) return {};
  var out={};
  for(var i=1;i<data.length;i++) {
    var row=data[i], id=cleanId_(row[empIx]); if(!id) continue;
    if(monthIx>=0 && !isAug2026_(row[monthIx])) continue;
    if(approvalIx>=0 && String(row[approvalIx]||'').toUpperCase()!=='APPROVED') continue;
    if(out[id]) throw new Error('Duplicate approved INPUT_EFFICIENCY August row for '+id);
    out[id]={pct:row[pctIx], approved_amount:amountIx>=0?row[amountIx]:''};
  }
  return out;
}

// -----------------------------------------------------------------------------
// OUTPUT / COMPARISON
// -----------------------------------------------------------------------------

function collectResult_(src, calc, population, draftRows, compareRows, exceptionRows, stats) {
  stats.total++; if(population==='STAFF') stats.staff++; else stats.worker++;
  var v=calc.values, actual=calc.actual;

  draftRows.push([
    P3V2_CFG.VERSION,population,src.emp_id,src.name,src.source_row,
    src.working_days,src.present_days,src.wo_days,src.el,src.cl,src.sl,src.worked_days,
    v.BASIC||0,v.HRA||0,v.CONVEYANCE||0,v.EDUCATION||0,v.MEDICAL||0,v.PRO_DEV||0,
    v.COMMUNICATION||0,v.UNIFORM||0,v.WASHING||0,v.HEAT||0,v.VDA||0,v.PRODUCTION_ALLOWANCE||0,
    v.EFFICIENCY_PCT==null?'':v.EFFICIENCY_PCT,v.EFFICIENCY_ELIGIBLE_AMOUNT||0,v.EFFICIENCY_DEDUCTION||0,
    v.OT_HOURS||0,v.OT_AMOUNT||0,v.ARREARS||0,v.DISPATCH||0,v.OTHER_ALLOWANCE||0,v.LEAVE_ENCASHMENT||0,
    v.PF_EMPLOYEE||0,v.ESI_EMPLOYEE||0,v.PT||0,v.CANTEEN||0,v.SOCIETY||0,v.ADVANCE||0,v.TDS||0,v.MLWF||0,
    v.OTHER_DEDUCTION||0,v.TOTAL_EARNINGS||0,v.TOTAL_DEDUCTIONS||0,v.NET_PAY||0,
    calc.flags.join('|'),calc.notes
  ]);

  var keys = comparisonKeys_(population);
  keys.forEach(function(key) {
    var generated=num_(v[key]), paid=num_(actual[key]), diff=generated-paid;
    stats.componentComparisons++;
    if(Math.abs(diff)<0.000001) stats.componentExact++; else stats.componentDiff++;
    compareRows.push([P3V2_CFG.VERSION,population,src.emp_id,src.name,key,generated,paid,diff,
      Math.abs(diff)<0.000001?'MATCH':'DIFFERENCE',src.source_row,calc.flags.join('|')]);
  });

  if (Math.abs(num_(v.OT_HOURS)-num_(actual.OT_HOURS))<0.000001) stats.otHourExact++;
  if (Math.abs(num_(v.OT_AMOUNT)-num_(actual.OT_AMOUNT))<0.000001) stats.otAmountExact++;

  var netDiff=num_(v.NET_PAY)-num_(actual.NET_PAY);
  if(Math.abs(netDiff)<0.000001) stats.exactNet++; else stats.netDiff++;

  calc.flags.forEach(function(flag) {
    if(flag==='PT_REPLAY_BENCHMARK') stats.ptReplayRows++;
    if(flag==='EFFICIENCY_REPLAY_BENCHMARK') stats.efficiencyReplayRows++;
    exceptionRows.push([P3V2_CFG.VERSION,population,src.emp_id,src.name,flag,'INPUT/RULE',
      flag==='PT_REPLAY_BENCHMARK'?'No approved PT_SLABS config: August paid PT replayed for net comparison only.':'No approved per-worker August efficiency %: historical efficiency deduction replayed for net comparison only.',
      'REQUIRES SOURCE/RULE CONFIRMATION']);
  });

  if(Math.abs(netDiff)>=0.000001) {
    exceptionRows.push([P3V2_CFG.VERSION,population,src.emp_id,src.name,'NET_DIFFERENCE','CALCULATION',
      'Generated net '+v.NET_PAY+' vs paid '+actual.NET_PAY+'; difference '+netDiff,
      'REVIEW COMPONENT DIFFERENCES']);
  }

  if(population==='WORKER' && Math.abs(num_(v.OT_AMOUNT)-num_(actual.OT_AMOUNT))>=0.000001) {
    exceptionRows.push([P3V2_CFG.VERSION,population,src.emp_id,src.name,'WORKER_OT_AMOUNT_DIFFERENCE','OT',
      'Consultant OT rule using August fixed Basic+VDA generates '+v.OT_AMOUNT+' vs paid '+actual.OT_AMOUNT+'. Historical paid basis appears different; do not suppress variance.',
      'ACCOUNTS/HR REVIEW']);
  }
}

function comparisonKeys_(population) {
  if(population==='STAFF') return [
    'BASIC','HRA','CONVEYANCE','EDUCATION','MEDICAL','PRO_DEV','COMMUNICATION','UNIFORM','WASHING',
    'BASE_GROSS','OT_HOURS','OT_AMOUNT','PF_EMPLOYEE','ESI_EMPLOYEE','PT','CANTEEN','SOCIETY','ADVANCE','TDS','MLWF',
    'OTHER_DEDUCTION','ARREARS','DISPATCH','OTHER_ALLOWANCE','TOTAL_DEDUCTIONS','NET_PAY'
  ];
  return [
    'BASIC','HRA','CONVEYANCE','WASHING','EDUCATION','HEAT','VDA','PRODUCTION_ALLOWANCE','EFFICIENCY_DEDUCTION',
    'BASE_GROSS','OT_HOURS','OT_AMOUNT','PF_EMPLOYEE','ESI_EMPLOYEE','PT','CANTEEN','SOCIETY','ADVANCE','MLWF',
    'OTHER_DEDUCTION','DISPATCH','OTHER_ALLOWANCE','LEAVE_ENCASHMENT','ARREARS','TOTAL_DEDUCTIONS','NET_PAY'
  ];
}

function writeSummary_(ss, stats, exceptions, ptConfig, effMap) {
  var rows=[
    ['METRIC','VALUE','INTERPRETATION'],
    ['Engine version',P3V2_CFG.VERSION,'Validation-only; accountant/labour-consultant calculation rules mapped to HR OS'],
    ['Employees calculated',stats.total,'Expected 94'],
    ['Staff',stats.staff,'Expected 75'],
    ['Workers',stats.worker,'Expected 19'],
    ['Component comparisons',stats.componentComparisons,'Generated vs paid August components'],
    ['Exact component matches',stats.componentExact,'No tolerance; numeric exact'],
    ['Component differences',stats.componentDiff,'Review in P3V2_AUG_COMPARE'],
    ['Exact net-pay matches',stats.exactNet,'Generated net equals August paid net'],
    ['Net-pay differences',stats.netDiff,'Requires component review'],
    ['OT hours exact employee matches',stats.otHourExact,'Pay-period August OT source vs payroll'],
    ['OT amount exact employee matches',stats.otAmountExact,'Consultant OT formula vs paid August OT amount'],
    ['PT benchmark replay rows',stats.ptReplayRows,ptConfig.length?'0 expected when approved PT config used':'PT config absent; paid PT replayed only for net comparison'],
    ['Efficiency benchmark replay rows',stats.efficiencyReplayRows,Object.keys(effMap).length?'Some INPUT_EFFICIENCY records available':'No approved August per-worker efficiency rows available'],
    ['Exceptions',exceptions.length,'Review before any production payroll work'],
    ['Production payroll written','NO','PAYROLL_STAFF / PAYROLL_WORKER untouched'],
    ['Payslips/emails/bank/Supabase','NO','No release actions exist in this file']
  ];
  writeOwnedTab_(ss,P3V2_CFG.OWNED_TABS.SUMMARY,rows[0],rows.slice(1));
}

function draftHeaders_(){return ['VERSION','POPULATION','EMP_ID','NAME','SOURCE_ROW','WORKING_DAYS','PRESENT_DAYS','WO_DAYS','EL','CL','SL','WORKED_PAYABLE_DAYS','BASIC','HRA','CONVEYANCE','EDUCATION','MEDICAL','PRO_DEV','COMMUNICATION','UNIFORM','WASHING','HEAT','VDA','PRODUCTION_ALLOWANCE','EFFICIENCY_PCT','EFFICIENCY_ELIGIBLE_AMOUNT','EFFICIENCY_DEDUCTION','OT_HOURS','OT_AMOUNT','ARREARS','DISPATCH','OTHER_ALLOWANCE','LEAVE_ENCASHMENT','PF_EMPLOYEE','ESI_EMPLOYEE','PT','CANTEEN','SOCIETY','ADVANCE','TDS','MLWF','OTHER_DEDUCTION','TOTAL_EARNINGS','TOTAL_DEDUCTIONS','GENERATED_NET_PAY','FLAGS','NOTES'];}
function compareHeaders_(){return ['VERSION','POPULATION','EMP_ID','NAME','COMPONENT','GENERATED','PAID_AUGUST','DIFFERENCE','STATUS','SOURCE_ROW','FLAGS'];}
function exceptionHeaders_(){return ['VERSION','POPULATION','EMP_ID','NAME','EXCEPTION_CODE','AREA','DETAIL','ACTION'];}

function writeOwnedTab_(ss,name,headers,rows) {
  var sh=ss.getSheetByName(name);
  if(sh) {
    var marker=String(sh.getRange(1,1).getValue()||'');
    if(marker && marker.indexOf('VFL_P3V2_')!==0) throw new Error('Safety stop: '+name+' exists but is not P3V2-owned');
    sh.clearContents();
  } else sh=ss.insertSheet(name);
  var marker='VFL_P3V2_'+name+'|'+P3V2_CFG.VERSION;
  sh.getRange(1,1).setValue(marker);
  sh.getRange(2,1,1,headers.length).setValues([headers]);
  if(rows.length) sh.getRange(3,1,rows.length,headers.length).setValues(rows);
  sh.setFrozenRows(2);
  sh.autoResizeColumns(1,Math.min(headers.length,30));
}

// -----------------------------------------------------------------------------
// UTILITIES
// -----------------------------------------------------------------------------

function assertTarget_(ss){if(ss.getId()!==P3V2_CFG.TARGET_ID)throw new Error('Wrong spreadsheet. Open VFL HR OS 2026 27 before running.');}
function cleanId_(v){return String(v==null?'':v).trim().toUpperCase();}
function num_(v){if(v==null||v==='')return 0;var n=Number(String(v).replace(/[₹,\s]/g,''));return isFinite(n)?n:0;}
function sumMap_(m){var s=0;Object.keys(m).forEach(function(k){s+=num_(m[k]);});return s;}
function headerMap_(row){var m={};(row||[]).forEach(function(v,i){m[String(v||'').trim().toUpperCase()]=i;});return m;}
function firstHeader_(hm,names){for(var i=0;i<names.length;i++)if(hm.hasOwnProperty(names[i]))return hm[names[i]];return -1;}
function isAug2026_(v){var s=String(v||'').trim().toLowerCase();return s==='2026-08'||s==='aug 2026'||s==='august 2026'||s==='august'||s==='aug';}
function uiAlert_(msg){try{SpreadsheetApp.getUi().alert(msg);}catch(e){Logger.log(msg);}}
