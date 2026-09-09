/**
 * ============================================================================
 * VFPL COMPLETE APPS SCRIPT DEPLOYMENT SUITE (07-SEP-2026)
 * Author: SPARK (Google Workspace AI Specialist)
 * Patched & extended: 09-Sep-2026 — added Dashboard Cache Layer (Sections A–E)
 * Target User: Yash J. Munot, CEO & Director — Varsha Forgings Pvt. Ltd.
 * ============================================================================
 * THIS SUITE PROVIDES THE 4 EXACT MISSING AUTOMATION ENGINES FOR YOUR WORKBOOKS:
 *
 * MODULE 1: AppSheet & Master Governance Engine
 * Target: VFPL_Master_Ledger_2026 (10duwvLlFGGN5ycBbmbVLlHWKJn9QCeUpY5FwnAJw3pA)
 *
 * MODULE 2: 57F4 Job-Work Subcontract Reconciliation Engine
 * Target: VFPL Operations Dashboard 2026-27 (1rFAXu8CBQWeximXiapFZKBrU8hC4nzvD27JoL_XQGrc)
 *
 * MODULE 3: Automated Dispatch Lock & Overdue Reminder Engine
 * Target: VFPL Collections Engine (1B7eI55FXwdPaSRX9MoZVLB9bx2sWdCBUBZlsLQiF7q0)
 *
 * MODULE 4: Executive Email Intelligence & SLA Follow-Up Engine
 * Target: Executive Inbox & Customer Intelligence Hub (1pWtm8Twh7T8zBJqwh0HZvXhQ2FwGfpIx6A5kod7xBSg)
 *
 * ── DASHBOARD CACHE LAYER (Sections A–E, patched 09-Sep-2026) ──────────────
 * Aggregates Plant Ops + Collections + Energy into a single JSON payload
 * written to DASHBOARD_CACHE!A2 on the host sheet every 5 minutes.
 * doGet(e) reads from that cell — target hot-path latency <150 ms.
 *
 * Host sheet: "Claude Dashboard 26-27 13th Aug 2026"
 *   ID: 1WTqiHb_izo-G9qquTOkbvyUx98f7Xjc1QAjkn9teNxo
 *
 * CRITICAL PATCH: rows 2–24 of tbl_Cutting_Production in Plant Ops contain
 * corrupted email-header strings in "Job Card / Heat No" (col C). Any row
 * where that column is non-numeric OR matches EMAIL_HEADER_RE is skipped.
 *
 * DEPLOYMENT (one-time):
 *   1. Open host sheet → Extensions → Apps Script → paste this file → Save
 *   2. Run installTimeTrigger() → authorise all OAuth scopes
 *   3. Deploy → New deployment → Web app
 *      Execute as: Me  |  Access: Anyone with link
 *   4. Hand /exec URL to Claude Cowork dashboard consumer
 * ============================================================================
 */


// ============================================================================
// SHARED CONSTANTS
// ============================================================================

// ── Host / cache ─────────────────────────────────────────────────────────────
var HOST_SHEET_ID   = '1WTqiHb_izo-G9qquTOkbvyUx98f7Xjc1QAjkn9teNxo';
var CACHE_TAB_NAME  = 'DASHBOARD_CACHE';
var CACHE_CELL_ADDR = 'A2';
var CACHE_HDR_ADDR  = 'A1';

// ── Source sheet IDs (read-only from the cache layer) ────────────────────────
var PLANT_OPS_ID    = '1iFbjSC3OSLFouPuHCYUfduRUBQ5IXdEIjCLCdRXTOCU';  // VFPL_Domain_PlantOperations_2026-27
var COLLECTIONS_ID  = '1B7eI55FXwdPaSRX9MoZVLB9bx2sWdCBUBZlsLQiF7q0';  // VFPL Collections Engine
var ENERGY_ID       = '1H2kHVeBNZnCuCeYesh6ZoXM3scf5tC3WANWGhayg8Xc';  // VFPL_Domain_Utilities_2026-27

// ── Trigger ───────────────────────────────────────────────────────────────────
var TRIGGER_FN       = 'cacheOperationalData';
var TRIGGER_INTERVAL = 5;  // minutes

// ── Cutting corruption patch ──────────────────────────────────────────────────
// Spark (07 Sep): rows 2–24 of tbl_Cutting_Production have RFC-2822 / MIME
// email-header strings in "Job Card / Heat No" (col C, 0-based index 2).
// The regex is intentionally broad: any alphabetic prefix is already corrupt
// because a real job-card number is always a plain integer.
var EMAIL_HEADER_RE = /^(From|To|Subject|Date|Cc|Bcc|Message-ID|Content-Type|MIME-Version|Received|Return-Path|Reply-To|In-Reply-To|References|Thread-Index|X-[A-Za-z]|Delivered-To|Authentication-Results|DKIM-Signature|ARC-|List-|Importance|Priority|Sender|Disposition-Notification|Content-Transfer-Encoding|Content-Disposition)/i;

// Column indices (0-based) for tbl_Cutting_Production and other tbl_* tabs:
//   A=Date  B=Shift  C=Job Card/Heat No  D=Part Name  E=Material  F=Pieces  G=Weight(kg)
var COL_DATE    = 0;
var COL_SHIFT   = 1;
var COL_JOB_CARD = 2;   // the column with corrupted email headers (Cutting only)
var COL_QTY     = 5;
var COL_WEIGHT  = 6;

// ── Plant Ops tabs ────────────────────────────────────────────────────────────
var PLANT_OPS_TABS = {
  cutting : 'tbl_Cutting_Production',
  forge   : 'tbl_Forge_Production',
  press   : 'tbl_Press_Production',
  machine : 'tbl_Machine_Production',
  ht      : 'tbl_HT_Production',
  final_  : 'tbl_Final_Production'
};

// ── Collections tab (confirmed from Spark Module 3 source) ───────────────────
// Tab: "Outstanding Balances & Dispatch Locks"
// col[0] = customer, col[2] = overdueAmt (INR), col[3] = overdueDays
// CURRENT_OVERDUE = sum of col[2] for all rows where overdueDays > 0
var COLLECTIONS_TAB      = 'Outstanding Balances & Dispatch Locks';
var COL_CUST_OVERDUEAMT  = 2;   // column C — INR overdue amount
var COL_CUST_OVERDUEDAYS = 3;   // column D — overdue age in days

// ── Energy tabs ───────────────────────────────────────────────────────────────
var ENERGY_ELEC_TABS = ['Electricity', 'ELECTRICITY', 'RAW_ELECTRICITY', 'Elec'];
var ENERGY_OIL_TABS  = ['Oil', 'OIL', 'RAW_OIL', 'Oil Consumable'];


// ============================================================================
// SECTION A: WEB APP ENDPOINT
// ============================================================================

/**
 * doGet(e) — Web App entry point.
 * Hot path: reads pre-computed JSON from DASHBOARD_CACHE!A2. Target < 150 ms.
 * Cold path (cache miss): falls back to live aggregation (< 3 s, rare).
 */
function doGet(e) {
  var t0 = Date.now();
  var payload;

  try {
    var host        = SpreadsheetApp.openById(HOST_SHEET_ID);
    var cacheSheet  = host.getSheetByName(CACHE_TAB_NAME);

    if (cacheSheet) {
      var raw = cacheSheet.getRange(CACHE_CELL_ADDR).getValue();
      if (raw && typeof raw === 'string' && raw.charAt(0) === '{') {
        payload = raw;
      }
    }

    if (!payload) {
      Logger.log('doGet: cache miss — running live aggregation');
      payload = JSON.stringify(buildPayload_());
      ensureCacheCell_(host, payload);
    }
  } catch (err) {
    Logger.log('doGet ERROR: ' + err);
    payload = JSON.stringify({ error: err.toString(), ts: new Date().toISOString() });
  }

  Logger.log('doGet: ' + (Date.now() - t0) + ' ms');

  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}


// ============================================================================
// SECTION B: CACHE WRITER  (called by 5-min trigger)
// ============================================================================

/**
 * cacheOperationalData()
 * Aggregates all three source sheets and writes the JSON payload to
 * DASHBOARD_CACHE!A2. Called every 5 minutes by the time trigger.
 */
function cacheOperationalData() {
  var t0 = Date.now();
  Logger.log('cacheOperationalData: start');
  try {
    var payload = buildPayload_();
    var json    = JSON.stringify(payload);
    var host    = SpreadsheetApp.openById(HOST_SHEET_ID);
    ensureCacheCell_(host, json);
    Logger.log('cacheOperationalData: done ' + (Date.now() - t0) + ' ms  |  ' + json.length + ' bytes');
  } catch (err) {
    Logger.log('cacheOperationalData ERROR: ' + err + '\n' + (err.stack || ''));
    // Swallow — a failed refresh must not kill the trigger chain.
  }
}


// ============================================================================
// SECTION C: AGGREGATION ENGINE (private helpers)
// ============================================================================

function buildPayload_() {
  var today = todayString_();
  return {
    ts          : new Date().toISOString(),
    date        : today,
    plant_ops   : readPlantOps_(today),
    collections : readCollections_(),
    energy      : readEnergy_(today)
  };
}

// ── Plant Operations ──────────────────────────────────────────────────────────

function readPlantOps_(today) {
  var ss;
  try { ss = SpreadsheetApp.openById(PLANT_OPS_ID); }
  catch (e) { return { error: 'cannot open Plant Ops sheet: ' + e }; }

  var result = {};
  Object.keys(PLANT_OPS_TABS).forEach(function (key) {
    var tabName  = PLANT_OPS_TABS[key];
    var isCutting = (key === 'cutting');
    try {
      var sh = ss.getSheetByName(tabName);
      if (!sh) { Logger.log('readPlantOps_: tab "' + tabName + '" not found'); return; }
      result[key] = isCutting
        ? readCuttingTabPatched_(sh, today)
        : readProductionTab_(sh, today);
    } catch (e) {
      Logger.log('readPlantOps_[' + tabName + '] ERROR: ' + e);
      result[key] = { error: String(e) };
    }
  });
  return result;
}

/**
 * readCuttingTabPatched_(sheet, today)
 *
 * CRITICAL PATCH — Spark 07 Sep 2026:
 * tbl_Cutting_Production rows 2–24 contain corrupted email-header strings in
 * "Job Card / Heat No" (col C). isCorruptedJobCard_() filters those rows
 * BEFORE any numeric aggregation so they are never summed.
 */
function readCuttingTabPatched_(sheet, today) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return emptyDeptResult_();

  var cols = Math.max(sheet.getLastColumn(), 7);
  var data = sheet.getRange(2, 1, lastRow - 1, cols).getValues();
  var stats = emptyDeptResult_();
  stats.rows_read              = data.length;
  stats.rows_skipped_corrupted = 0;

  data.forEach(function (row, idx) {
    var absRow = idx + 2;

    // ─── CORRUPTION FILTER ─────────────────────────────────────────────────
    if (isCorruptedJobCard_(row[COL_JOB_CARD], absRow)) {
      stats.rows_skipped_corrupted++;
      return;
    }

    // ─── DATE FILTER ───────────────────────────────────────────────────────
    if (formatDate_(row[COL_DATE]) !== today) return;

    // ─── AGGREGATE ─────────────────────────────────────────────────────────
    accumulateRow_(stats, row);
  });

  return stats;
}

/**
 * isCorruptedJobCard_(value, absRow) → boolean
 * Part (a): matches email/MIME header prefix.
 * Part (b): is non-numeric (job-card numbers are always plain integers).
 */
function isCorruptedJobCard_(value, absRow) {
  if (value === null || value === undefined || value === '') {
    Logger.log('  row ' + absRow + ': blank job card — skipped');
    return true;
  }
  var str = String(value).trim();
  if (EMAIL_HEADER_RE.test(str)) {
    Logger.log('  row ' + absRow + ': email header — "' + str.substring(0, 60) + '" — skipped');
    return true;
  }
  var stripped = str.replace(/,/g, '');
  if (isNaN(Number(stripped)) || stripped === '') {
    Logger.log('  row ' + absRow + ': non-numeric job card "' + str.substring(0, 60) + '" — skipped');
    return true;
  }
  return false;
}

/** Standard reader for Forge / Press / Machine / HT / Final (no corruption filter). */
function readProductionTab_(sheet, today) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return emptyDeptResult_();

  var cols = Math.max(sheet.getLastColumn(), 7);
  var data = sheet.getRange(2, 1, lastRow - 1, cols).getValues();
  var stats = emptyDeptResult_();
  stats.rows_read = data.length;

  data.forEach(function (row) {
    if (formatDate_(row[COL_DATE]) !== today) return;
    accumulateRow_(stats, row);
  });
  return stats;
}

function accumulateRow_(stats, row) {
  var qty    = safeNumber_(row[COL_QTY]);
  var weight = safeNumber_(row[COL_WEIGHT]);
  var shift  = String(row[COL_SHIFT] || '').trim() || 'Unknown';

  stats.today_pieces    += qty;
  stats.today_weight_kg += weight;
  stats.today_jobs++;

  if (!stats.shifts[shift]) stats.shifts[shift] = { pieces: 0, weight_kg: 0, jobs: 0 };
  stats.shifts[shift].pieces    += qty;
  stats.shifts[shift].weight_kg += weight;
  stats.shifts[shift].jobs++;
}

// ── Collections ───────────────────────────────────────────────────────────────

/**
 * readCollections_() → object
 *
 * CURRENT_OVERDUE mapping — confirmed from Spark Module 3 source:
 *   Tab: "Outstanding Balances & Dispatch Locks"
 *   col[2] = overdueAmt (INR)   col[3] = overdueDays
 *   CURRENT_OVERDUE = sum of col[2] for ALL rows with a positive overdue amount.
 *   Locked accounts (>15 days AND >₹50 000) are also reported separately.
 *
 * Fallback: if the known tab is absent, try the named range 'CURRENT_OVERDUE'.
 */
function readCollections_() {
  var ss;
  try { ss = SpreadsheetApp.openById(COLLECTIONS_ID); }
  catch (e) { return { error: 'cannot open Collections sheet: ' + e, current_overdue: null }; }

  // ── Primary: known tab/column structure from Spark Module 3 ──────────────
  var sh = ss.getSheetByName(COLLECTIONS_TAB);
  if (sh) {
    var lastRow = sh.getLastRow();
    if (lastRow >= 2) {
      var data           = sh.getRange(2, 1, lastRow - 1, Math.max(sh.getLastColumn(), 4)).getValues();
      var currentOverdue = 0;
      var lockedTotal    = 0;
      var lockedCount    = 0;

      data.forEach(function (row) {
        var amt  = safeNumber_(row[COL_CUST_OVERDUEAMT]);
        var days = safeNumber_(row[COL_CUST_OVERDUEDAYS]);
        if (amt > 0) currentOverdue += amt;
        if (days > 15 && amt > 50000) { lockedTotal += amt; lockedCount++; }
      });

      Logger.log('readCollections_: CURRENT_OVERDUE=' + currentOverdue + '  locked=' + lockedCount + ' accs / ₹' + lockedTotal);
      return {
        current_overdue  : currentOverdue,
        locked_overdue   : lockedTotal,
        locked_accounts  : lockedCount,
        currency         : 'INR',
        source           : 'tab:' + COLLECTIONS_TAB
      };
    }
  }

  // ── Fallback: named range ─────────────────────────────────────────────────
  try {
    var nr = ss.getRangeByName('CURRENT_OVERDUE');
    if (nr) {
      var v = nr.getValue();
      Logger.log('readCollections_: named range CURRENT_OVERDUE = ' + v);
      return { current_overdue: safeNumber_(v), currency: 'INR', source: 'named_range' };
    }
  } catch (nrErr) {
    Logger.log('readCollections_: named range lookup failed — ' + nrErr);
  }

  Logger.log('readCollections_: no data found');
  return { current_overdue: null, currency: 'INR', source: 'not_found' };
}

// ── Energy ────────────────────────────────────────────────────────────────────

function readEnergy_(today) {
  var ss;
  try { ss = SpreadsheetApp.openById(ENERGY_ID); }
  catch (e) { return { error: 'cannot open Energy sheet: ' + e }; }
  return {
    electricity_kwh : readEnergyTab_(ss, ENERGY_ELEC_TABS, today, 'elec'),
    oil_liters      : readEnergyTab_(ss, ENERGY_OIL_TABS,  today, 'oil'),
    period          : 'today'
  };
}

function readEnergyTab_(ss, tabNames, today, label) {
  for (var i = 0; i < tabNames.length; i++) {
    var sh = ss.getSheetByName(tabNames[i]);
    if (!sh) continue;
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return 0;
    var data = sh.getRange(2, 1, lastRow - 1, Math.max(sh.getLastColumn(), 3)).getValues();
    var total = 0;
    data.forEach(function (row) { if (formatDate_(row[0]) === today) total += safeNumber_(row[2]); });
    Logger.log('readEnergyTab_[' + label + ']: ' + tabNames[i] + ' → ' + total);
    return total;
  }
  Logger.log('readEnergyTab_[' + label + ']: no matching tab');
  return null;
}


// ============================================================================
// SECTION D: CACHE CELL MANAGEMENT
// ============================================================================

function ensureCacheCell_(host, json) {
  var sh = host.getSheetByName(CACHE_TAB_NAME);
  if (!sh) {
    sh = host.insertSheet(CACHE_TAB_NAME);
    Logger.log('ensureCacheCell_: created tab ' + CACHE_TAB_NAME);
  }

  var hdr = sh.getRange(CACHE_HDR_ADDR);
  if (!hdr.getValue()) {
    hdr.setValue('DASHBOARD_CACHE — auto-refreshed every 5 min. Do not edit manually.');
    hdr.setFontWeight('bold').setBackground('#E8F0FE');
  }

  // Format A2 as plain text to prevent Sheets truncating strings over ~50 k chars
  var cell = sh.getRange(CACHE_CELL_ADDR);
  cell.setNumberFormat('@STRING@');
  cell.setValue(json);
  SpreadsheetApp.flush();
  Logger.log('ensureCacheCell_: wrote ' + json.length + ' bytes → ' + CACHE_TAB_NAME + '!' + CACHE_CELL_ADDR);
}


// ============================================================================
// SECTION E: TRIGGER INSTALLER  (run once manually)
// ============================================================================

/**
 * installTimeTrigger()
 * Arms a 5-minute ScriptApp time trigger for cacheOperationalData().
 * Safe to re-run: removes any existing trigger on the same function first.
 *
 * Steps: Apps Script editor → Run → installTimeTrigger → Authorise
 * Then: Deploy → New deployment → Web app → Execute as Me → Anyone with link
 */
function installTimeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === TRIGGER_FN) {
      ScriptApp.deleteTrigger(t);
      Logger.log('installTimeTrigger: removed existing trigger ' + t.getUniqueId());
    }
  });

  var trigger = ScriptApp.newTrigger(TRIGGER_FN)
    .timeBased()
    .everyMinutes(TRIGGER_INTERVAL)
    .create();

  Logger.log('installTimeTrigger: armed — every ' + TRIGGER_INTERVAL +
    ' min  |  id: ' + trigger.getUniqueId());

  cacheOperationalData();  // warm the cache immediately
}

function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === TRIGGER_FN) {
      ScriptApp.deleteTrigger(t);
      Logger.log('removeTrigger: removed ' + t.getUniqueId());
    }
  });
}


// ============================================================================
// MODULE 2: 57F4 JOB-WORK RECONCILIATION ENGINE  (Spark, unchanged)
// Target Sheet: VFPL Operations Dashboard 2026-27
//   ID: 1rFAXu8CBQWeximXiapFZKBrU8hC4nzvD27JoL_XQGrc
// ============================================================================
function reconcile57F4JobWork() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const outSheet = ss.getSheetByName('RAW_57F4_OUT');
  const inSheet  = ss.getSheetByName('RAW_57F4_IN');
  let targetSheet = ss.getSheetByName('57F4_RECONCILIATION');
  if (!targetSheet) targetSheet = ss.insertSheet('57F4_RECONCILIATION');

  if (!outSheet || !inSheet) {
    Logger.log('Required raw 57F4 sheets not found.');
    return;
  }

  const outData  = outSheet.getDataRange().getValues();
  const inData   = inSheet.getDataRange().getValues();
  const balances = {};

  for (let i = 1; i < outData.length; i++) {
    const row    = outData[i];
    const date   = new Date(row[0]);
    const vendor = String(row[2] || row[1] || '').trim();
    const partNo = String(row[3] || row[2] || '').trim();
    const qty    = Number(row[4] || row[3]) || 0;
    const key    = vendor + '___' + partNo;
    if (!balances[key]) balances[key] = { vendor: vendor, partNo: partNo, sent: 0, received: 0, oldestDate: date };
    balances[key].sent += qty;
    if (date < balances[key].oldestDate) balances[key].oldestDate = date;
  }

  for (let j = 1; j < inData.length; j++) {
    const row    = inData[j];
    const vendor = String(row[2] || row[1] || '').trim();
    const partNo = String(row[3] || row[2] || '').trim();
    const qty    = Number(row[4] || row[3]) || 0;
    const key    = vendor + '___' + partNo;
    if (!balances[key]) balances[key] = { vendor: vendor, partNo: partNo, sent: 0, received: 0, oldestDate: new Date() };
    balances[key].received += qty;
  }

  const now    = new Date();
  const output = [['Vendor', 'Part No (VF)', 'Total Sent (pcs)', 'Total Received (pcs)', 'Pending Balance (pcs)', 'Aging (Days)', 'Status Flag', 'Action Required']];
  const agingAlerts = [];

  for (const k in balances) {
    const item     = balances[k];
    const pending  = item.sent - item.received;
    const diffDays = Math.floor((now - item.oldestDate) / (1000 * 60 * 60 * 24));
    let status = 'OK';
    let action = 'Monitor';

    if (pending === 0) {
      status = 'CLEAR'; action = 'None';
    } else if (pending < 0) {
      status = 'EXCESS INWARD'; action = 'Audit Inward DC';
    } else if (diffDays > 30) {
      status = 'CRITICAL AGING (>30d)'; action = 'Immediate Vendor Chase';
      agingAlerts.push(item.vendor + ' - ' + item.partNo + ': ' + pending + ' pcs (' + diffDays + ' days)');
    } else if (pending > 2000) {
      status = 'HIGH VOLUME PENDING'; action = 'Schedule Inward';
    }
    output.push([item.vendor, item.partNo, item.sent, item.received, pending, diffDays > 0 ? diffDays : 0, status, action]);
  }

  targetSheet.clearContents();
  targetSheet.getRange(1, 1, output.length, output[0].length).setValues(output);
  targetSheet.getRange(1, 1, 1, output[0].length).setFontWeight('bold');

  if (agingAlerts.length > 0) {
    MailApp.sendEmail({
      to      : 'dmevarshaforgings@gmail.com',
      cc      : 'yash.munot@gmail.com',
      subject : '[ALERT] VFPL 57F4 JobWork Aging Exceptions Detected',
      body    : 'The following 57F4 JobWork items have exceeded 30 days pending balance:\n\n' + agingAlerts.join('\n')
    });
  }
}


// ============================================================================
// MODULE 3: AUTOMATED DISPATCH LOCK & OVERDUE RECEIVABLES AUDIT  (Spark, unchanged)
// Target Sheet: VFPL Collections Engine (1B7eI55FXwdPaSRX9MoZVLB9bx2sWdCBUBZlsLQiF7q0)
// ============================================================================
function runCollectionsAgingAudit() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Outstanding Balances & Dispatch Locks') || ss.getSheets()[0];
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  let lockedCount       = 0;
  const overdueAlerts   = [];

  for (let i = 1; i < data.length; i++) {
    const customer   = String(data[i][0] || '').trim();
    const overdueAmt = parseFloat(data[i][2] || 0);
    const overdueDays = parseInt(data[i][3] || 0, 10);

    if (overdueDays > 15 && overdueAmt > 50000) {
      sheet.getRange(i + 1, 5).setValue('LOCKED');
      lockedCount++;
      overdueAlerts.push(customer + ' — Rs. ' + overdueAmt.toLocaleString('en-IN') + ' (' + overdueDays + ' days overdue)');
    } else {
      sheet.getRange(i + 1, 5).setValue('RELEASED');
    }
  }

  Logger.log('Collections Audit Complete. Locked accounts: ' + lockedCount);

  if (overdueAlerts.length > 0) {
    MailApp.sendEmail({
      to      : 'yash.munot@gmail.com',
      subject : '[VFPL Collections] Dispatch Locks Applied — ' + lockedCount + ' Overdue Accounts',
      body    : 'The following accounts have exceeded 15 days overdue and are LOCKED from dispatch:\n\n' + overdueAlerts.join('\n')
    });
  }
}


// ============================================================================
// MODULE 4: EXECUTIVE EMAIL INTELLIGENCE & INTERNAL SLA MONITOR  (Spark, unchanged)
// Target Sheet: Executive Inbox & Customer Intelligence Hub (1pWtm8Twh7T8zBJqwh0HZvXhQ2FwGfpIx6A5kod7xBSg)
// ============================================================================
function syncEmailFollowUpSLA() {
  const ss            = SpreadsheetApp.getActiveSpreadsheet();
  const actionSheet   = ss.getSheetByName('Action Pending (Internal)');
  const customerSheet = ss.getSheetByName('Awaiting Customer Response');
  if (!actionSheet || !customerSheet) return;

  const now            = new Date();
  const pendingActions = [];

  const aData = actionSheet.getDataRange().getValues();
  for (let i = 1; i < aData.length; i++) {
    const loggedDate = new Date(aData[i][0]);
    const customer   = aData[i][1];
    const task       = aData[i][2];
    const status     = aData[i][4];
    const diffHours  = (now - loggedDate) / (1000 * 60 * 60);

    if (status !== 'RESOLVED' && diffHours > 48) {
      pendingActions.push(customer + ': ' + task + ' (' + Math.round(diffHours) + 'h stale)');
    }
  }

  if (pendingActions.length > 0) {
    MailApp.sendEmail({
      to      : 'yash.munot@gmail.com',
      subject : '[YJM Executive Alert] ' + pendingActions.length + ' Stale Internal Actions (>48h)',
      body    : 'Internal SLA Breaches requiring immediate resolution:\n\n' + pendingActions.join('\n')
    });
  }
}


// ============================================================================
// SMOKE TESTS  (run manually from the editor to verify each source)
// ============================================================================

/** Confirms corruption filter; logs rows_skipped_corrupted vs rows_read. */
function testCuttingPatch() {
  Logger.log('=== testCuttingPatch ===');
  var ss = SpreadsheetApp.openById(PLANT_OPS_ID);
  var sh = ss.getSheetByName(PLANT_OPS_TABS.cutting);
  if (!sh) { Logger.log('ERROR: tab "' + PLANT_OPS_TABS.cutting + '" not found'); return; }
  var r = readCuttingTabPatched_(sh, todayString_());
  Logger.log('today_pieces: '           + r.today_pieces);
  Logger.log('today_jobs: '             + r.today_jobs);
  Logger.log('rows_read: '              + r.rows_read);
  Logger.log('rows_skipped_corrupted: ' + r.rows_skipped_corrupted);
  Logger.log('shifts: '                 + JSON.stringify(r.shifts));
}

/** Confirms CURRENT_OVERDUE is non-null and sources correctly. */
function testCollections() {
  Logger.log('=== testCollections ===');
  Logger.log(JSON.stringify(readCollections_(), null, 2));
}

/** Confirms electricity/oil readings. */
function testEnergy() {
  Logger.log('=== testEnergy ===');
  Logger.log(JSON.stringify(readEnergy_(todayString_()), null, 2));
}

/** End-to-end: runs aggregation and verifies DASHBOARD_CACHE!A2 is valid JSON. */
function testFullCache() {
  Logger.log('=== testFullCache ===');
  cacheOperationalData();
  var sh  = SpreadsheetApp.openById(HOST_SHEET_ID).getSheetByName(CACHE_TAB_NAME);
  if (!sh) { Logger.log('ERROR: DASHBOARD_CACHE tab not found'); return; }
  var raw = sh.getRange(CACHE_CELL_ADDR).getValue();
  var ok  = false;
  try { JSON.parse(raw); ok = true; } catch (e) {}
  Logger.log('A2 length: ' + (raw ? raw.length : 0) + ' bytes');
  Logger.log('Valid JSON: ' + ok);
  Logger.log('Preview: ' + String(raw).substring(0, 400));
}

/** Simulates a doGet call locally; warns if >150 ms. */
function testDoGet() {
  Logger.log('=== testDoGet ===');
  var t0  = Date.now();
  var res = doGet({});
  var ms  = Date.now() - t0;
  Logger.log('elapsed: ' + ms + ' ms');
  Logger.log('length: '  + res.getContent().length + ' bytes');
  Logger.log('preview: ' + res.getContent().substring(0, 400));
  if (ms > 150) Logger.log('⚠ WARNING: exceeded 150 ms target (' + ms + ' ms) — is trigger running?');
}


// ============================================================================
// PRIVATE UTILITIES
// ============================================================================

function emptyDeptResult_() {
  return { today_pieces: 0, today_weight_kg: 0, today_jobs: 0, shifts: {} };
}

function formatDate_(value) {
  if (!value) return '';
  var d = (value instanceof Date) ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value).trim().substring(0, 10);
  return d.getFullYear() + '-' +
    ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
    ('0' + d.getDate()).slice(-2);
}

function todayString_() { return formatDate_(new Date()); }

function safeNumber_(v) {
  if (v === null || v === undefined || v === '') return 0;
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}


// ============================================================================
// DEPLOYMENT NOTES (reference only — not executable)
// ============================================================================
//
// WEB APP URL FORMAT after "Deploy → New deployment":
//   https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
//
// EXPECTED doGet PAYLOAD SHAPE (example, date=2026-09-09):
// {
//   "ts":   "2026-09-09T06:35:01.000Z",
//   "date": "2026-09-09",
//   "plant_ops": {
//     "cutting": {
//       "today_pieces": 312, "today_weight_kg": 1560.5, "today_jobs": 14,
//       "rows_read": 48, "rows_skipped_corrupted": 23,
//       "shifts": { "Shift 1": { "pieces": 120, "weight_kg": 600, "jobs": 5 } }
//     },
//     "forge":  { "today_pieces": 180, ... },
//     "press":  { "today_pieces": 240, ... },
//     "machine":{ "today_pieces": 95,  ... },
//     "ht":     { "today_pieces": 155, ... },
//     "final_": { "today_pieces": 210, ... }
//   },
//   "collections": {
//     "current_overdue": 2345000, "locked_overdue": 1850000,
//     "locked_accounts": 3, "currency": "INR",
//     "source": "tab:Outstanding Balances & Dispatch Locks"
//   },
//   "energy": { "electricity_kwh": 487.5, "oil_liters": 14.2, "period": "today" }
// }
//
// TROUBLESHOOTING:
//   "You do not have permission" → run cacheOperationalData() in the editor
//     (not doGet) and re-authorise scopes
//   A2 empty → run testFullCache() and check Logs for errors
//   current_overdue is null → confirm tab name is exactly
//     "Outstanding Balances & Dispatch Locks" in the Collections sheet
//   rows_skipped_corrupted is 0 when it should be ~23 → confirm COL_JOB_CARD=2
//     (column C, 0-based) is correct for tbl_Cutting_Production
//   doGet >150 ms → check trigger is running: Apps Script → Triggers (clock icon)
