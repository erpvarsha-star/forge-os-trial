/**
 * ============================================================================
 * VFPL COMPLETE APPS SCRIPT DEPLOYMENT SUITE (07-SEP-2026)
 * Author: SPARK (Google Workspace AI Specialist)
 * Patched & extended: 09-Sep-2026 — added Dashboard Cache Layer (Sections A–E)
 * Patched again: 10-Sep-2026 — Plant Ops / Energy / Collections rewritten
 *   against the REAL current sheets (verified live via Drive, not guessed —
 *   see PENDING.md). All three source sheets have moved to a consolidated
 *   AppSheet-style log; the old readers only worked for 2 of 6 plant_ops
 *   departments and returned null for collections/energy. Every new path is
 *   additive — it is tried ONLY after the original tab/column lookup finds
 *   nothing, so cutting/press (which still work) are untouched:
 *     - plant_ops.forge/machine/ht/final_: their tbl_*_Production tabs do
 *       not exist anywhere in Drive (confirmed by search) — now fall back to
 *       the shared "Production_Log" tab, filtered by its Shop column.
 *     - energy: real tabs are "Electricity_Meters" (kWh in Consumption_kWh,
 *       col I) and "Fuel_Log" (Volume_Liters, col H, filtered to Fuel_Type
 *       containing "oil" so vehicle diesel isn't counted as furnace oil).
 *       Old Electricity/Oil tab names kept as the first, faster path in case
 *       they're ever added.
 *     - collections: no tab named "Outstanding Balances & Dispatch Locks"
 *       exists in the Collections sheet. The per-customer current/locked
 *       split needs that tab (or wherever the real aging data lives) and is
 *       NOT guessed here. Falls back instead to the Collections sheet's own
 *       "DASHBOARD" tab, which DOES exist and has real totals — exposed as
 *       new fields total_outstanding / customers_overdue, with
 *       current_overdue/locked_overdue left null and a `note` explaining why.
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
// NOTE (10-Sep patch): this sheet's real title, confirmed via Drive, is
// "VFPL_Domain_UtilitiesManpower_2026-27" — the old "..._Utilities_2026-27"
// comment below was stale (ID is correct and unchanged, only the name was wrong).
var ENERGY_ID       = '1H2kHVeBNZnCuCeYesh6ZoXM3scf5tC3WANWGhayg8Xc';  // VFPL_Domain_UtilitiesManpower_2026-27

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

// ── Plant Ops fallback (10-Sep patch) ─────────────────────────────────────────
// Confirmed via Drive: none of the 4 missing tbl_*_Production tabs exist
// anywhere (a search for the literal tab names only found this script, not a
// spreadsheet). Production now lives in one consolidated tab, "Production_Log",
// with all shops mixed together and a "Shop" text column. Used ONLY when a
// department's own tbl_*_Production tab (above) is not found.
var PRODUCTION_LOG_TAB = 'Production_Log';

// Production_Log column indices (0-based), from its header row:
// Record_ID, Timestamp, Date, Shift, Shop, Supervisor_ID, Supervisor_Name,
// Operator_ID, Operator_Name, Machine_ID, Machine_Name, Route_Card_QR, VF_No,
// Customer, Material_Grade, Standard_Cut_Weight_kg, Actual_Cut_Weight_kg,
// Forge_Output_Weight_kg, Net_Forging_Weight_kg, Rejection_Qty, ...
var PLOG_COL_DATE   = 2;
var PLOG_COL_SHIFT  = 3;
var PLOG_COL_SHOP   = 4;
var PLOG_COL_REJECT = 19;
// No single "pieces" column exists in Production_Log — each row is one
// production event/piece, so a shop's row count IS its piece count (matches
// how AppSheet logs this kind of data). Weight uses whichever of these four
// weight columns is first non-zero, since which one applies depends on the
// shop's stage in the process (cutting vs forging vs finishing):
var PLOG_WEIGHT_COLS = [18, 17, 16, 15]; // Net_Forging, Forge_Output, Actual_Cut, Standard_Cut

// Maps a plant_ops dept key to the Shop-column text value(s) it should match
// (case-insensitive, trimmed). Extend this if a shop's real spelling differs.
var SHOP_ALIASES = {
  cutting : ['cutting'],
  forge   : ['forge', 'forging'],
  press   : ['press'],
  machine : ['machine', 'machining'],
  ht      : ['ht', 'heat treatment', 'heat-treatment'],
  final_  : ['final', 'finishing']
};

// ── Collections tab (confirmed from Spark Module 3 source) ───────────────────
// Tab: "Outstanding Balances & Dispatch Locks"
// col[0] = customer, col[2] = overdueAmt (INR), col[3] = overdueDays
// CURRENT_OVERDUE = sum of col[2] for all rows where overdueDays > 0
// ⚠ 10-Sep patch: this tab does NOT currently exist in the Collections sheet
// (confirmed — not guessed). Kept as the primary, more-detailed path in case
// it's created later; COLLECTIONS_DASHBOARD_TAB below is the real fallback.
var COLLECTIONS_TAB      = 'Outstanding Balances & Dispatch Locks';
var COL_CUST_OVERDUEAMT  = 2;   // column C — INR overdue amount
var COL_CUST_OVERDUEDAYS = 3;   // column D — overdue age in days

// ── Collections fallback (10-Sep patch) ───────────────────────────────────────
// This tab DOES exist and has real numbers (verified live): a simple
// label-in-col-A / value-in-col-B sheet. It has no per-customer current/
// locked split — only sheet-wide totals — so it can't populate
// current_overdue/locked_overdue; it populates total_outstanding /
// customers_overdue instead. See readCollections_() for how the two paths combine.
var COLLECTIONS_DASHBOARD_TAB          = 'DASHBOARD';
var COLLECTIONS_DASHBOARD_LABEL_TOTAL  = 'Total Outstanding (₹)';
var COLLECTIONS_DASHBOARD_LABEL_COUNT  = 'Customers with Overdue';

// ── Energy tabs ───────────────────────────────────────────────────────────────
// Original simple-log tab names, tried first (fastest path if ever created):
var ENERGY_ELEC_TABS = ['Electricity', 'ELECTRICITY', 'RAW_ELECTRICITY', 'Elec'];
var ENERGY_OIL_TABS  = ['Oil', 'OIL', 'RAW_OIL', 'Oil Consumable'];

// ── Energy fallback (10-Sep patch) ────────────────────────────────────────────
// Real tabs, confirmed via Drive. Electricity_Meters logs per-meter readings;
// Fuel_Log is a VEHICLE/equipment fuel log (has Odometer_Reading,
// Efficiency_km_per_L — fields that only make sense for vehicles), so it is
// filtered to rows whose Fuel_Type contains "oil" rather than summed whole —
// summing everything would silently mix in vehicle diesel as "furnace oil".
// If Fuel_Type never contains "oil", oil_liters comes back null with a note
// rather than a guessed number — confirm with whoever owns AppSheet entry
// whether furnace/HT oil is logged here at all (see PENDING.md).
var ENERGY_ELEC_METERS_TAB   = 'Electricity_Meters';
var ELEC_COL_DATE            = 2;  // column C
var ELEC_COL_CONSUMPTION_KWH = 8;  // column I — Consumption_kWh

var ENERGY_FUEL_LOG_TAB  = 'Fuel_Log';
var FUEL_COL_DATE        = 2;  // column C
var FUEL_COL_TYPE        = 4;  // column E — Fuel_Type
var FUEL_COL_VOLUME_L    = 7;  // column H — Volume_Liters
var FUEL_OIL_MATCH_RE    = /oil/i;


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

  // Shared Production_Log fallback tab — opened once, reused for whichever
  // departments don't have their own tbl_*_Production tab.
  var plogSheet = null;
  try { plogSheet = ss.getSheetByName(PRODUCTION_LOG_TAB); }
  catch (e) { Logger.log('readPlantOps_: could not open fallback tab: ' + e); }

  var result = {};
  Object.keys(PLANT_OPS_TABS).forEach(function (key) {
    var tabName  = PLANT_OPS_TABS[key];
    var isCutting = (key === 'cutting');
    try {
      var sh = ss.getSheetByName(tabName);
      if (sh) {
        result[key] = isCutting
          ? readCuttingTabPatched_(sh, today)
          : readProductionTab_(sh, today);
        return;
      }

      Logger.log('readPlantOps_: tab "' + tabName + '" not found — trying Production_Log fallback for "' + key + '"');
      if (!plogSheet) {
        result[key] = { error: 'tab "' + tabName + '" not found and no "' + PRODUCTION_LOG_TAB + '" fallback tab either' };
        return;
      }
      result[key] = readProductionLogForShop_(plogSheet, key, today);
    } catch (e) {
      Logger.log('readPlantOps_[' + tabName + '] ERROR: ' + e);
      result[key] = { error: String(e) };
    }
  });
  return result;
}

/**
 * readProductionLogForShop_(sheet, deptKey, today)
 *
 * Fallback for departments whose own tbl_*_Production tab does not exist.
 * Reads the shared "Production_Log" tab, keeps only rows whose Shop column
 * matches this department (see SHOP_ALIASES) AND whose Date is today.
 *
 * Production_Log has no dedicated "pieces" column — one row is one
 * production event, so a matching row count doubles as today_pieces (same
 * semantics tbl_*_Production's COL_QTY was already producing, just counted
 * differently). Rows with an unparseable Date are skipped and counted in
 * rows_skipped_invalid, the same defensive pattern as the Cutting corruption
 * patch above, since this AppSheet log has shown similar bad-import rows.
 */
function readProductionLogForShop_(sheet, deptKey, today) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return emptyDeptResult_();

  var aliases = (SHOP_ALIASES[deptKey] || []).map(function (a) { return a.toLowerCase(); });
  var cols = Math.max(sheet.getLastColumn(), 20);
  var data = sheet.getRange(2, 1, lastRow - 1, cols).getValues();

  var stats = emptyDeptResult_();
  stats.rows_skipped_invalid = 0;
  stats.source = 'fallback:' + PRODUCTION_LOG_TAB;

  data.forEach(function (row) {
    var shop = String(row[PLOG_COL_SHOP] || '').trim().toLowerCase();
    if (aliases.indexOf(shop) === -1) return; // different department's row

    var d = formatDate_(row[PLOG_COL_DATE]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d !== today) {
      stats.rows_skipped_invalid++;
      return;
    }

    stats.rows_read++;
    stats.today_pieces++;
    stats.today_jobs++;

    var weight = 0;
    for (var i = 0; i < PLOG_WEIGHT_COLS.length; i++) {
      weight = safeNumber_(row[PLOG_WEIGHT_COLS[i]]);
      if (weight > 0) break;
    }
    stats.today_weight_kg += weight;

    var rejected = safeNumber_(row[PLOG_COL_REJECT]);
    stats.today_rejected_qty = (stats.today_rejected_qty || 0) + rejected;

    var shift = String(row[PLOG_COL_SHIFT] || '').trim() || 'Unknown';
    if (!stats.shifts[shift]) stats.shifts[shift] = { pieces: 0, weight_kg: 0, jobs: 0 };
    stats.shifts[shift].pieces++;
    stats.shifts[shift].weight_kg += weight;
    stats.shifts[shift].jobs++;
  });

  return stats;
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

  // ── Fallback 1: named range ────────────────────────────────────────────────
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

  // ── Fallback 2 (10-Sep patch): DASHBOARD tab's sheet-wide totals ──────────
  // Confirmed to exist with real numbers, but this is a LABEL/VALUE summary
  // sheet, not a per-customer list — it cannot produce current_overdue /
  // locked_overdue (that split needs the per-customer aging tab, which does
  // not exist yet; see PENDING.md). Those two stay null on purpose rather
  // than being guessed from total_outstanding.
  var dashResult = readCollectionsDashboardTotals_(ss);
  if (dashResult) return dashResult;

  Logger.log('readCollections_: no data found');
  return {
    current_overdue : null,
    currency        : 'INR',
    source          : 'not_found',
    note            : 'No "' + COLLECTIONS_TAB + '" tab, no CURRENT_OVERDUE named range, and no "' +
                       COLLECTIONS_DASHBOARD_TAB + '" tab found either.'
  };
}

/**
 * readCollectionsDashboardTotals_(ss) → object|null
 * Reads the Collections sheet's "DASHBOARD" tab — a simple label-in-col-A,
 * value-in-col-B summary (confirmed live: "Total Outstanding (₹)" and
 * "Customers with Overdue" rows exist with real numbers). Returns null (not
 * an error object) if the tab or the expected labels aren't found, so the
 * caller can fall through to the final not_found response.
 */
function readCollectionsDashboardTotals_(ss) {
  var sh = ss.getSheetByName(COLLECTIONS_DASHBOARD_TAB);
  if (!sh) return null;

  var lastRow = sh.getLastRow();
  if (lastRow < 1) return null;
  var data = sh.getRange(1, 1, lastRow, 2).getValues();

  var totalOutstanding  = null;
  var customersOverdue  = null;
  data.forEach(function (row) {
    var label = String(row[0] || '').trim();
    if (label === COLLECTIONS_DASHBOARD_LABEL_TOTAL) totalOutstanding = safeNumber_(row[1]);
    if (label === COLLECTIONS_DASHBOARD_LABEL_COUNT)  customersOverdue = safeNumber_(row[1]);
  });

  if (totalOutstanding === null && customersOverdue === null) return null;

  Logger.log('readCollections_: DASHBOARD fallback → total_outstanding=' + totalOutstanding +
    ' customers_overdue=' + customersOverdue);
  return {
    current_overdue    : null,
    locked_overdue      : null,
    locked_accounts     : null,
    total_outstanding   : totalOutstanding,
    customers_overdue   : customersOverdue,
    currency            : 'INR',
    source              : 'tab:' + COLLECTIONS_DASHBOARD_TAB,
    note                : 'Sheet-wide total only — no current/locked split available. ' +
                           'The "' + COLLECTIONS_TAB + '" tab (which would provide it) does not exist yet.'
  };
}

// ── Energy ────────────────────────────────────────────────────────────────────

function readEnergy_(today) {
  var ss;
  try { ss = SpreadsheetApp.openById(ENERGY_ID); }
  catch (e) { return { error: 'cannot open Energy sheet: ' + e }; }

  // Legacy simple-tab path first (Electricity/Oil) — kept in case those ever
  // get created; both currently return null since neither tab exists.
  var elecKwh = readEnergyTab_(ss, ENERGY_ELEC_TABS, today, 'elec');
  var oilL    = readEnergyTab_(ss, ENERGY_OIL_TABS,  today, 'oil');

  // 10-Sep patch: fall back to the real AppSheet tabs when the legacy ones
  // aren't found.
  if (elecKwh === null) elecKwh = readElectricityMeters_(ss, today);
  if (oilL === null)    oilL    = readFuelLogOil_(ss, today);

  return {
    electricity_kwh : elecKwh,
    oil_liters      : oilL,
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

/**
 * readElectricityMeters_(ss, today) → number|null
 * Sums Consumption_kWh (col I) across every meter/location/shift row logged
 * today in "Electricity_Meters". Returns 0 if the tab exists but has no rows
 * for today (including the common case of no data at all yet), null only if
 * the tab itself is missing.
 */
function readElectricityMeters_(ss, today) {
  var sh = ss.getSheetByName(ENERGY_ELEC_METERS_TAB);
  if (!sh) { Logger.log('readElectricityMeters_: tab "' + ENERGY_ELEC_METERS_TAB + '" not found'); return null; }

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;
  var cols = Math.max(sh.getLastColumn(), ELEC_COL_CONSUMPTION_KWH + 1);
  var data = sh.getRange(2, 1, lastRow - 1, cols).getValues();

  var total = 0;
  data.forEach(function (row) {
    if (formatDate_(row[ELEC_COL_DATE]) === today) total += safeNumber_(row[ELEC_COL_CONSUMPTION_KWH]);
  });
  Logger.log('readElectricityMeters_: ' + total + ' kWh');
  return total;
}

/**
 * readFuelLogOil_(ss, today) → number|null
 * Fuel_Log mixes vehicle fuel (Odometer_Reading, Efficiency_km_per_L are
 * vehicle-only fields) with, presumably, furnace/HT oil — the two are told
 * apart only by Fuel_Type. Sums Volume_Liters (col H) for today's rows whose
 * Fuel_Type matches /oil/i. If the tab has data for today but none of it is
 * tagged "oil", returns 0 with a log line (not null) — the tab exists and IS
 * being read correctly, there's just no oil entry today, which is different
 * from the tab not existing at all.
 */
function readFuelLogOil_(ss, today) {
  var sh = ss.getSheetByName(ENERGY_FUEL_LOG_TAB);
  if (!sh) { Logger.log('readFuelLogOil_: tab "' + ENERGY_FUEL_LOG_TAB + '" not found'); return null; }

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;
  var cols = Math.max(sh.getLastColumn(), FUEL_COL_VOLUME_L + 1);
  var data = sh.getRange(2, 1, lastRow - 1, cols).getValues();

  var total = 0;
  var sawAnyOilTag = false;
  data.forEach(function (row) {
    if (formatDate_(row[FUEL_COL_DATE]) !== today) return;
    var fuelType = String(row[FUEL_COL_TYPE] || '');
    if (FUEL_OIL_MATCH_RE.test(fuelType)) {
      sawAnyOilTag = true;
      total += safeNumber_(row[FUEL_COL_VOLUME_L]);
    }
  });
  if (!sawAnyOilTag) {
    Logger.log('readFuelLogOil_: no rows tagged "oil" in Fuel_Type today — confirm furnace/HT oil is logged in this tab at all');
  }
  Logger.log('readFuelLogOil_: ' + total + ' L');
  return total;
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
// AS OF THE 10-SEP PATCH, WITH THE REAL SHEETS' CURRENT (EMPTY) DATA, THE
// LIVE PAYLOAD ACTUALLY LOOKS LIKE THIS INSTEAD — collections falls back to
// DASHBOARD totals (real numbers), energy falls back to the AppSheet tabs
// (currently 0 — both are empty), and forge/machine/ht/final_ fall back to
// Production_Log (currently 0 too, or non-zero once real rows are entered
// with a matching Shop + today's date):
// {
//   "plant_ops": {
//     "cutting": { "today_pieces": 312, ... },   // unchanged, own tab
//     "forge":   { "today_pieces": 0, "source": "fallback:Production_Log", ... },
//     "press":   { "today_pieces": 240, ... },   // unchanged, own tab
//     "machine": { "today_pieces": 0, "source": "fallback:Production_Log", ... },
//     "ht":      { "today_pieces": 0, "source": "fallback:Production_Log", ... },
//     "final_":  { "today_pieces": 0, "source": "fallback:Production_Log", ... }
//   },
//   "collections": {
//     "current_overdue": null, "locked_overdue": null, "locked_accounts": null,
//     "total_outstanding": 23304493, "customers_overdue": 17,
//     "source": "tab:DASHBOARD",
//     "note": "Sheet-wide total only — no current/locked split available..."
//   },
//   "energy": { "electricity_kwh": 0, "oil_liters": 0, "period": "today" }
// }
//
// TROUBLESHOOTING:
//   "You do not have permission" → run cacheOperationalData() in the editor
//     (not doGet) and re-authorise scopes
//   A2 empty → run testFullCache() and check Logs for errors
//   collections.current_overdue is null but total_outstanding has a number →
//     working as designed — the per-customer aging tab ("Outstanding
//     Balances & Dispatch Locks") doesn't exist yet. Create it (customer in
//     col A, overdue amount in col C, overdue days in col D) to get the split.
//   collections has NEITHER current_overdue NOR total_outstanding → the
//     "DASHBOARD" tab's row labels changed; confirm they still read exactly
//     "Total Outstanding (₹)" and "Customers with Overdue" in column A.
//   energy.oil_liters is 0 but Fuel_Log has rows → check the Fuel_Type
//     column actually contains the word "oil" somewhere (case-insensitive);
//     if furnace/HT oil is logged under a different word entirely, update
//     FUEL_OIL_MATCH_RE.
//   plant_ops.forge/machine/ht/final_ stuck at 0 with real data entered →
//     confirm Production_Log's Shop column text matches an entry in
//     SHOP_ALIASES (case-insensitive) and rows_skipped_invalid isn't
//     swallowing them — a non-today or unparseable Date skips the row.
//   rows_skipped_corrupted is 0 when it should be ~23 → confirm COL_JOB_CARD=2
//     (column C, 0-based) is correct for tbl_Cutting_Production
//   doGet >150 ms → check trigger is running: Apps Script → Triggers (clock icon)
