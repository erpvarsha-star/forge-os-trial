// ============================================================
// VFPL_Complete_Apps_Script_Deployment_Suite_07SEP2026.gs
// Dashboard Aggregator & Cache Layer — VFPL Forge OS
// Authored: 07 Sep 2026  |  Patched & deployed: 09 Sep 2026
// ============================================================
//
// HOST (container sheet):
//   "Claude Dashboard 26-27 13th Aug 2026"
//   ID: 1WTqiHb_izo-G9qquTOkbvyUx98f7Xjc1QAjkn9teNxo
//   Cache cell: DASHBOARD_CACHE!A2  (JSON string, ≤ 50 KB)
//
// SOURCE SHEETS (read-only from this script):
//   Plant Operations → 1iFbjSC3OSLFouPuHCYUfduRUBQ5IXdEIjCLCdRXTOCU
//   Collections      → 1B7eI55FXwdPaSRX9MoZVLB9bx2sWdCBUBZlsLQiF7q0
//   Energy           → 1H2kHVeBNZnCuCeYesh6ZoXM3scf5tC3WANWGhayg8Xc
//
// CRITICAL PATCH (Spark, 07 Sep 2026):
//   tbl_Cutting_Production rows 2–24 contain corrupted email-header
//   strings in "Job Card / Heat No". Rows where that column is
//   non-numeric OR matches the EMAIL_HEADER_RE pattern are skipped.
//
// DEPLOYMENT SEQUENCE (run once, in order):
//   1. Open host sheet → Extensions → Apps Script
//   2. Delete all existing code; paste this entire file; Save (Ctrl+S)
//   3. Run installTimeTrigger() from the Run menu → authorise OAuth
//   4. Deploy → New deployment → Web app
//      Execute as: Me  |  Access: Anyone with link
//      → copy the /exec URL for handoff to Claude Cowork
// ============================================================

// ── SHEET IDs ────────────────────────────────────────────────
var HOST_SHEET_ID      = '1WTqiHb_izo-G9qquTOkbvyUx98f7Xjc1QAjkn9teNxo';
var PLANT_OPS_ID       = '1iFbjSC3OSLFouPuHCYUfduRUBQ5IXdEIjCLCdRXTOCU';
var COLLECTIONS_ID     = '1B7eI55FXwdPaSRX9MoZVLB9bx2sWdCBUBZlsLQiF7q0';
var ENERGY_ID          = '1H2kHVeBNZnCuCeYesh6ZoXM3scf5tC3WANWGhayg8Xc';

// ── CACHE CONFIG ─────────────────────────────────────────────
var CACHE_TAB_NAME     = 'DASHBOARD_CACHE';
var CACHE_CELL_ADDR    = 'A2';          // JSON payload lives here
var CACHE_HEADER_ADDR  = 'A1';         // human-readable label row

// ── CUTTING CORRUPTION PATCH ─────────────────────────────────
// Spark identified rows 2–24 of tbl_Cutting_Production have email
// header strings leaked into "Job Card / Heat No". This regex
// catches common RFC-2822 / MIME header prefixes. It is intentionally
// broad: a real job-card number is always numeric, so any alphabetic
// content in that field is already corrupt data — we skip it all.
var EMAIL_HEADER_RE = /^(From|To|Subject|Date|Cc|Bcc|Message-ID|Content-Type|MIME-Version|Received|Return-Path|Reply-To|In-Reply-To|References|Thread-Index|X-[A-Za-z]|Delivered-To|Authentication-Results|DKIM-Signature|ARC-|List-|Importance|Priority|Sender|Disposition-Notification|Content-Transfer-Encoding|Content-Disposition)/i;

// Column index (0-based) of "Job Card / Heat No" in tbl_Cutting_Production.
// If the tab header row changes, update this constant — do not guess from data.
var COL_JOB_CARD = 2;   // Column C (0-based index 2)

// ── PLANT OPS TAB NAMES ───────────────────────────────────────
// Production tables in VFPL_Domain_PlantOperations_2026-27.
// Only tbl_Cutting_Production is patched; the others are read normally.
var PLANT_OPS_TABS = {
  cutting : 'tbl_Cutting_Production',
  forge   : 'tbl_Forge_Production',
  press   : 'tbl_Press_Production',
  machine : 'tbl_Machine_Production',
  ht      : 'tbl_HT_Production',
  final_  : 'tbl_Final_Production'
};

// Expected column positions inside each tbl_* production tab (0-based):
//   0: Date  |  1: Shift  |  2: Job Card/Heat No  |  3: Part Name
//   4: Material Grade  |  5: Pieces/Qty  |  6: Weight (kg)
//   Tabs that don't exist in the sheet are skipped gracefully.
var COL_DATE   = 0;
var COL_SHIFT  = 1;
var COL_QTY    = 5;   // pieces produced
var COL_WEIGHT = 6;   // kg

// ── COLLECTIONS TAB CONFIG ────────────────────────────────────
// The Collections sheet exposes CURRENT_OVERDUE via a named range.
// Fallback: scan the 'Summary' tab for a row labelled 'CURRENT_OVERDUE'.
var COLLECTIONS_NAMED_RANGE  = 'CURRENT_OVERDUE';
var COLLECTIONS_SUMMARY_TABS = ['Summary', 'SUMMARY', 'Dashboard', 'DASHBOARD'];

// ── ENERGY TAB CONFIG ─────────────────────────────────────────
var ENERGY_ELEC_TABS  = ['Electricity', 'ELECTRICITY', 'RAW_ELECTRICITY', 'Elec'];
var ENERGY_OIL_TABS   = ['Oil', 'OIL', 'RAW_OIL', 'Oil Consumable'];

// ── TRIGGER ──────────────────────────────────────────────────
var TRIGGER_FUNCTION   = 'cacheOperationalData';
var TRIGGER_INTERVAL   = 5;   // minutes

// ============================================================
// SECTION A: WEB APP ENDPOINT
// ============================================================

/**
 * doGet(e) — Web App entry point.
 * Reads the pre-computed JSON from DASHBOARD_CACHE!A2 and returns it.
 * Cold path (cache miss): falls back to live aggregation (slower but safe).
 * Target: <150 ms for the hot path (cache hit).
 */
function doGet(e) {
  var t0 = Date.now();
  var payload;

  try {
    var host = SpreadsheetApp.openById(HOST_SHEET_ID);
    var cacheSheet = host.getSheetByName(CACHE_TAB_NAME);

    if (cacheSheet) {
      var raw = cacheSheet.getRange(CACHE_CELL_ADDR).getValue();
      if (raw && typeof raw === 'string' && raw.charAt(0) === '{') {
        payload = raw;   // fast path: return cached value directly
      }
    }

    if (!payload) {
      // Cache miss or stale cell — run aggregation now (rare; trigger keeps it warm)
      Logger.log('doGet: cache miss — running live aggregation');
      payload = JSON.stringify(buildPayload_());
      ensureCacheCell_(host, payload);
    }
  } catch (err) {
    Logger.log('doGet ERROR: ' + err);
    payload = JSON.stringify({ error: err.toString(), ts: new Date().toISOString() });
  }

  var elapsed = Date.now() - t0;
  Logger.log('doGet responded in ' + elapsed + ' ms');

  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// SECTION B: CACHE WRITER  (called by 5-min trigger)
// ============================================================

/**
 * cacheOperationalData()
 * Reads all three source sheets, builds a consolidated JSON payload,
 * and writes it to DASHBOARD_CACHE!A2 on the host sheet.
 * This is the function the time trigger calls every 5 minutes.
 */
function cacheOperationalData() {
  var t0 = Date.now();
  Logger.log('cacheOperationalData: starting');

  try {
    var payload = buildPayload_();
    var json    = JSON.stringify(payload);
    var host    = SpreadsheetApp.openById(HOST_SHEET_ID);
    ensureCacheCell_(host, json);
    Logger.log('cacheOperationalData: done in ' + (Date.now() - t0) + ' ms  |  payload ' + json.length + ' bytes');
  } catch (err) {
    Logger.log('cacheOperationalData ERROR: ' + err + '\n' + err.stack);
    // Do not rethrow — a failed cache run must not kill the trigger chain.
  }
}

// ============================================================
// SECTION C: AGGREGATION ENGINE (private)
// ============================================================

/**
 * buildPayload_() → object
 * Reads all three source sheets and returns a plain JS object.
 * Each sub-collector is wrapped in try/catch so one broken sheet
 * does not block the others.
 */
function buildPayload_() {
  var today = todayString_();

  var plantOps    = readPlantOps_(today);
  var collections = readCollections_();
  var energy      = readEnergy_(today);

  return {
    ts          : new Date().toISOString(),
    date        : today,
    plant_ops   : plantOps,
    collections : collections,
    energy      : energy
  };
}

// ── Plant Operations ─────────────────────────────────────────

/**
 * readPlantOps_(today) → object
 * Reads each production tab. tbl_Cutting_Production applies the
 * email-header corruption patch; other tabs are read normally.
 */
function readPlantOps_(today) {
  var ss;
  try {
    ss = SpreadsheetApp.openById(PLANT_OPS_ID);
  } catch (err) {
    Logger.log('readPlantOps_: cannot open sheet — ' + err);
    return { error: 'cannot open Plant Operations sheet' };
  }

  var result = {};

  Object.keys(PLANT_OPS_TABS).forEach(function (key) {
    var tabName = PLANT_OPS_TABS[key];
    var isCutting = (key === 'cutting');

    try {
      var sheet = ss.getSheetByName(tabName);
      if (!sheet) {
        Logger.log('readPlantOps_: tab "' + tabName + '" not found — skipping');
        return;
      }
      result[key] = isCutting
        ? readCuttingTabPatched_(sheet, today)
        : readProductionTab_(sheet, today);
    } catch (err) {
      Logger.log('readPlantOps_ [' + tabName + '] ERROR: ' + err);
      result[key] = { error: String(err) };
    }
  });

  return result;
}

/**
 * readCuttingTabPatched_(sheet, today) → object
 *
 * CRITICAL PATCH: rows 2–24 of tbl_Cutting_Production carry corrupted
 * email-header strings in "Job Card / Heat No" (column C, 0-based index 2).
 * This function applies a two-part sanitation filter BEFORE any numeric
 * aggregation so that corrupted rows are counted but never summed.
 *
 * A row is considered corrupted when its "Job Card / Heat No" cell:
 *   (a) matches EMAIL_HEADER_RE (email / MIME header prefix), OR
 *   (b) is non-numeric after trimming whitespace and stripping commas
 *
 * Corrupted rows are logged to the console for audit; they are never
 * included in piece-count or weight totals.
 */
function readCuttingTabPatched_(sheet, today) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return emptyDeptResult_();

  // Read all data in one call to minimise Sheets API round-trips.
  var data = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), 7)).getValues();

  var stats = emptyDeptResult_();
  stats.rows_skipped_corrupted = 0;
  stats.rows_read = data.length;

  data.forEach(function (row, rowIndex) {
    var absoluteRow = rowIndex + 2;   // 1-based row in sheet
    var jobCardRaw  = row[COL_JOB_CARD];

    // ─── CORRUPTION FILTER ───────────────────────────────────
    if (isCorruptedJobCard_(jobCardRaw, absoluteRow)) {
      stats.rows_skipped_corrupted++;
      return;   // skip this row
    }

    // ─── DATE FILTER ─────────────────────────────────────────
    var rowDate = formatDate_(row[COL_DATE]);
    if (rowDate !== today) return;

    // ─── AGGREGATE ───────────────────────────────────────────
    var qty    = safeNumber_(row[COL_QTY]);
    var weight = safeNumber_(row[COL_WEIGHT]);
    var shift  = String(row[COL_SHIFT] || '').trim() || 'Unknown';

    stats.today_pieces += qty;
    stats.today_weight_kg += weight;
    stats.today_jobs++;

    if (!stats.shifts[shift]) {
      stats.shifts[shift] = { pieces: 0, weight_kg: 0, jobs: 0 };
    }
    stats.shifts[shift].pieces    += qty;
    stats.shifts[shift].weight_kg += weight;
    stats.shifts[shift].jobs++;
  });

  return stats;
}

/**
 * isCorruptedJobCard_(value, absoluteRow) → boolean
 * Returns true if the cell value looks like an email header or is non-numeric.
 */
function isCorruptedJobCard_(value, absoluteRow) {
  if (value === null || value === undefined || value === '') {
    // Blank job-card cells in the corrupted range — treat as corrupted.
    Logger.log('  row ' + absoluteRow + ': blank job card — skipped');
    return true;
  }

  var str = String(value).trim();

  // Part (a): email/MIME header prefix
  if (EMAIL_HEADER_RE.test(str)) {
    Logger.log('  row ' + absoluteRow + ': email header detected — "' + str.substring(0, 60) + '" — skipped');
    return true;
  }

  // Part (b): non-numeric (job cards are always integers)
  var stripped = str.replace(/,/g, '');   // allow comma-formatted numbers like "1,234"
  if (isNaN(Number(stripped)) || stripped === '') {
    Logger.log('  row ' + absoluteRow + ': non-numeric job card "' + str.substring(0, 60) + '" — skipped');
    return true;
  }

  return false;
}

/**
 * readProductionTab_(sheet, today) → object
 * Standard reader for Forge, Press, Machine, HT, Final tabs.
 * No corruption filter needed — only Cutting was reported corrupt.
 */
function readProductionTab_(sheet, today) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return emptyDeptResult_();

  var data  = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), 7)).getValues();
  var stats = emptyDeptResult_();
  stats.rows_read = data.length;

  data.forEach(function (row) {
    var rowDate = formatDate_(row[COL_DATE]);
    if (rowDate !== today) return;

    var qty    = safeNumber_(row[COL_QTY]);
    var weight = safeNumber_(row[COL_WEIGHT]);
    var shift  = String(row[COL_SHIFT] || '').trim() || 'Unknown';

    stats.today_pieces    += qty;
    stats.today_weight_kg += weight;
    stats.today_jobs++;

    if (!stats.shifts[shift]) {
      stats.shifts[shift] = { pieces: 0, weight_kg: 0, jobs: 0 };
    }
    stats.shifts[shift].pieces    += qty;
    stats.shifts[shift].weight_kg += weight;
    stats.shifts[shift].jobs++;
  });

  return stats;
}

// ── Collections ──────────────────────────────────────────────

/**
 * readCollections_() → object
 * Reads CURRENT_OVERDUE from the Collections Engine sheet.
 *
 * Resolution order:
 *   1. Named range 'CURRENT_OVERDUE' (authoritative if it exists)
 *   2. Scan COLLECTIONS_SUMMARY_TABS for a row whose first cell
 *      contains the text "CURRENT_OVERDUE" (case-insensitive)
 *
 * The resolved value is always included in the cache payload as
 * collections.current_overdue (number, INR).
 */
function readCollections_() {
  var ss;
  try {
    ss = SpreadsheetApp.openById(COLLECTIONS_ID);
  } catch (err) {
    Logger.log('readCollections_: cannot open sheet — ' + err);
    return { error: 'cannot open Collections sheet', current_overdue: null };
  }

  // ── Resolution path 1: named range ───────────────────────
  try {
    var nr = ss.getRangeByName(COLLECTIONS_NAMED_RANGE);
    if (nr) {
      var v = nr.getValue();
      Logger.log('readCollections_: CURRENT_OVERDUE via named range = ' + v);
      return {
        current_overdue : safeNumber_(v),
        currency        : 'INR',
        source          : 'named_range'
      };
    }
  } catch (nrErr) {
    Logger.log('readCollections_: named range lookup failed — ' + nrErr);
  }

  // ── Resolution path 2: scan summary tabs ─────────────────
  for (var i = 0; i < COLLECTIONS_SUMMARY_TABS.length; i++) {
    var sh = ss.getSheetByName(COLLECTIONS_SUMMARY_TABS[i]);
    if (!sh) continue;

    var lastRow  = sh.getLastRow();
    if (lastRow < 1) continue;

    var data = sh.getRange(1, 1, lastRow, 2).getValues();
    for (var r = 0; r < data.length; r++) {
      var label = String(data[r][0] || '').trim().toUpperCase();
      if (label === 'CURRENT_OVERDUE') {
        var val = data[r][1];
        Logger.log('readCollections_: CURRENT_OVERDUE via tab scan [' + COLLECTIONS_SUMMARY_TABS[i] + '] row ' + (r + 1) + ' = ' + val);
        return {
          current_overdue : safeNumber_(val),
          currency        : 'INR',
          source          : 'tab_scan:' + COLLECTIONS_SUMMARY_TABS[i]
        };
      }
    }
  }

  Logger.log('readCollections_: CURRENT_OVERDUE not found in named range or summary tabs');
  return { current_overdue: null, currency: 'INR', source: 'not_found' };
}

// ── Energy ───────────────────────────────────────────────────

/**
 * readEnergy_(today) → object
 * Reads today's electricity (kWh) and oil (litres) from the Utilities sheet.
 * Tries each tab name variant in order; uses the first tab that exists.
 * Assumes the tab has: Col A = Date, Col B = Shift, Col C = Reading/Quantity.
 */
function readEnergy_(today) {
  var ss;
  try {
    ss = SpreadsheetApp.openById(ENERGY_ID);
  } catch (err) {
    Logger.log('readEnergy_: cannot open sheet — ' + err);
    return { error: 'cannot open Energy sheet' };
  }

  return {
    electricity_kwh : readEnergyTab_(ss, ENERGY_ELEC_TABS, today, 'electricity'),
    oil_liters      : readEnergyTab_(ss, ENERGY_OIL_TABS,  today, 'oil'),
    period          : 'today'
  };
}

/**
 * readEnergyTab_(ss, tabNames, today, label) → number | null
 * Tries each tab name in tabNames until one is found, then sums
 * Col C (index 2) for rows matching today's date.
 */
function readEnergyTab_(ss, tabNames, today, label) {
  for (var i = 0; i < tabNames.length; i++) {
    var sh = ss.getSheetByName(tabNames[i]);
    if (!sh) continue;

    var lastRow = sh.getLastRow();
    if (lastRow < 2) return 0;

    var data  = sh.getRange(2, 1, lastRow - 1, Math.max(sh.getLastColumn(), 3)).getValues();
    var total = 0;

    data.forEach(function (row) {
      if (formatDate_(row[0]) === today) {
        total += safeNumber_(row[2]);
      }
    });

    Logger.log('readEnergyTab_[' + label + ']: tab "' + tabNames[i] + '" → ' + total + ' for ' + today);
    return total;
  }

  Logger.log('readEnergyTab_[' + label + ']: no matching tab found');
  return null;
}

// ============================================================
// SECTION D: CACHE CELL MANAGEMENT (private)
// ============================================================

/**
 * ensureCacheCell_(host, json)
 * Creates the DASHBOARD_CACHE tab if absent, writes the header label
 * to A1 and the JSON payload to A2. The A2 cell is formatted as
 * plain text to prevent Sheets from truncating large strings.
 */
function ensureCacheCell_(host, json) {
  var cacheSheet = host.getSheetByName(CACHE_TAB_NAME);

  if (!cacheSheet) {
    cacheSheet = host.insertSheet(CACHE_TAB_NAME);
    Logger.log('ensureCacheCell_: created tab "' + CACHE_TAB_NAME + '"');
  }

  // A1: human-readable header so a human opening the sheet is not confused
  var headerCell = cacheSheet.getRange(CACHE_HEADER_ADDR);
  if (!headerCell.getValue()) {
    headerCell.setValue('DASHBOARD_CACHE — JSON payload (auto-refreshed every 5 min). Do not edit manually.');
    headerCell.setFontWeight('bold').setBackground('#E8F0FE');
  }

  // A2: the payload. Format as plain text first to avoid 50k character truncation.
  var payloadCell = cacheSheet.getRange(CACHE_CELL_ADDR);
  payloadCell.setNumberFormat('@STRING@');
  payloadCell.setValue(json);

  SpreadsheetApp.flush();
  Logger.log('ensureCacheCell_: wrote ' + json.length + ' bytes to ' + CACHE_TAB_NAME + '!' + CACHE_CELL_ADDR);
}

// ============================================================
// SECTION E: TRIGGER INSTALLER  (run once manually)
// ============================================================

/**
 * installTimeTrigger()
 * Installs a ScriptApp time-based trigger that calls cacheOperationalData()
 * every TRIGGER_INTERVAL minutes. Safe to re-run — deletes any existing
 * trigger on the same function first so only one trigger exists at a time.
 *
 * HOW TO RUN:
 *   Apps Script editor → Run menu → installTimeTrigger → Authorise
 *   OR: Apps Script editor → Triggers (clock icon) → + Add Trigger →
 *       cacheOperationalData, Time-driven, Minutes timer, Every 5 minutes
 */
function installTimeTrigger() {
  // Remove any existing triggers for this function to avoid duplicates.
  var existing = ScriptApp.getProjectTriggers();
  existing.forEach(function (t) {
    if (t.getHandlerFunction() === TRIGGER_FUNCTION) {
      ScriptApp.deleteTrigger(t);
      Logger.log('installTimeTrigger: removed existing trigger ' + t.getUniqueId());
    }
  });

  // Create fresh trigger.
  var trigger = ScriptApp.newTrigger(TRIGGER_FUNCTION)
    .timeBased()
    .everyMinutes(TRIGGER_INTERVAL)
    .create();

  Logger.log('installTimeTrigger: installed — ' + TRIGGER_FUNCTION +
    ' every ' + TRIGGER_INTERVAL + ' min  |  trigger id: ' + trigger.getUniqueId());

  // Run immediately so the cache is warm before the first /exec call.
  cacheOperationalData();
}

/**
 * removeTrigger()
 * Removes all time triggers for cacheOperationalData. Run this if you
 * want to pause the background refresh without deleting the deployment.
 */
function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === TRIGGER_FUNCTION) {
      ScriptApp.deleteTrigger(t);
      Logger.log('removeTrigger: removed ' + t.getUniqueId());
    }
  });
}

// ============================================================
// SECTION F: SMOKE TESTS  (run manually to verify each source)
// ============================================================

/**
 * testCuttingPatch()
 * Reads tbl_Cutting_Production, logs how many rows were skipped
 * (corrupted) vs how many were clean, and logs today's totals.
 * Run this FIRST after deploying to confirm the corruption filter works.
 */
function testCuttingPatch() {
  Logger.log('=== testCuttingPatch ===');
  var ss = SpreadsheetApp.openById(PLANT_OPS_ID);
  var sh = ss.getSheetByName(PLANT_OPS_TABS.cutting);
  if (!sh) { Logger.log('ERROR: tab "' + PLANT_OPS_TABS.cutting + '" not found'); return; }

  var result = readCuttingTabPatched_(sh, todayString_());
  Logger.log('today_pieces: '           + result.today_pieces);
  Logger.log('today_weight_kg: '        + result.today_weight_kg);
  Logger.log('today_jobs: '             + result.today_jobs);
  Logger.log('rows_read: '              + result.rows_read);
  Logger.log('rows_skipped_corrupted: ' + result.rows_skipped_corrupted);
  Logger.log('shifts: '                 + JSON.stringify(result.shifts));
}

/**
 * testCollections()
 * Confirms CURRENT_OVERDUE is resolved and logs its value.
 */
function testCollections() {
  Logger.log('=== testCollections ===');
  var result = readCollections_();
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * testEnergy()
 * Confirms electricity and oil readings for today are non-null.
 */
function testEnergy() {
  Logger.log('=== testEnergy ===');
  var result = readEnergy_(todayString_());
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * testFullCache()
 * Runs the complete aggregation and writes to DASHBOARD_CACHE!A2.
 * Check the tab after running — A2 should contain a valid JSON string.
 */
function testFullCache() {
  Logger.log('=== testFullCache ===');
  cacheOperationalData();
  var host    = SpreadsheetApp.openById(HOST_SHEET_ID);
  var sheet   = host.getSheetByName(CACHE_TAB_NAME);
  if (!sheet) { Logger.log('ERROR: DASHBOARD_CACHE tab not found after run'); return; }
  var raw     = sheet.getRange(CACHE_CELL_ADDR).getValue();
  Logger.log('A2 length: ' + (raw ? raw.length : 0) + ' bytes');
  Logger.log('Valid JSON: ' + (function() { try { JSON.parse(raw); return true; } catch(e) { return false; } })());
  Logger.log('Payload preview: ' + String(raw).substring(0, 400));
}

/**
 * testDoGet()
 * Simulates a doGet call and logs the response body.
 * The real /exec endpoint goes through Google's proxy; this runs locally.
 */
function testDoGet() {
  Logger.log('=== testDoGet ===');
  var t0       = Date.now();
  var response = doGet({});
  var elapsed  = Date.now() - t0;
  var content  = response.getContent();
  Logger.log('elapsed: ' + elapsed + ' ms');
  Logger.log('length:  ' + content.length + ' bytes');
  Logger.log('preview: ' + content.substring(0, 400));
  if (elapsed > 150) Logger.log('⚠ WARNING: response exceeded 150 ms target (' + elapsed + ' ms)');
}

// ============================================================
// SECTION G: UTILITIES (private)
// ============================================================

function emptyDeptResult_() {
  return {
    today_pieces    : 0,
    today_weight_kg : 0,
    today_jobs      : 0,
    shifts          : {}
  };
}

/**
 * formatDate_(value) → 'YYYY-MM-DD' string
 * Handles Date objects, serialised date strings, and numbers.
 */
function formatDate_(value) {
  if (!value) return '';
  var d = (value instanceof Date) ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value).trim().substring(0, 10);
  var y  = d.getFullYear();
  var mo = ('0' + (d.getMonth() + 1)).slice(-2);
  var dy = ('0' + d.getDate()).slice(-2);
  return y + '-' + mo + '-' + dy;
}

/**
 * todayString_() → 'YYYY-MM-DD' for the current date in IST.
 * Apps Script runs in the script owner's timezone; if the script
 * project timezone is set to Asia/Kolkata this returns IST directly.
 */
function todayString_() {
  return formatDate_(new Date());
}

/**
 * safeNumber_(v) → number (0 if NaN / blank)
 */
function safeNumber_(v) {
  if (v === null || v === undefined || v === '') return 0;
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

// ============================================================
// SECTION H: DEPLOYMENT NOTES (reference, not executable)
// ============================================================
//
// WEB APP URL FORMAT after "Deploy → New deployment":
//
//   https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
//
// where <DEPLOYMENT_ID> is a 72-character base62 string like:
//   AKfycbw...
//
// The /exec URL is permanent for a given deployment version.
// If you click "Manage deployments → Edit → New version" the same
// /exec URL continues to work — the deployment ID does not change.
// A brand-new deployment gets a new ID and a new URL.
//
// HAND THIS URL to Claude Cowork — it will call GET /exec to retrieve
// the cached operational payload for dashboard rendering.
//
// EXPECTED doGet RESPONSE SHAPE (example, today = 2026-09-09):
//
// {
//   "ts": "2026-09-09T06:35:01.000Z",
//   "date": "2026-09-09",
//   "plant_ops": {
//     "cutting": {
//       "today_pieces": 312,
//       "today_weight_kg": 1560.5,
//       "today_jobs": 14,
//       "rows_read": 48,
//       "rows_skipped_corrupted": 23,
//       "shifts": {
//         "Shift 1": { "pieces": 120, "weight_kg": 600, "jobs": 5 },
//         "Shift 2": { "pieces": 110, "weight_kg": 550, "jobs": 5 },
//         "Shift 3": { "pieces": 82,  "weight_kg": 410.5, "jobs": 4 }
//       }
//     },
//     "forge":   { "today_pieces": 180, ... },
//     "press":   { "today_pieces": 240, ... },
//     "machine": { "today_pieces": 95,  ... },
//     "ht":      { "today_pieces": 155, ... },
//     "final_":  { "today_pieces": 210, ... }
//   },
//   "collections": {
//     "current_overdue": 2345000,
//     "currency": "INR",
//     "source": "named_range"
//   },
//   "energy": {
//     "electricity_kwh": 487.5,
//     "oil_liters": 14.2,
//     "period": "today"
//   }
// }
//
// TROUBLESHOOTING CHECKLIST:
//   ❑ "Exception: You do not have permission" → re-authorise by running
//     cacheOperationalData() in the editor (not doGet) and accepting all scopes
//   ❑ A2 contains empty string → run testFullCache() and check logs
//   ❑ collections.current_overdue is null → check named range 'CURRENT_OVERDUE'
//     exists in the Collections sheet, or add a row 'CURRENT_OVERDUE' in
//     the Summary tab col A with the value in col B
//   ❑ rows_skipped_corrupted is 0 when it should be ~23 → confirm COL_JOB_CARD
//     (currently 2, i.e. column C) is correct for this sheet
//   ❑ doGet exceeds 150 ms → the trigger may not be running; check
//     Apps Script → Triggers → confirm installTimeTrigger fired
