/**
 * Forge OS — MigrateToSupabase.gs
 *
 * Google Apps Script that implements the Layer 1 -> Layer 2 half of the
 * three-layer architecture in the Master System Definition, Section 4:
 * Google Sheets stays the source of truth for the Employee Master and the
 * 107 department daily forms; this script is the sync bridge that pushes
 * new/changed rows into Supabase (the operational database), and raises the
 * alerts described under "What Gets Monitored".
 *
 * INSTALL
 * 1. Open the Employee Master Google Sheet -> Extensions -> Apps Script.
 * 2. Paste this whole file in as a script file (e.g. MigrateToSupabase.gs).
 * 3. Project Settings -> Script Properties, add:
 * ⚠ AUDITED 12 Aug 2026 — THIS SCRIPT HAD NEVER WORKED. It was written
 * against supabase/migrations/20260803090000_initial_schema.sql, the old
 * spec-derived schema, not against FINAL_SCHEMA_02Aug2026.sql which is what is
 * deployed. Every field it pushed was wrong:
 *
 *   department_id      -> employees.department is TEXT, there is no FK
 *   salary_structure   -> does not exist; FINAL_SCHEMA has a single `salary`
 *   designation, date_of_joining, date_of_birth, gender, bank_*, pf_number,
 *   uan, esic_number, pan  -> none of these columns exist
 *
 * So the very first employee push would have been rejected outright. Nobody
 * noticed because the script was committed and never installed.
 *
 * Fixed below to FINAL_SCHEMA. The production-form sync was REMOVED rather
 * than fixed: it posted to `hourly_production`, a table that does not exist
 * either, and production is now handled properly by syncProductionToSupabase()
 * in scripts/ALERT.gs, reading the Operations Dashboard RAW tabs into
 * production_records (PATCH_15). Two paths for the same data, one of them
 * broken, is worse than one that works.
 *
 * STILL OPTIONAL. The database is currently the source of truth for all 129
 * employees. Only install this if the Employee Master Sheet becomes the master
 * again.
 *
 *      SUPABASE_URL                = https://your-project-ref.supabase.co
 *      SUPABASE_SERVICE_ROLE_KEY   = your-service-role-key   (server-side only — never share this sheet)
 * 4. Run `createTriggers` once from the Apps Script editor (grants OAuth scopes).
 * 5. Adjust SHEET_NAMES / column header names below to match your sheet's
 *    actual header row if they differ.
 *
 * WHAT RUNS ON A SCHEDULE (installed by createTriggers)
 *   - syncEmployeeMaster          every 15 minutes  (Employee Master -> employees)
 *   - monitorStaleSheets          daily             (Section 4 "not updated in 48 hours" alert)
 */

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

var SHEET_NAMES = {
  EMPLOYEE_MASTER: 'Employee Master',
  FORGE_SHOP_DAILY: 'Forge Shop Daily Check Sheet',
  MACHINE_SHOP_PMS: '202409 PMS Machine Shop',
  HT_SHOP_DAILY: 'HT Shop Daily Check Sheet',
  PRESS_SHOP_DAILY: 'Press Shop Daily Check Sheet',
};

// Column headers expected in the Employee Master sheet (case-insensitive
// match against row 1). Extra columns in the sheet are ignored.
var EMPLOYEE_MASTER_COLUMNS = {
  emp_code: 'Employee Code',
  name: 'Full Name',
  phone: 'Phone',
  role: 'Role',
  department: 'Department',
  category: 'Category',
  salary: 'Salary',
};

var SYNCED_COLUMN_HEADER = 'Synced At'; // written back by this script after a successful push
var STALE_SHEET_ALERT_HOURS = 48;

// ---------------------------------------------------------------------------
// TRIGGER SETUP
// ---------------------------------------------------------------------------

function createTriggers() {
  deleteAllTriggers_();

  ScriptApp.newTrigger('syncEmployeeMaster').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('monitorStaleSheets').timeBased().everyDays(1).atHour(9).create();

  Logger.log('Triggers installed: syncEmployeeMaster (15 min), monitorStaleSheets (daily 9am).');
}

function deleteAllTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
}

// ---------------------------------------------------------------------------
// EMPLOYEE MASTER -> employees  (every 15 minutes, new/changed rows only)
// ---------------------------------------------------------------------------

function syncEmployeeMaster() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.EMPLOYEE_MASTER);
  if (!sheet) {
    Logger.log('Employee Master sheet not found: ' + SHEET_NAMES.EMPLOYEE_MASTER);
    return;
  }

  var headerMap = buildHeaderMap_(sheet);
  var syncedCol = getOrCreateColumn_(sheet, headerMap, SYNCED_COLUMN_HEADER);

  var data = sheet.getDataRange().getValues();
  var pushed = 0;
  var errors = 0;

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var employeeCode = getCell_(row, headerMap, EMPLOYEE_MASTER_COLUMNS.emp_code);
    if (!employeeCode) continue; // blank row

    var alreadySynced = row[syncedCol - 1];
    var rowEditedAfterSync = true; // Sheets doesn't expose per-cell edit time in a batch read; always re-push, upsert is idempotent.
    if (alreadySynced && !rowEditedAfterSync) continue;

    var isNewEmployee = !alreadySynced;
    var payload = buildEmployeePayload_(row, headerMap);

    try {
      var existing = supabaseRequest_('GET', '/rest/v1/employees', null, {
        select: 'id,is_active',
        emp_code: 'eq.' + employeeCode,
      });

      if (!existing || existing.length === 0) {
        // New row added outside the app -> Section 4: force is_active = false,
        // never let the sheet activate someone directly, and notify Plant Head.
        payload.is_active = false;
        supabaseRequest_('POST', '/rest/v1/employees', payload, null, {
          Prefer: 'return=representation,resolution=merge-duplicates',
        });
        notifyPlantHeadOfNewEmployee_(payload);
      } else {
        // Existing employee: sync editable master-data fields, but never
        // flip is_active from the sheet — that stays app-owned (Workflow 3).
        delete payload.is_active;
        supabaseRequest_('PATCH', '/rest/v1/employees', payload, { emp_code: 'eq.' + employeeCode });
      }

      sheet.getRange(r + 1, syncedCol).setValue(new Date());
      pushed++;
    } catch (err) {
      Logger.log('syncEmployeeMaster failed for ' + employeeCode + ': ' + err);
      errors++;
    }
  }

  Logger.log('syncEmployeeMaster: pushed=' + pushed + ' errors=' + errors);
}

function buildEmployeePayload_(row, headerMap) {
  var c = EMPLOYEE_MASTER_COLUMNS;

  // FINAL_SCHEMA employees columns only. `department` is plain text — there is
  // no departments FK to look up, which also removes a REST round-trip per row.
  return {
    emp_code: getCell_(row, headerMap, c.emp_code),
    name: getCell_(row, headerMap, c.name),
    phone: normalizePhone_(getCell_(row, headerMap, c.phone)),
    role: normalizeRole_(getCell_(row, headerMap, c.role)),
    department: getCell_(row, headerMap, c.department) || null,
    category: getCell_(row, headerMap, c.category) || null,
    salary: toNumber_(getCell_(row, headerMap, c.salary)),
  };
}

function notifyPlantHeadOfNewEmployee_(employeePayload) {
  var plantHeads = supabaseRequest_('GET', '/rest/v1/employees', null, {
    select: 'id',
    role: 'eq.plant_head',
    is_active: 'eq.true',
  });
  if (!plantHeads || plantHeads.length === 0) return;

  var notifications = plantHeads.map(function (ph) {
    return {
      employee_id: ph.id,
      type: 'new_employee_pending_approval',
      title: 'New employee pending approval',
      body: (employeePayload.name || employeePayload.emp_code) + ' was added to the Employee Master sheet and needs your approval.',
    };
  });
  supabaseRequest_('POST', '/rest/v1/notifications', notifications);
}

// ---------------------------------------------------------------------------
// MONITORING / ALERTING (Section 4 "What Gets Monitored")
// ---------------------------------------------------------------------------

/** Any tracked sheet not updated in 48 hours on a working day -> alert the department HOD by email. */
function monitorStaleSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var trackedSheets = [
    SHEET_NAMES.FORGE_SHOP_DAILY,
    SHEET_NAMES.MACHINE_SHOP_PMS,
    SHEET_NAMES.HT_SHOP_DAILY,
    SHEET_NAMES.PRESS_SHOP_DAILY,
  ];

  var now = new Date();

  trackedSheets.forEach(function (sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return; // no data rows yet

    var headerMap = buildHeaderMap_(sheet);
    // Whichever column is called Date / Shift Date, else fall back to the
    // first column, which is where a Forms response sheet puts its timestamp.
    var dateCol = headerMap['shift date'] || headerMap['date'];
    var lastEntryDate = dateCol ? sheet.getRange(lastRow, dateCol).getValue() : sheet.getRange(lastRow, 1).getValue();
    if (!(lastEntryDate instanceof Date)) return;

    var hoursSince = (now.getTime() - lastEntryDate.getTime()) / (1000 * 60 * 60);
    if (hoursSince > STALE_SHEET_ALERT_HOURS) {
      alertHod_(sheetName, Math.round(hoursSince));
    }
  });
}

function alertHod_(sheetName, hoursSinceLastEntry) {
  var hodEmail = PropertiesService.getScriptProperties().getProperty('HOD_ALERT_EMAIL_' + sheetName.replace(/\s+/g, '_'));
  if (!hodEmail) {
    Logger.log('No HOD_ALERT_EMAIL_* script property set for "' + sheetName + '" — skipping email, logging only.');
    return;
  }
  MailApp.sendEmail({
    to: hodEmail,
    subject: 'Forge OS alert: "' + sheetName + '" has no new entries in ' + hoursSinceLastEntry + ' hours',
    body:
      'The sheet "' + sheetName + '" has not received a new entry in ' + hoursSinceLastEntry + ' hours ' +
      '(alert threshold: ' + STALE_SHEET_ALERT_HOURS + ' hours). Please check with the shift team.\n\n— Forge OS',
  });
}

// ---------------------------------------------------------------------------
// SUPABASE REST HELPERS
// ---------------------------------------------------------------------------

function supabaseRequest_(method, path, payload, query, extraHeaders) {
  var props = PropertiesService.getScriptProperties();
  var baseUrl = props.getProperty('SUPABASE_URL');
  var serviceKey = props.getProperty('SUPABASE_SERVICE_ROLE_KEY');

  if (!baseUrl || !serviceKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Script Properties first.');
  }

  var url = baseUrl.replace(/\/$/, '') + path;
  if (query) {
    var params = [];
    for (var key in query) {
      params.push(encodeURIComponent(key) + '=' + encodeURIComponent(query[key]));
    }
    if (params.length > 0) url += '?' + params.join('&');
  }

  var headers = {
    apikey: serviceKey,
    Authorization: 'Bearer ' + serviceKey,
    'Content-Type': 'application/json',
  };
  if (extraHeaders) {
    for (var h in extraHeaders) headers[h] = extraHeaders[h];
  }

  var options = {
    method: method,
    headers: headers,
    muteHttpExceptions: true,
  };
  if (payload !== null && payload !== undefined) {
    options.payload = JSON.stringify(payload);
  }

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var text = response.getContentText();

  if (code >= 400) {
    throw new Error('Supabase ' + method + ' ' + path + ' failed (' + code + '): ' + text);
  }

  return text ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------------------
// SHEET HELPERS
// ---------------------------------------------------------------------------

/** Maps lower-cased header text -> 1-based column index. */
function buildHeaderMap_(sheet) {
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < headerRow.length; i++) {
    var header = String(headerRow[i]).trim().toLowerCase();
    if (header) map[header] = i + 1;
  }
  return map;
}

function getCell_(row, headerMap, headerName) {
  var col = headerMap[String(headerName).toLowerCase()];
  if (!col) return null;
  var value = row[col - 1];
  return value === '' ? null : value;
}

/** Returns the 1-based column index for `headerName`, creating it (appended) if it doesn't exist yet. */
function getOrCreateColumn_(sheet, headerMap, headerName) {
  var key = headerName.toLowerCase();
  if (headerMap[key]) return headerMap[key];

  var newCol = sheet.getLastColumn() + 1;
  sheet.getRange(1, newCol).setValue(headerName);
  headerMap[key] = newCol;
  return newCol;
}

function normalizePhone_(value) {
  if (!value) return null;
  var digits = String(value).replace(/\D/g, '');
  if (digits.length === 10) return '+91' + digits;
  if (digits.length === 12 && digits.indexOf('91') === 0) return '+' + digits;
  return String(value);
}

function normalizeRole_(value) {
  if (!value) return 'member';
  var v = String(value).trim().toLowerCase().replace(/\s+/g, '_');
  var valid = ['owner', 'plant_head', 'manager', 'supervisor', 'member', 'hr_admin', 'security_guard', 'ai_agent'];
  return valid.indexOf(v) >= 0 ? v : 'member';
}

function normalizeShiftType_(value) {
  if (!value) return 'general';
  var v = String(value).trim().toLowerCase();
  var valid = ['morning', 'evening', 'night', 'general'];
  return valid.indexOf(v) >= 0 ? v : 'general';
}

function formatDate_(value) {
  if (!value) return null;
  var d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  return Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd');
}

function toNumber_(value) {
  if (value === null || value === undefined || value === '') return 0;
  var n = Number(value);
  return isNaN(n) ? 0 : n;
}
