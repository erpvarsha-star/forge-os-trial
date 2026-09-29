// ============================================================
// AttendanceReport.gs — daily + month-end attendance to Sheet + email
// ============================================================
// Purpose: reads Supabase `attendance_records` (Forge OS) and writes:
//   - a running "Daily Attendance" log, one row per ACTIVE employee per
//     day (blank check-in/out/hours for anyone who didn't check in —
//     nobody is silently dropped, matching this app's own convention:
//     see constants/index.ts's PRESENT_STATUSES / this session's
//     "Attendance counting rules" fix)
//   - a "Monthly Attendance Summary" tab, rebuilt for the month that
//     just closed, on the 1st of each month
// into the "VFL HR OS 2026 27" spreadsheet, plus a short email summary.
//
// Lives in the SAME Apps Script project as ALERT.gs — paste this file
// in alongside it. Reuses ALERT.gs's SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY Script Properties and getSupabaseCredentials_()
// — do not redefine those here.
//
// SETUP (one-time, Yash/HR):
//   1. Apps Script editor for the project that already has ALERT.gs →
//      add this file (same project — Supabase credentials are shared).
//   2. Once email recipients are known: Project Settings → Script
//      Properties → add ATTENDANCE_REPORT_RECIPIENTS (comma-separated
//      email addresses). Until set, the email step logs and no-ops —
//      the Sheet still updates normally.
//   3. Run installAttendanceReportTrigger() once from the editor. It
//      logs the project's total trigger count before/after — read that
//      log line and make sure it stayed under Google's 20-per-project
//      ceiling (this project shares that ceiling with another script;
//      see CLAUDE.md, "Telegram — too many triggers").
//   4. Sanity check first: run testAttendanceReportForDate('2026-09-27')
//      (or any recent date) and read the execution log before trusting
//      the trigger.
//
// v2 (28 Sep 2026) — fixed after an independent design review:
//   - `.timeBased().atHour(N)` fires relative to the Apps Script
//     PROJECT's own timezone setting, which is not confirmed anywhere
//     in this repo (no setTimeZone/manifest call found in any .gs
//     file). `ClockTriggerBuilder` also has no `.inTimezone()` method —
//     v1 of this file called one, which does not exist and would have
//     thrown at install time. Fixed by following the same pattern
//     already proven elsewhere in this project (runShiftAlerts15min_):
//     an HOURLY trigger whose handler explicitly checks
//     Utilities.formatDate(now, 'Asia/Kolkata', ...) before doing any
//     real work, deduped via Script Properties so it only actually
//     runs once per IST calendar day.
//   - Daily report now lists every active employee, not just those who
//     checked in — an absent employee gets a blank row rather than
//     being left out, matching this app's "never silently drop people
//     from the denominator" convention (fixed this same session for
//     the in-app dashboards). Implemented by querying FROM `employees`
//     and left-embedding `attendance_records`, so an employee with no
//     row for the date still appears.
//   - Each run also re-processes the day before yesterday, not just
//     yesterday — self-heals a Shift-3 worker whose checkout lands
//     after this run (e.g. 07:45 IST) without any special-case code,
//     since the upsert-by-key write just corrects that row the next
//     morning.
//
// v1 (28 Sep 2026) — initial build, decisions from Yash:
//   - Daily columns: Date, Emp Code, Name, Department, Check In,
//     Check Out, Working Hrs, Late Mins — late mins left blank unless
//     it crossed the shift's grace period. This is already how
//     attendance_records.late_minutes is stored (see
//     hooks/useAttendance.ts's checkIn(): the value passed in is already
//     grace-adjusted), so no new math happens here — just don't print
//     it when null/0.
//   - Month-end columns: Month, Emp Code, Name, Department, Total
//     Present Days, Avg Working Hrs/Day, Times Late (>grace).
//   - No-checkout rule (CLAUDE.md, "Working hours mapping", 28 Sep
//     2026): if someone CHECKED IN but hours_worked is null (never
//     checked out), that's a normal full day, not blank — General=9h,
//     every other shift=8.5h floor. This does NOT apply to a day with
//     no check-in at all (absent/week-off/holiday) — those stay blank.
//     Hand-replicates lib/workingHours.ts's defaultHoursForShift(),
//     since Apps Script can't import it — keep both in sync if that
//     rule ever changes.
//   - Shift 3 belongs to the previous working day (CLAUDE.md, 28 Sep
//     2026) — the report for calendar date D must run after D's
//     Shift 3 window (00:00-07:00 on D+1) has closed, hence gating on
//     the 07:00-07:59 IST hour, not midnight.
//   - "TOTAL DAYS" (month-end) is read as total days PRESENT (P/L/HL),
//     paired with "average working hrs per day" on those same days —
//     flagged as an assumption, not a certainty, in CLAUDE.md.
//   - Email recipients not yet given by Yash — the email step no-ops
//     (logs only) until ATTENDANCE_REPORT_RECIPIENTS is set.
// ============================================================

var ATTENDANCE_SHEET_ID = '10-OpV86Gvi_TlBPQ6zKQC6y7MLWqietELGU3G06exIM'; // "VFL HR OS 2026 27"
var ATTENDANCE_DAILY_TAB = 'Daily Attendance';
var ATTENDANCE_MONTHLY_TAB = 'Monthly Attendance Summary';

// Comma-separated email addresses. Script Property ATTENDANCE_REPORT_RECIPIENTS
// wins if set (same inline-or-Script-Properties pattern as TELEGRAM_BOT_TOKEN_INLINE
// elsewhere in this project). Provided by Yash, 29 Sep 2026 — same
// not-a-secret treatment as OWNER_EMAIL in ALERT.gs, committed directly.
var ATTENDANCE_REPORT_RECIPIENTS_INLINE = 'hr@varshaforgings.com,ea@varshaforgings.com,yash.munot@gmail.com';

// First column is a hidden dedup key, not shown to Yash/HR.
var ATTENDANCE_DAILY_HEADERS =
  ['_key', 'Date', 'Emp Code', 'Name', 'Department', 'Check In', 'Check Out', 'Working Hrs', 'Late Mins'];
var ATTENDANCE_MONTHLY_HEADERS =
  ['_key', 'Month', 'Emp Code', 'Name', 'Department', 'Total Present Days', 'Avg Working Hrs/Day', 'Times Late (>grace)'];

// Same rule as lib/workingHours.ts's defaultHoursForShift() — General = 9h,
// Shift 4 (PATCH_64, 07:00-19:00) and Shift 5 (PATCH_63, 19:00-07:00),
// both 29 Sep 2026 (the Shift-1/Shift-3 OT variants) = 12h, everything
// else = 8.5h floor. Keep in sync by hand if that rule ever changes.
var ATTENDANCE_DEFAULT_HOURS_GENERAL = 9;
var ATTENDANCE_DEFAULT_HOURS_12H = 12;
var ATTENDANCE_DEFAULT_HOURS_OTHER = 8.5;

function attendanceReportRecipients_() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('ATTENDANCE_REPORT_RECIPIENTS') || ATTENDANCE_REPORT_RECIPIENTS_INLINE;
  return (raw || '').split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
}

// ============================================================
// Supabase reads (GET) — getSupabaseCredentials_() is defined in
// ALERT.gs (same project); reused here, not redefined.
// ============================================================

function supabaseGet_(path) {
  var creds = getSupabaseCredentials_();
  var res = UrlFetchApp.fetch(creds.url.replace(/\/$/, '') + path, {
    method: 'get',
    headers: { apikey: creds.key, Authorization: 'Bearer ' + creds.key },
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Supabase GET ' + path + ' failed (' + code + '): ' + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

function fetchShiftDefaultsById_() {
  var shifts = supabaseGet_('/rest/v1/shifts?select=id,name');
  var byId = {};
  shifts.forEach(function(s) {
    byId[s.id] = (s.name === 'General') ? ATTENDANCE_DEFAULT_HOURS_GENERAL
      : (s.name === 'Shift 4' || s.name === 'Shift 5') ? ATTENDANCE_DEFAULT_HOURS_12H
      : ATTENDANCE_DEFAULT_HOURS_OTHER;
  });
  return byId;
}

// employee_id -> default hours for that date's assigned shift (or the
// 8.5h floor if no shift row exists) — used only when someone checked
// in but hours_worked is null (never checked out).
function fetchEmployeeShiftDefaults_(dateStr) {
  var shiftDefaultById = fetchShiftDefaultsById_();
  var rows = supabaseGet_('/rest/v1/employee_shifts?select=employee_id,shift_id&date=eq.' + dateStr);
  var byEmployee = {};
  rows.forEach(function(r) {
    byEmployee[r.employee_id] = shiftDefaultById[r.shift_id] || ATTENDANCE_DEFAULT_HOURS_OTHER;
  });
  return byEmployee;
}

// Queried FROM employees, left-embedding attendance_records for the date
// (default PostgREST embed = left join), so every active employee shows
// up even with no attendance_records row that day — never silently
// dropped, matching this app's own "expected = active headcount" rule.
function fetchDailyAttendance_(dateStr) {
  if (!dateStr) throw new Error('fetchDailyAttendance_ called with no dateStr — pass a real "YYYY-MM-DD" date, not undefined.');
  // employees has 3 FK relationships into attendance_records (employee_id,
  // checkpoint2_confirmed_by, checkpoint3_confirmed_by) — PostgREST refuses
  // to guess which one to embed (PGRST201) unless the FK is named explicitly.
  var path = '/rest/v1/employees' +
    '?select=id,emp_code,name,department,attendance_records!attendance_records_employee_id_fkey(check_in_time,check_out_time,hours_worked,late_minutes)' +
    '&is_active=eq.true' +
    '&attendance_records.date=eq.' + dateStr;
  var emps = supabaseGet_(path);
  var shiftDefaults = null; // lazy-fetched only if some row actually needs it

  var out = emps.map(function(e) {
    var att = (e.attendance_records && e.attendance_records[0]) || null;
    var checkIn = att ? att.check_in_time : null;
    var checkOut = att ? att.check_out_time : null;
    var lateMins = (att && att.late_minutes && att.late_minutes > 0) ? att.late_minutes : null;

    var hours = '';
    if (att && checkIn) {
      // Checked in. hours_worked set -> use it. Null -> no-checkout default.
      if (att.hours_worked !== null && att.hours_worked !== undefined) {
        hours = att.hours_worked;
      } else {
        if (!shiftDefaults) shiftDefaults = fetchEmployeeShiftDefaults_(dateStr);
        hours = shiftDefaults[e.id] || ATTENDANCE_DEFAULT_HOURS_OTHER;
      }
    }
    // No check-in at all (absent/week-off/holiday/no row): hours stays blank.

    return {
      key: e.id,
      empCode: e.emp_code,
      name: e.name,
      department: e.department || '',
      checkIn: checkIn,
      checkOut: checkOut,
      workingHrs: hours,
      lateMins: lateMins
    };
  });

  out.sort(function(a, b) {
    return (a.department + a.empCode).localeCompare(b.department + b.empCode);
  });
  return out;
}

// Same left-embed shape as the daily fetch, but for a date range and
// aggregated per employee. "Present" days = status P/L/HL, matching
// constants/index.ts's PRESENT_STATUSES.
function fetchMonthlyAttendance_(year, month) {
  var mm = (month < 10 ? '0' : '') + month;
  var startDate = year + '-' + mm + '-01';
  var lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  var endDate = year + '-' + mm + '-' + (lastDay < 10 ? '0' : '') + lastDay;

  // Same PGRST201 fix as fetchDailyAttendance_ — must name the FK explicitly.
  var path = '/rest/v1/employees' +
    '?select=id,emp_code,name,department,attendance_records!attendance_records_employee_id_fkey(date,check_in_time,hours_worked,late_minutes,status)' +
    '&is_active=eq.true' +
    '&attendance_records.date=gte.' + startDate +
    '&attendance_records.date=lte.' + endDate;
  var emps = supabaseGet_(path);

  // Lazily resolve no-checkout defaults, grouped by date to minimize calls.
  var nullHourDates = {};
  emps.forEach(function(e) {
    (e.attendance_records || []).forEach(function(a) {
      if (a.check_in_time && (a.hours_worked === null || a.hours_worked === undefined)) {
        nullHourDates[a.date] = true;
      }
    });
  });
  var shiftDefaultsByDate = {};
  Object.keys(nullHourDates).forEach(function(d) {
    shiftDefaultsByDate[d] = fetchEmployeeShiftDefaults_(d);
  });

  var out = emps.map(function(e) {
    var days = 0, hoursSum = 0, lateCount = 0;
    (e.attendance_records || []).forEach(function(a) {
      if (['P', 'L', 'HL'].indexOf(a.status) === -1) return;
      days += 1;
      var hours = a.hours_worked;
      if ((hours === null || hours === undefined) && a.check_in_time) {
        var forDate = shiftDefaultsByDate[a.date] || {};
        hours = forDate[e.id] || ATTENDANCE_DEFAULT_HOURS_OTHER;
      }
      hoursSum += hours || 0;
      if (a.late_minutes && a.late_minutes > 0) lateCount += 1;
    });
    return {
      key: e.id,
      empCode: e.emp_code,
      name: e.name,
      department: e.department || '',
      totalDays: days,
      avgHours: days ? Math.round((hoursSum / days) * 100) / 100 : '',
      timesLate: lateCount
    };
  });

  out.sort(function(a, b) {
    return (a.department + a.empCode).localeCompare(b.department + b.empCode);
  });
  return out;
}

// ============================================================
// Sheet writes — upsert-by-key in place (not delete+append), so a
// manual re-trigger or the daily self-heal re-run just corrects the
// existing row for that key instead of duplicating or leaving a gap.
// ============================================================

function attendanceSheet_() {
  return SpreadsheetApp.openById(ATTENDANCE_SHEET_ID);
}

function getOrCreateAttendanceTab_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.hideColumns(1); // hide the _key column
  } else if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.hideColumns(1);
  }
  return sh;
}

// `rows` are full row arrays, first cell = the dedup key (column 1).
function upsertAttendanceRows_(sh, rows) {
  if (rows.length === 0) return;
  var lastRow = sh.getLastRow();
  var keyToRowIndex = {};
  if (lastRow > 1) {
    var keys = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) keyToRowIndex[String(keys[i][0])] = i + 2;
  }
  var toAppend = [];
  rows.forEach(function(row) {
    var existing = keyToRowIndex[String(row[0])];
    if (existing) {
      sh.getRange(existing, 1, 1, row.length).setValues([row]);
    } else {
      toAppend.push(row);
    }
  });
  if (toAppend.length) {
    sh.getRange(sh.getLastRow() + 1, 1, toAppend.length, toAppend[0].length).setValues(toAppend);
  }
}

function formatIstTime_(iso) {
  if (!iso) return '';
  return Utilities.formatDate(new Date(iso), 'Asia/Kolkata', 'HH:mm');
}

function writeDailyAttendance_(dateStr, rows) {
  var ss = attendanceSheet_();
  var sh = getOrCreateAttendanceTab_(ss, ATTENDANCE_DAILY_TAB, ATTENDANCE_DAILY_HEADERS);
  var out = rows.map(function(r) {
    return [
      dateStr + '|' + r.key, dateStr, r.empCode, r.name, r.department,
      formatIstTime_(r.checkIn), formatIstTime_(r.checkOut),
      r.workingHrs, r.lateMins === null ? '' : r.lateMins
    ];
  });
  upsertAttendanceRows_(sh, out);
}

function writeMonthlyAttendance_(monthLabel, rows) {
  var ss = attendanceSheet_();
  var sh = getOrCreateAttendanceTab_(ss, ATTENDANCE_MONTHLY_TAB, ATTENDANCE_MONTHLY_HEADERS);
  var out = rows.map(function(r) {
    return [monthLabel + '|' + r.key, monthLabel, r.empCode, r.name, r.department, r.totalDays, r.avgHours, r.timesLate];
  });
  upsertAttendanceRows_(sh, out);
}

// ============================================================
// Email — short KPI summary + link, not a data dump. Recipients from
// ATTENDANCE_REPORT_RECIPIENTS; no-ops (logs only) if none are set.
// Failure alerts fall back to OWNER_EMAIL (defined in ALERT.gs) so a
// broken job is never silent even before recipients are configured.
// ============================================================

function sendAttendanceEmail_(subject, summaryLines) {
  var recipients = attendanceReportRecipients_();
  if (recipients.length === 0) {
    Logger.log('ℹ️ Attendance report: ATTENDANCE_REPORT_RECIPIENTS not set, skipping email. (' + subject + ')');
    return;
  }
  var sheetUrl = 'https://docs.google.com/spreadsheets/d/' + ATTENDANCE_SHEET_ID + '/edit';
  try {
    MailApp.sendEmail({
      to: recipients.join(','),
      subject: '📋 VFPL — ' + subject,
      htmlBody: '<div style="font-family:sans-serif;font-size:14px;color:#111827;">' +
                '<h2 style="margin:0 0 12px;">' + _escapeHtml_(subject) + '</h2>' +
                '<p style="white-space:pre-wrap;">' + _escapeHtml_(summaryLines.join('\n')) + '</p>' +
                '<p><a href="' + sheetUrl + '">Open the Sheet</a></p>' +
                '<p style="color:#666;font-size:12px;margin-top:16px;">— VFPL Attendance Report</p>' +
                '</div>',
      name: 'VFPL Attendance Report'
    });
    Logger.log('✅ Attendance email sent to: ' + recipients.join(','));
  } catch (e) {
    Logger.log('❌ Could not send attendance email: ' + e);
  }
}

function sendAttendanceFailureEmail_(context, err) {
  var owner = (typeof OWNER_EMAIL !== 'undefined' && OWNER_EMAIL) ? OWNER_EMAIL.split(',') : [];
  var all = attendanceReportRecipients_().concat(owner);
  var seen = {};
  var unique = all.filter(function(v) {
    if (!v || seen[v]) return false;
    seen[v] = true;
    return true;
  });
  if (unique.length === 0) {
    Logger.log('❌ Attendance report failed (' + context + '): ' + err + ' — no recipients to alert.');
    return;
  }
  try {
    MailApp.sendEmail({
      to: unique.join(','),
      subject: '🔴 VFPL Attendance Report failed — ' + context,
      body: 'The attendance report job failed.\n\nContext: ' + context + '\nError: ' + err +
            '\n\nTime: ' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MMM-yyyy HH:mm') + ' IST'
    });
  } catch (e2) {
    Logger.log('❌ Could not even send the failure alert: ' + e2);
  }
}

// ============================================================
// Daily driver, run for one date at a time.
// ============================================================

function runAttendanceDailyReport_(dateStr) {
  var dailyRows = fetchDailyAttendance_(dateStr);
  writeDailyAttendance_(dateStr, dailyRows);

  var checkedIn = dailyRows.filter(function(r) { return r.checkIn; }).length;
  var late = dailyRows.filter(function(r) { return r.lateMins !== null; }).length;
  var withHours = dailyRows.filter(function(r) { return r.workingHrs !== ''; });
  var avgHours = withHours.length
    ? Math.round((withHours.reduce(function(s, r) { return s + r.workingHrs; }, 0) / withHours.length) * 100) / 100
    : 0;

  return { total: dailyRows.length, checkedIn: checkedIn, late: late, avgHours: avgHours };
}

function runAttendanceMonthEndReport_(year, month, monthLabel) {
  var monthlyRows = fetchMonthlyAttendance_(year, month);
  writeMonthlyAttendance_(monthLabel, monthlyRows);
  return { count: monthlyRows.length };
}

// ============================================================
// Trigger: fires HOURLY (like this project's runShiftAlerts15min_),
// and only does real work inside the 07:00-07:59 IST hour, gated by
// an explicit Utilities.formatDate(..., 'Asia/Kolkata', ...) check —
// NOT by relying on the Apps Script project's own timezone setting,
// which this repo has no record of ever being set to IST. Dedup via
// Script Properties so re-firing within the same hour (or the trigger's
// own jitter) never double-runs the same IST day.
//
// 07:00 IST is safely after Shift 3's 00:00-07:00 window closes for
// "yesterday" (CLAUDE.md, "Shift 3 belongs to the previous working
// day") — that shift's late checkouts (~07:15-07:45) are covered by
// also reprocessing the day before yesterday every run.
// ============================================================

function runAttendanceReportHourlyGate_() {
  var now = new Date();
  var hourIst = Number(Utilities.formatDate(now, 'Asia/Kolkata', 'H'));
  if (hourIst !== 7) return;

  var todayIst = Utilities.formatDate(now, 'Asia/Kolkata', 'yyyy-MM-dd');
  var props = PropertiesService.getScriptProperties();

  if (props.getProperty('ATTN_DAILY_LAST_RUN') !== todayIst) {
    var y1 = new Date(now.getTime()); y1.setDate(y1.getDate() - 1);
    var y2 = new Date(now.getTime()); y2.setDate(y2.getDate() - 2);
    var d1 = Utilities.formatDate(y1, 'Asia/Kolkata', 'yyyy-MM-dd');
    var d2 = Utilities.formatDate(y2, 'Asia/Kolkata', 'yyyy-MM-dd');

    try {
      var s1 = runAttendanceDailyReport_(d1);
      runAttendanceDailyReport_(d2); // self-heal: catches late Shift-3 checkouts from the prior run
      sendAttendanceEmail_(
        'Daily attendance — ' + d1,
        [s1.checkedIn + ' of ' + s1.total + ' active employees checked in, ' + s1.late +
         ' late (beyond grace), avg ' + s1.avgHours + ' hrs worked.']
      );
      props.setProperty('ATTN_DAILY_LAST_RUN', todayIst);
      Logger.log('✅ Daily attendance report written for ' + d1 + ' (+ re-checked ' + d2 + ').');
    } catch (e) {
      sendAttendanceFailureEmail_('daily (' + d1 + ')', e);
      Logger.log('❌ Daily attendance report failed for ' + d1 + ': ' + e);
    }
  }

  var dayOfMonth = Number(Utilities.formatDate(now, 'Asia/Kolkata', 'd'));
  if (dayOfMonth === 1) {
    var prevMonthDate = new Date(now.getTime()); prevMonthDate.setDate(prevMonthDate.getDate() - 1);
    var y = Number(Utilities.formatDate(prevMonthDate, 'Asia/Kolkata', 'yyyy'));
    var m = Number(Utilities.formatDate(prevMonthDate, 'Asia/Kolkata', 'M'));
    var monthLabel = Utilities.formatDate(prevMonthDate, 'Asia/Kolkata', 'MMMM yyyy');
    var monthKey = y + '-' + (m < 10 ? '0' : '') + m;

    if (props.getProperty('ATTN_MONTHLY_LAST_RUN') !== monthKey) {
      try {
        var s2 = runAttendanceMonthEndReport_(y, m, monthLabel);
        sendAttendanceEmail_(
          'Month-end attendance — ' + monthLabel,
          [s2.count + ' employee(s) summarised for ' + monthLabel + '. See the "' + ATTENDANCE_MONTHLY_TAB + '" tab.']
        );
        props.setProperty('ATTN_MONTHLY_LAST_RUN', monthKey);
        Logger.log('✅ Monthly attendance summary written for ' + monthLabel + ': ' + s2.count + ' row(s).');
      } catch (e2) {
        sendAttendanceFailureEmail_('monthly (' + monthLabel + ')', e2);
        Logger.log('❌ Monthly attendance summary failed for ' + monthLabel + ': ' + e2);
      }
    }
  }
}

function installAttendanceReportTrigger() {
  Logger.log('Triggers before: ' + ScriptApp.getProjectTriggers().length);
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runAttendanceReportHourlyGate_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runAttendanceReportHourlyGate_').timeBased().everyHours(1).nearMinute(10).create();
  Logger.log('Triggers after: ' + ScriptApp.getProjectTriggers().length +
    ' — check this is still comfortably under Google\'s 20-per-project ceiling.');
}

// Diagnostic — run this if the trigger count ever looks off (e.g. sitting
// at Google's 20-per-project ceiling when CLAUDE.md's own record says it
// should be ~14). Lists every trigger in this Apps Script project by
// handler function and type, so it's obvious what's actually registered
// instead of guessing. Added 28 Sep 2026 after installAttendanceReportTrigger()
// reported "Triggers before: 20, after: 20" — 6 more than the documented
// total (2 from ALERT.gs's consolidated dispatchers + 11 from Code.gs + 1
// new one = 14 expected). Does not change anything — read-only.
function listAllTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  Logger.log('Total triggers: ' + triggers.length + ' / 20');
  var counts = {};
  triggers.forEach(function(t, i) {
    var handler = t.getHandlerFunction();
    var type = t.getEventType();
    counts[handler] = (counts[handler] || 0) + 1;
    Logger.log((i + 1) + '. ' + handler + ' — ' + type);
  });
  Logger.log('--- grouped by handler ---');
  Object.keys(counts).forEach(function(h) {
    Logger.log(h + ': ' + counts[h] + (counts[h] > 1 ? '  ⚠ duplicate?' : ''));
  });
}

// Cleanup for duplicate triggers of the SAME handler function. Added 28 Sep
// 2026 after listAllTriggers_() showed the project pinned at Google's
// 20-per-project ceiling, with runCacheBuilder and runAnalyticsDaily each
// registered 6 times — neither is defined anywhere in this git repo (they
// belong to the live Operations Dashboard script, which this repo has never
// had the source for), so the fix has to work generically off ScriptApp's
// own trigger list rather than patching whatever installer created them.
// Only touches CLOCK (time-based) triggers — never an installable event
// trigger like processFormSubmissions' onFormSubmit, which must never be
// silently removed.
//
// Dry-run by default: dedupeClockTriggers_() just logs what it would
// remove. Pass true to actually delete: dedupeClockTriggers_(true).
function dedupeClockTriggers_(execute) {
  var triggers = ScriptApp.getProjectTriggers();
  var seen = {};
  var toDelete = [];
  triggers.forEach(function(t) {
    if (t.getEventType() !== ScriptApp.EventType.CLOCK) return;
    var handler = t.getHandlerFunction();
    if (seen[handler]) {
      toDelete.push(t);
    } else {
      seen[handler] = true;
    }
  });

  if (toDelete.length === 0) {
    Logger.log('No duplicate clock triggers found.');
    return;
  }

  Logger.log((execute ? 'Deleting' : 'Would delete') + ' ' + toDelete.length + ' duplicate trigger(s):');
  toDelete.forEach(function(t) {
    Logger.log('  - ' + t.getHandlerFunction());
    if (execute) ScriptApp.deleteTrigger(t);
  });

  if (!execute) {
    Logger.log('DRY RUN ONLY — nothing deleted. Re-run as dedupeClockTriggers_(true) to actually remove these.');
  } else {
    Logger.log('Done. Triggers remaining: ' + ScriptApp.getProjectTriggers().length + ' / 20');
  }
}

// Manual test helper — run from the Apps Script editor for a known past
// date (e.g. testAttendanceReportForDate('2026-09-27')) before trusting
// the trigger. Does NOT send email — writes to the Sheet and logs a
// summary, so it can be compared against a direct Supabase query for
// the same date.
function testAttendanceReportForDate(dateStr) {
  var summary = runAttendanceDailyReport_(dateStr);
  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

// No-argument convenience wrapper for testAttendanceReportForDate — the
// Apps Script editor's "Run" button on a function with parameters calls it
// with none, silently passing `undefined` (this is what produced the
// "date=eq.undefined" PGRST error on the first live test run). Use THIS
// one when just clicking Run in the editor; it always tests yesterday
// (IST), a date guaranteed to have real data.
function testAttendanceReportYesterday() {
  var y = new Date(Date.now() - 24 * 60 * 60 * 1000);
  var dateStr = Utilities.formatDate(y, 'Asia/Kolkata', 'yyyy-MM-dd');
  Logger.log('Testing ' + dateStr + ' (yesterday IST)...');
  return testAttendanceReportForDate(dateStr);
}
