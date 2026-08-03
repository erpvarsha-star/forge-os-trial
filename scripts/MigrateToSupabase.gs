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
 *      SUPABASE_URL                = https://your-project-ref.supabase.co
 *      SUPABASE_SERVICE_ROLE_KEY   = your-service-role-key   (server-side only — never share this sheet)
 * 4. Run `createTriggers` once from the Apps Script editor (grants OAuth scopes).
 * 5. Adjust SHEET_NAMES / column header names below to match your sheet's
 *    actual header row if they differ.
 *
 * WHAT RUNS ON A SCHEDULE (installed by createTriggers)
 *   - syncEmployeeMaster          every 15 minutes  (Employee Master -> employees)
 *   - syncPriorityOneForms        every 2 hours     (production forms -> hourly_production)
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
  designation: 'Designation',
  date_of_joining: 'Date of Joining',
  date_of_birth: 'Date of Birth',
  gender: 'Gender',
  bank_account_number: 'Bank Account Number',
  bank_ifsc: 'Bank IFSC',
  bank_name: 'Bank Name',
  pf_number: 'PF Number',
  uan: 'UAN',
  esic_number: 'ESIC Number',
  pan: 'PAN',
  basic: 'Basic',
  hra: 'HRA',
  conveyance: 'Conveyance',
  washing: 'Washing',
  education: 'Education',
  vda: 'VDA',
  heat: 'Heat Allowance',
};

var SYNCED_COLUMN_HEADER = 'Synced At'; // written back by this script after a successful push
var STALE_SHEET_ALERT_HOURS = 48;

// ---------------------------------------------------------------------------
// TRIGGER SETUP
// ---------------------------------------------------------------------------

function createTriggers() {
  deleteAllTriggers_();

  ScriptApp.newTrigger('syncEmployeeMaster').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('syncPriorityOneForms').timeBased().everyHours(2).create();
  ScriptApp.newTrigger('monitorStaleSheets').timeBased().everyDays(1).atHour(9).create();

  Logger.log('Triggers installed: syncEmployeeMaster (15 min), syncPriorityOneForms (2 hr), monitorStaleSheets (daily 9am).');
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
  var payload = {
    emp_code: getCell_(row, headerMap, c.emp_code),
    name: getCell_(row, headerMap, c.name),
    phone: normalizePhone_(getCell_(row, headerMap, c.phone)),
    role: normalizeRole_(getCell_(row, headerMap, c.role)),
    designation: getCell_(row, headerMap, c.designation) || null,
    date_of_joining: formatDate_(getCell_(row, headerMap, c.date_of_joining)),
    date_of_birth: formatDate_(getCell_(row, headerMap, c.date_of_birth)),
    gender: getCell_(row, headerMap, c.gender) || null,
    bank_account_number: getCell_(row, headerMap, c.bank_account_number) || null,
    bank_ifsc: getCell_(row, headerMap, c.bank_ifsc) || null,
    bank_name: getCell_(row, headerMap, c.bank_name) || null,
    pf_number: getCell_(row, headerMap, c.pf_number) || null,
    uan: getCell_(row, headerMap, c.uan) || null,
    esic_number: getCell_(row, headerMap, c.esic_number) || null,
    pan: getCell_(row, headerMap, c.pan) || null,
    salary_structure: {
      basic: toNumber_(getCell_(row, headerMap, c.basic)),
      hra: toNumber_(getCell_(row, headerMap, c.hra)),
      conveyance: toNumber_(getCell_(row, headerMap, c.conveyance)),
      washing: toNumber_(getCell_(row, headerMap, c.washing)),
      education: toNumber_(getCell_(row, headerMap, c.education)),
      vda: toNumber_(getCell_(row, headerMap, c.vda)),
      heat: toNumber_(getCell_(row, headerMap, c.heat)),
    },
  };

  var departmentName = getCell_(row, headerMap, c.department);
  if (departmentName) {
    var dept = supabaseRequest_('GET', '/rest/v1/departments', null, {
      select: 'id',
      name: 'eq.' + departmentName,
    });
    if (dept && dept.length > 0) payload.department_id = dept[0].id;
  }

  return payload;
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
// PRIORITY 1 PRODUCTION FORMS -> hourly_production  (every 2 hours)
// ---------------------------------------------------------------------------

/**
 * Generic sync for a daily check sheet whose rows map 1:1 to a production
 * entry. Column headers below are the common denominator across the
 * Priority 1 sheets (Section 4) — adjust per-sheet if a form's headers
 * differ from this shape.
 */
var PRODUCTION_FORM_COLUMNS = {
  emp_code: 'Employee Code',
  machine_id: 'Machine',
  part_number: 'Part Number',
  shift_date: 'Date',
  shift_type: 'Shift',
  hour_slot: 'Hour',
  parts_made: 'Parts Made',
};

function syncPriorityOneForms() {
  syncProductionSheet_(SHEET_NAMES.FORGE_SHOP_DAILY);
  syncProductionSheet_(SHEET_NAMES.MACHINE_SHOP_PMS);
  syncProductionSheet_(SHEET_NAMES.HT_SHOP_DAILY);
  syncProductionSheet_(SHEET_NAMES.PRESS_SHOP_DAILY);
}

function syncProductionSheet_(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    Logger.log('Sheet not found, skipping: ' + sheetName);
    return;
  }

  var headerMap = buildHeaderMap_(sheet);
  var syncedCol = getOrCreateColumn_(sheet, headerMap, SYNCED_COLUMN_HEADER);
  var data = sheet.getDataRange().getValues();
  var pushed = 0;

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (row[syncedCol - 1]) continue; // already synced — form responses are append-only, never re-pushed

    var employeeCode = getCell_(row, headerMap, PRODUCTION_FORM_COLUMNS.emp_code);
    if (!employeeCode) continue;

    var employees = supabaseRequest_('GET', '/rest/v1/employees', null, {
      select: 'id,department_id',
      emp_code: 'eq.' + employeeCode,
    });
    if (!employees || employees.length === 0) {
      Logger.log('Unknown emp_code in ' + sheetName + ' row ' + (r + 1) + ': ' + employeeCode);
      continue;
    }

    var payload = {
      employee_id: employees[0].id,
      department_id: employees[0].department_id,
      machine_id: getCell_(row, headerMap, PRODUCTION_FORM_COLUMNS.machine_id) || 'UNKNOWN',
      shift_date: formatDate_(getCell_(row, headerMap, PRODUCTION_FORM_COLUMNS.shift_date)),
      shift_type: normalizeShiftType_(getCell_(row, headerMap, PRODUCTION_FORM_COLUMNS.shift_type)),
      hour_slot: toNumber_(getCell_(row, headerMap, PRODUCTION_FORM_COLUMNS.hour_slot)) || 1,
      parts_made: toNumber_(getCell_(row, headerMap, PRODUCTION_FORM_COLUMNS.parts_made)) || 0,
      entry_type: 'hourly',
    };

    try {
      supabaseRequest_('POST', '/rest/v1/hourly_production', payload);
      sheet.getRange(r + 1, syncedCol).setValue(new Date());
      pushed++;
    } catch (err) {
      Logger.log('syncProductionSheet_ failed for ' + sheetName + ' row ' + (r + 1) + ': ' + err);
    }
  }

  Logger.log('syncProductionSheet_(' + sheetName + '): pushed=' + pushed);
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
    var dateCol = headerMap[PRODUCTION_FORM_COLUMNS.shift_date.toLowerCase()];
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
