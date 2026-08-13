// ============================================================
// ALERT.gs — SUPERVISOR TRACKING (DYNAMIC WEEKLY MAPPING)
// ============================================================
// Purpose: Dynamic supervisor mapping by week
// ============================================================

var DASH_ID = '1GHdhrRtOhQFshsAOCK4n3GiJp-6a03k8bn0V_M04wSY';

// ── SUPABASE CREDENTIALS ──────────────────────────────────
// Fill the key in HERE, in the Apps Script editor, and you can skip the
// Script Properties screen entirely.
//
// ⚠ THE COPY OF THIS FILE IN GIT KEEPS THE KEY LINE EMPTY, DELIBERATELY, AND
// MUST STAY THAT WAY. A service_role / sb_secret_ key bypasses RLS completely
// — it can read and rewrite every employee's salary, phone number and
// attendance. Committed once, it is in the repository's history permanently,
// even if a later commit removes it. Your Apps Script project is private to
// you; a git repo is not the same kind of place.
//
// So: the live script has the key, the repo copy does not, and those two
// files differ by exactly this one line forever. That difference is correct.
//
// Script Properties still win if they are set, so you can move the key out of
// the file later without editing anything.
var SUPABASE_URL_INLINE = 'https://odfwtdpvpfzdrznvurru.supabase.co';
var SUPABASE_SERVICE_ROLE_KEY_INLINE = '';   // <-- paste the key between these quotes

// ── DEPARTMENT LIST ──────────────────────────────────────
var DEPARTMENTS = [
  'Cutting', 'Forge', 'Press', 'Machine', 'HT', 'Final',
  'Electricity', 'Oil', 'Staff Manpower', 'Contract Manpower'
];

// ── RAW TAB MAPPING ──────────────────────────────────────
var DEPT_TO_RAW_TAB = {
  'Cutting': 'RAW_CUTTING',
  'Forge': 'RAW_FORGE',
  'Press': 'RAW_PRESS',
  'Machine': 'RAW_MACHINE',
  'HT': 'RAW_HT',
  'Final': 'RAW_FINAL',
  'Electricity': 'RAW_ELECTRICITY',
  'Oil': 'RAW_OIL',
  'Staff Manpower': 'RAW_MANPOWER_STAFF',
  'Contract Manpower': 'RAW_MANPOWER_CONTRACT'
};

// ── DEPARTMENT NAME MAPPING (dashboard -> app database) ───
// The Operations Dashboard and the Forge OS employees table use different
// vocabularies for the same shops: 'HT' here is 'Heat Treatment' there,
// 'Forge' is 'Forge Shop'. Anything pushed to Supabase must be translated, or
// the app's department filter silently matches nothing.
//
// The four departments with no entry (Electricity, Oil, Staff Manpower,
// Contract Manpower) have no matching employees.department value and no forms
// in the registry — they are dashboard-only concepts and are not synced.
var DEPT_TO_DB_DEPARTMENT = {
  'Cutting': 'Cutting Shop',
  'Forge':   'Forge Shop',
  'Press':   'Press Shop',
  'Machine': 'Machine Shop',
  'HT':      'Heat Treatment',
  'Final':   'Final Shop',

  // Added 13 Aug — for FORM-SUBMISSION compliance sync only (see
  // NON_PRODUCTION_DEPTS below). Without these two, recordShiftCompliance()
  // logs Electricity/Oil rows to DATA_SUBMISSION_LOG same as any other
  // department, but syncFormSubmissionsToSupabase() silently drops them —
  // 'dept' resolves to undefined, the row fails its own `if (!dept) return`
  // guard, and the app's Forms tab never lights up their submitted/pending
  // chip even though the sheet-side compliance record is correct.
  'Electricity': 'Maintenance',
  'Oil':         'Maintenance'
};

// syncProductionToSupabase() also iterates Object.keys(DEPT_TO_DB_DEPARTMENT)
// — that is fine for the six shop departments, whose RAW tabs are all
// Date|Unit|Shift|[VF_No]|Qty. RAW_ELECTRICITY holds kWh meter readings and
// RAW_OIL holds litres consumed; neither is a parts-produced quantity, and
// summing them into production_records.qty would silently corrupt the
// production dashboard's totals. This list is what keeps them out of that
// loop while still letting them through the (differently-shaped, qty-blind)
// form-submission compliance sync above.
var NON_PRODUCTION_DEPTS = { 'Electricity': true, 'Oil': true };

// ── RESPONSIBILITY FALLBACK (13 Aug 2026) ─────────────────
// Electricity, Oil, Staff Manpower and Contract Manpower are compliance-
// tracked departments (their RAW tabs are real — RAW_ELECTRICITY,
// RAW_OIL, RAW_MANPOWER_STAFF, RAW_MANPOWER_CONTRACT all exist with real
// rows), but nobody has ever registered a supervisor under those LITERAL
// names in the weekly form — because they are not real departments, they
// are sub-responsibilities of real ones. Confirmed against the live
// registry sheet 13 Aug: electricity + oil sit under Maintenance; both
// manpower forms are listed under Security AND under HR Dept (same two
// forms, different responsible people for each).
//
// getSupervisorForCurrentWeek_ tries the literal name first — so if
// someone ever DOES register under 'Electricity' verbatim, that still
// wins — and only falls back to these when that lookup finds nothing.
// Multiple department names are tried in order; the first with an active
// registration for the current week is used.
var DEPT_RESPONSIBILITY_FALLBACK = {
  'Electricity': ['Maintenance'],
  'Oil': ['Maintenance'],
  'Staff Manpower': ['Security', 'HR'],
  'Contract Manpower': ['Security', 'HR']
};

// ── SHIFT CONFIG ──────────────────────────────────────────
var SHIFT_CONFIG_DATA = {
  'Shift 1': { start: '8:30', end: '15:30', grace: 60, deadline: '16:30', reminder: 15 },
  'Shift 2': { start: '15:30', end: '23:30', grace: 60, deadline: '00:30', reminder: 15 },
  'Shift 3': { start: '23:30', end: '08:30', grace: 60, deadline: '09:30', reminder: 15 }
};

// ── FORM LINKS ────────────────────────────────────────────
// Supervisors were being told to "upload NOW" with a literal
// "[Google Form Link]" placeholder where the link should have been.
//
// These rows come from Yash's form registry sheet
// (1M2E83q64BXzfGwZsNQ_9u2jdfzwJPrJlD8WKRKgG554), which lists every form by
// department, responsible person and frequency, with the published
// /forms/d/e/.../viewform responder links — not the /edit links a Drive file
// listing gives you. Only the Daily forms are seeded here; the
// "As & When Required" ones (gate pass, hospital, advance, leave) are not
// chased per shift.
//
// The FORM_LINKS tab is the live source and overrides this seed, so links can
// be corrected in the sheet without editing the script.
var FORM_LINKS_TAB = 'FORM_LINKS';

// [department, form name, frequency, responsible person, url, send in reminder]
var DEPT_FORM_SEED = [
  ['Cutting', 'Cutting PMS', 'Daily', 'Sudeep Singh', 'https://docs.google.com/forms/d/e/1FAIpQLSf0yqwPXjd8kWwqgpgcDRmYq7Z8PeOV0ifY8lmZycC_MDibjw/viewform', 'YES'],
  ['Cutting', 'Cutting Daily check sheet', 'Daily', 'Sudeep Singh', 'https://docs.google.com/forms/d/e/1FAIpQLSf9m5VVFlVpEaoRYMPZ1MEOnZyaWnkdnIyVYG2yDj736jy-Bg/viewform', 'YES'],
  ['Cutting', 'Cutting Planning', 'Daily', 'Sudeep Singh', 'https://docs.google.com/forms/d/e/1FAIpQLSe9vMmKukDFGNKptsJMOu4ICtSgds4adrhw1Czcjb1XSodSHg/viewform', 'YES'],
  ['Cutting', 'Overtime Form', 'Daily', 'Sudeep Singh', 'https://docs.google.com/forms/d/e/1FAIpQLSf9zPvnTSMDE8AT_vrs9W8y2efwXxTbpJ2FlrRJl2TLoGKGXw/viewform', 'NO'],
  ['Forge', 'Forge Daily check sheet', 'Daily', 'Sudeep Singh Laxman Yadav Subhash Sitaram Palve Saroj Avdesh Singh Shaikh Irfan', 'https://docs.google.com/forms/d/e/1FAIpQLSfEzztMshze903rfc6vobPK0AZudZ9MfM-Mahsuzzj3ie1tEw/viewform', 'YES'],
  ['Forge', 'Forge PMS', 'Daily', 'Sudeep Singh Laxman Yadav Subhash Sitaram Palve Saroj Avdesh Singh Shaikh Irfan', 'https://docs.google.com/forms/d/e/1FAIpQLSeXwEc4jMUmwTySfvFrm4bOqbB01gW5cS_yeiRe6VmlWKDntQ/viewform', 'YES'],
  ['Forge', 'Forge Shop Planning', 'Daily', 'Sudeep Singh Laxman Yadav Subhash Sitaram Palve Saroj Avdesh Singh Shaikh Irfan', 'https://docs.google.com/forms/d/e/1FAIpQLSc1cbhgqSJVuLXFJ6xCr5pkfN0UBhok8mpi6sIcA1AY6BsJSQ/viewform', 'YES'],
  ['Press', 'Press Daily check sheet', 'Daily', 'Dinkar Landge Shyambabu Radheshyam Yadav Chandan Milind Sonapasare Manbodh Sambhu Sah Shaikh Zaker Abdul Quayyum Vaibhav Mali', 'https://docs.google.com/forms/d/e/1FAIpQLSc0QOVHipibWe2B4pENewKxJt7O36xe4eRDMxNqr_UYf7Ei2A/viewform', 'YES'],
  ['Press', 'Press PMS', 'Daily', 'Dinkar Landge Shyambabu Radheshyam Yadav Chandan Milind Sonapasare Manbodh Sambhu Sah Shaikh Zaker Abdul Quayyum Vaibhav Mali', 'https://docs.google.com/forms/d/e/1FAIpQLSerCkOEK8Y9olorgA4OtusaaBXxA9G7RgHcq9IXJmCabcfRMg/viewform', 'YES'],
  ['Press', 'Press Shop Planning', 'Daily', 'Dinkar Landge Shyambabu Radheshyam Yadav Chandan Milind Sonapasare Manbodh Sambhu Sah Shaikh Zaker Abdul Quayyum Vaibhav Mali', 'https://docs.google.com/forms/d/e/1FAIpQLSe9fhnfuCG_DjAPij5jk0k5K3ix9OCs7bHTxAX5eQtCK0Tgsw/viewform', 'YES'],
  ['Machine', 'Machine Daily check sheet', 'Daily', 'Haribhau Shamrao Datar. Pravin Pundalik Sonavane Santosh Vishwanath Sawai Bhupendra Kashinath Bharude Shaikh Wajid shaikh Shabbir Ramesh Narayan Gote Anna Pralhad Deshmukh Bhaiyyasaheb Sambhaji Patil Vitthal Uddhav Tekale', 'https://docs.google.com/forms/d/e/1FAIpQLSeBWFirZX18C1Sqz4hiTzLnPSDqXGEbYLH5LWmo3Gy6Rx0kQA/viewform', 'YES'],
  ['Machine', 'Machine PMS', 'Daily', 'Haribhau Shamrao Datar. Pravin Pundalik Sonavane Santosh Vishwanath Sawai Bhupendra Kashinath Bharude Shaikh Wajid shaikh Shabbir Ramesh Narayan Gote Anna Pralhad Deshmukh Bhaiyyasaheb Sambhaji Patil Vitthal Uddhav Tekale', 'https://docs.google.com/forms/d/e/1FAIpQLSdzriZ1FIXAdrt247msSFabUSnLn5ctdBkyl_4NyRL_b_UBSg/viewform', 'YES'],
  ['Machine', 'Machine Shop Planning', 'Daily', 'Haribhau Shamrao Datar. Pravin Pundalik Sonavane Santosh Vishwanath Sawai Bhupendra Kashinath Bharude Shaikh Wajid shaikh Shabbir Ramesh Narayan Gote Anna Pralhad Deshmukh Bhaiyyasaheb Sambhaji Patil Vitthal Uddhav Tekale', 'https://docs.google.com/forms/d/e/1FAIpQLSfkmTouMWhxG-7SbnwcV4wbQJrPJOxD9cdnvHWrdh3fZIIc4Q/viewform', 'YES'],
  ['Machine', 'VFPL Sales Dispatch Actual Form', 'Daily', 'Haribhau Shamrao Datar. Pravin Pundalik Sonavane Santosh Vishwanath Sawai Bhupendra Kashinath Bharude Shaikh Wajid shaikh Shabbir Ramesh Narayan Gote Anna Pralhad Deshmukh Bhaiyyasaheb Sambhaji Patil Vitthal Uddhav Tekale', 'https://docs.google.com/forms/d/e/1FAIpQLSerDrMI7SlhB5HEHyUDuxfPJrCuvpwkyl9pw2lOYqwOaUqteg/viewform', 'NO'],
  ['Machine', 'Dispatch Plan-Machine Shop', 'Daily', 'Haribhau Shamrao Datar. Pravin Pundalik Sonavane Santosh Vishwanath Sawai Bhupendra Kashinath Bharude Shaikh Wajid shaikh Shabbir Ramesh Narayan Gote Anna Pralhad Deshmukh Bhaiyyasaheb Sambhaji Patil Vitthal Uddhav Tekale', 'https://docs.google.com/forms/d/e/1FAIpQLSdcZw9VVStYMhy17zHu5hnB-mC9sn6Pq0V5SkIZCfV1uzTPUA/viewform', 'NO'],
  ['HT', 'HT Daily check sheet', 'Daily', 'Balasaheb Shivaji Todmal Ramnath Babasaheb Gadekar', 'https://docs.google.com/forms/d/e/1FAIpQLSc5M5SVkihS7FIZCLF-8Me5wGseyQIU88x0p1Zs1aB5ZThrRw/viewform', 'YES'],
  ['HT', 'HT PMS', 'Daily', 'Balasaheb Shivaji Todmal Ramnath Babasaheb Gadekar', 'https://docs.google.com/forms/d/e/1FAIpQLSdVaiBzMydIQxI0h77R78_aPyFzuLjIFFpUY2T1qTQrfwl8Jg/viewform', 'YES'],
  ['HT', 'HT Shop Planning', 'Daily', 'Balasaheb Shivaji Todmal Ramnath Babasaheb Gadekar', 'https://docs.google.com/forms/d/e/1FAIpQLSeeuJRiGEtT3wst31Qs5f9BX3NpLXLW5StmwpYTJldAXayaSg/viewform', 'YES'],
  ['Final', 'Final Daily check sheet', 'Daily', 'Jakir Munshi Chaudhari Subhash Shivanand Thorat Ashok Kumar', 'https://docs.google.com/forms/d/e/1FAIpQLScnN9MwSqunjomGCTo73GuIBHBw1xHTj4j8u_49PZsAZzM1hQ/viewform', 'YES'],
  ['Final', 'Final PMS', 'Daily', 'Jakir Munshi Chaudhari Subhash Shivanand Thorat Ashok Kumar', 'https://docs.google.com/forms/d/e/1FAIpQLSdyxVMje-Ke51r6AnNbh81mFgbDzjJGQbjkfcpFHk4S1BbMYA/viewform', 'YES'],
  ['Final', 'VFPL Sales Dispatch Actual Form', 'Daily', 'Jakir Munshi Chaudhari Subhash Shivanand Thorat Ashok Kumar', 'https://docs.google.com/forms/d/e/1FAIpQLSerDrMI7SlhB5HEHyUDuxfPJrCuvpwkyl9pw2lOYqwOaUqteg/viewform', 'NO'],
  ['Final', 'Final Shop Planning', 'Daily', 'Jakir Munshi Chaudhari Subhash Shivanand Thorat Ashok Kumar', 'https://docs.google.com/forms/d/e/1FAIpQLSff5rk2BDx-2ky64_rrVUXlrxdgqI4mvHL-Kcf5eBhHa8nA2w/viewform', 'YES'],
  ['Final', '57F4 Inward Form', 'Daily', 'Jakir Munshi Chaudhari Subhash Shivanand Thorat Ashok Kumar', 'https://docs.google.com/forms/d/e/1FAIpQLSdHaCr9PfjKFv_nRIQGy_0uBo6SmoXfJe06ZNWW5-zBONkA-w/viewform', 'NO'],
  ['Final', '57F4 Outward Form', 'Daily', 'Jakir Munshi Chaudhari Subhash Shivanand Thorat Ashok Kumar', 'https://docs.google.com/forms/d/e/1FAIpQLSdfReEVbGGGNC6CwIPDq53syvvkomXj2gfIWNBQehjozUD1DA/viewform', 'NO'],
  // Electricity/Oil verified 13 Aug against the live registry sheet — both
  // are genuinely Maintenance-department forms (see DEPT_RESPONSIBILITY_FALLBACK
  // below), reused here under their own literal DEPARTMENTS key so the
  // Telegram nudge for 'Electricity'/'Oil' compliance carries a real link
  // instead of the old blank/NO placeholder.
  ['Electricity', 'VFPL Electricity Consumable Form', 'Daily',
   'Atul Bhata Patil, Dharmendra Prabhu Mahto, Shaikh Majeed, Devendrakumar Jagdish Singh, Nanasaheb Dinkar Shinde, Shivaji Suresh Jaypure, Sunil Ramakant Saha, Vijay Rangnath Sonawane, Sandip Tryambak Landage, Manoj Anantrao Wagh',
   'https://docs.google.com/forms/d/e/1FAIpQLScB6QrOCHmWeAKzZP76eWPISlt_tnr5z7aBROTHK614gfd31A/viewform', 'YES'],
  ['Electricity', 'VFL 24Hrs Electricity Consumable Form', 'Daily',
   'Atul Bhata Patil, Dharmendra Prabhu Mahto, Shaikh Majeed, Devendrakumar Jagdish Singh, Nanasaheb Dinkar Shinde, Shivaji Suresh Jaypure, Sunil Ramakant Saha, Vijay Rangnath Sonawane, Sandip Tryambak Landage, Manoj Anantrao Wagh',
   'https://docs.google.com/forms/d/e/1FAIpQLScr2JYBV9yFN5WZj99dhc2mTV--1_-Y8pIeMT8Bmf6t9qR7RQ/viewform', 'YES'],
  ['Oil', 'VFL Oil Consumable', 'Daily',
   'Atul Bhata Patil, Dharmendra Prabhu Mahto, Shaikh Majeed, Devendrakumar Jagdish Singh, Nanasaheb Dinkar Shinde, Shivaji Suresh Jaypure, Sunil Ramakant Saha, Vijay Rangnath Sonawane, Sandip Tryambak Landage, Manoj Anantrao Wagh',
   'https://docs.google.com/forms/d/e/1FAIpQLSfyrYgWEhyBjy8GxwvaaDOk5Uc5doDYZ0SeSE2uUoU9ujNUkA/viewform', 'YES'],
  // Both marked "As & When Required" by the registry itself, not Daily — kept
  // NO (not chased on the shift timer) to match, same as the app side.
  ['Staff Manpower', 'Daily Manpower Form', 'As & When Required',
   'Shrawan Rewant Singh (Security) / Milind Ambadas Barhate, Pallavi Vishnu Khade, Mayuri Sardar Rathod (HR)',
   'https://docs.google.com/forms/d/e/1FAIpQLSflyxcQjVEdv2OXgflXhKVH1VWhBUEMhC7KhUUUtdb4pHQNyw/viewform', 'NO'],
  ['Contract Manpower', 'Daily Contractual Manpower Form', 'As & When Required',
   'Shrawan Rewant Singh (Security) / Milind Ambadas Barhate, Pallavi Vishnu Khade, Mayuri Sardar Rathod (HR)',
   'https://docs.google.com/forms/d/e/1FAIpQLSfecNumIXRV7Xej_n-4N7k0K702I9WHjiT6F_naEqT5JnFS0g/viewform', 'NO']
];

// ── SUBMISSION TRACKING (NOT SCORING) ─────────────────────
// Yash, 12 Aug: the dashboard shift timings are NOT to be used for scoring —
// they are for driving notifications in the app. The points scheme that used
// to live here (100 on time, -10 per started hour late) has been removed.
//
// What stays is the factual record: for each (date, department, shift),
// whether the data arrived on time, arrived late, or never arrived, and by
// how many minutes. No points, no percentage, no ranking. That record is what
// tells the app which forms are still outstanding; turning it into a number
// against a person's name is a separate decision nobody has taken.
//
// To restore scoring, see commit eb70e8f — scoreForDelay_(), the Points
// column and performanceBand_() are intact there.

// A (department, shift, date) with still no data this long after its deadline
// is closed out as MISSING and scored zero, so the day can be totalled.
var MISSING_CUTOFF_HOURS = 12;

// How many days back each compliance sweep re-checks. Covers a shift whose
// deadline falls on the following calendar day, plus a day of slack for
// sweeps missed while the script was failing or quota-limited.
var COMPLIANCE_LOOKBACK_DAYS = 2;

// ============================================================
// SECTION 1: SETUP — Run Once to Create/Update Tabs
// ============================================================

function setupDynamicSupervisorTabs() {
  var ss = SpreadsheetApp.openById(DASH_ID);
  
  createDynamicSupervisorMap_(ss);
  createShiftConfigTab_(ss);
  createFormLinksTab_(ss);
  createDataSubmissionLogTab_(ss);
  createWeeklyPerformanceTab_(ss);
  createFormResponsesTab_(ss);
  createEscalationLogTab_(ss);
  
  Logger.log('✅ All dynamic supervisor tabs created/updated!');
}

function createDynamicSupervisorMap_(ss) {
  var sh = ss.getSheetByName('SUPERVISOR_MAP');
  if (!sh) sh = ss.insertSheet('SUPERVISOR_MAP');
  sh.clearContents();
  sh.clearFormats();
  
  var headers = [
    'Department',
    'Supervisor Name',
    'Phone',
    'Telegram Chat ID',
    'Week Start (Monday)',
    'Week End (Sunday)',
    'Active'
  ];
  
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1565C0')
    .setFontColor('#FFFFFF');
  
  // ─── SAMPLE DATA WITH PLACEHOLDERS ───
  var sampleData = [
    ['Cutting', '______', '______', '______', '04-Aug-2026', '10-Aug-2026', 'YES'],
    ['Cutting', '______', '______', '______', '11-Aug-2026', '17-Aug-2026', 'YES'],
    ['Forge', '______', '______', '______', '04-Aug-2026', '10-Aug-2026', 'YES'],
    ['Forge', '______', '______', '______', '11-Aug-2026', '17-Aug-2026', 'YES'],
    ['Press', '______', '______', '______', '04-Aug-2026', '10-Aug-2026', 'YES'],
    ['Press', '______', '______', '______', '11-Aug-2026', '17-Aug-2026', 'YES'],
    ['Machine', '______', '______', '______', '04-Aug-2026', '10-Aug-2026', 'YES'],
    ['Machine', '______', '______', '______', '11-Aug-2026', '17-Aug-2026', 'YES'],
    ['HT', '______', '______', '______', '04-Aug-2026', '10-Aug-2026', 'YES'],
    ['HT', '______', '______', '______', '11-Aug-2026', '17-Aug-2026', 'YES'],
    ['Final', '______', '______', '______', '04-Aug-2026', '10-Aug-2026', 'YES'],
    ['Final', '______', '______', '______', '11-Aug-2026', '17-Aug-2026', 'YES'],
    ['Electricity', '______', '______', '______', '04-Aug-2026', '10-Aug-2026', 'YES'],
    ['Oil', '______', '______', '______', '04-Aug-2026', '10-Aug-2026', 'YES'],
    ['Staff Manpower', '______', '______', '______', '04-Aug-2026', '10-Aug-2026', 'YES'],
    ['Contract Manpower', '______', '______', '______', '04-Aug-2026', '10-Aug-2026', 'YES']
  ];
  
  if (sampleData.length > 0) {
    sh.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);
  }
  
  // Data validation for Department column
  var deptRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(DEPARTMENTS)
    .build();
  sh.getRange(2, 1, sampleData.length, 1).setDataValidation(deptRule);
  
  // Data validation for Active column
  var activeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['YES', 'NO'])
    .build();
  sh.getRange(2, 7, sampleData.length, 1).setDataValidation(activeRule);
  
  sh.autoResizeColumns(1, headers.length);
  
  sh.getRange(1, 1).setNote(
    '📋 DYNAMIC SUPERVISOR MAP\n' +
    '═══════════════════════════════════════════\n\n' +
    '📌 HOW IT WORKS:\n' +
    '  • Each row = one supervisor for one department\n' +
    '  • Multiple rows per department = multiple supervisors\n' +
    '  • Script picks the supervisor for the current week\n\n' +
    '📌 FIELDS:\n' +
    '  • Department: Dropdown (select from list)\n' +
    '  • Supervisor Name: Full name\n' +
    '  • Phone: 10-digit number\n' +
    '  • Telegram Chat ID: (Optional) For individual alerts\n' +
    '  • Week Start: First day supervisor is assigned (Monday)\n' +
    '  • Week End: Last day supervisor is assigned (Sunday)\n' +
    '  • Active: YES/NO (set to NO to remove without deleting)\n\n' +
    '📌 EXAMPLE:\n' +
    '  Cutting | Amit Singh | 9876543210 | 123456 | 04-Aug-2026 | 10-Aug-2026 | YES\n' +
    '  Cutting | Sanjay Patel | 9876543211 | 654321 | 11-Aug-2026 | 17-Aug-2026 | YES\n\n' +
    '🔗 DASHBOARD: ' + ScriptApp.getService().getUrl()
  );
  
  Logger.log('  ✅ Dynamic SUPERVISOR_MAP created with ' + sampleData.length + ' rows');
}

function createShiftConfigTab_(ss) {
  var sh = ss.getSheetByName('SHIFT_CONFIG');
  if (!sh) sh = ss.insertSheet('SHIFT_CONFIG');
  sh.clearContents();
  sh.clearFormats();
  
  var headers = ['Shift', 'Start', 'End', 'Grace (mins)', 'Deadline', 'Reminder (mins before)'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1565C0')
    .setFontColor('#FFFFFF');
  
  var data = [
    ['Shift 1', '8:30', '15:30', 60, '16:30', 15],
    ['Shift 2', '15:30', '23:30', 60, '00:30', 15],
    ['Shift 3', '23:30', '08:30', 60, '09:30', 15]
  ];
  
  if (data.length > 0) {
    sh.getRange(2, 1, data.length, headers.length).setValues(data);
  }
  
  sh.autoResizeColumns(1, headers.length);
  Logger.log('  ✅ SHIFT_CONFIG created');
}

function createDataSubmissionLogTab_(ss) {
  var sh = ss.getSheetByName('DATA_SUBMISSION_LOG');
  if (!sh) sh = ss.insertSheet('DATA_SUBMISSION_LOG');
  sh.clearContents();
  sh.clearFormats();
  
  var headers = ['Date', 'Department', 'Shift', 'Supervisor', 'Entry Time', 'Status', 'Delay (mins)'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1565C0')
    .setFontColor('#FFFFFF');
  
  sh.autoResizeColumns(1, headers.length);
  Logger.log('  ✅ DATA_SUBMISSION_LOG created');
}

function createWeeklyPerformanceTab_(ss) {
  var sh = ss.getSheetByName('WEEKLY_PERFORMANCE');
  if (!sh) sh = ss.insertSheet('WEEKLY_PERFORMANCE');
  sh.clearContents();
  sh.clearFormats();
  
  var headers = ['Supervisor', 'Department', 'Week', 'Total', 'On Time', 'Late', 'Missing'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1565C0')
    .setFontColor('#FFFFFF');
  
  sh.autoResizeColumns(1, headers.length);
  Logger.log('  ✅ WEEKLY_PERFORMANCE created');
}

function createFormResponsesTab_(ss) {
  var sh = ss.getSheetByName('FORM_RESPONSES');
  if (!sh) sh = ss.insertSheet('FORM_RESPONSES');
  sh.clearContents();
  sh.clearFormats();
  
  var headers = [
    'Timestamp',
    'Department',
    'Supervisor Name',
    'Phone',
    'Telegram Chat ID',
    'Week Start (Monday)',
    'Week End (Sunday)',
    'Status'
  ];
  
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1565C0')
    .setFontColor('#FFFFFF');
  
  sh.autoResizeColumns(1, headers.length);
  
  sh.getRange(1, 1).setNote(
    '📋 FORM_RESPONSES — Supervisor Data\n' +
    'This tab receives data from the Google Form.\n' +
    'Script auto-processes new submissions and updates SUPERVISOR_MAP.'
  );
  
  Logger.log('  ✅ FORM_RESPONSES created');
}

function createEscalationLogTab_(ss) {
  var sh = ss.getSheetByName('ESCALATION_LOG');
  if (!sh) sh = ss.insertSheet('ESCALATION_LOG');
  sh.clearContents();
  sh.clearFormats();
  
  var headers = ['Date', 'Time', 'Department', 'Shift', 'Supervisor', 'Escalation Level', 'Action Taken'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold')
    .setBackground('#B71C1C')
    .setFontColor('#FFFFFF');
  
  sh.autoResizeColumns(1, headers.length);
  Logger.log('  ✅ ESCALATION_LOG created');
}

// ============================================================
// SECTION 2: DYNAMIC SUPERVISOR LOOKUP (YOUR NEW FORMAT)
// ============================================================

/**
 * Get supervisor for a department based on current week
 */
function getSupervisorForCurrentWeek_(dept) {
  var direct = lookupSupervisorForWeek_(dept);
  if (direct) return direct;

  var fallbacks = DEPT_RESPONSIBILITY_FALLBACK[dept];
  if (fallbacks) {
    for (var f = 0; f < fallbacks.length; f++) {
      var viaFallback = lookupSupervisorForWeek_(fallbacks[f]);
      if (viaFallback) return viaFallback;
    }
  }

  return { name: 'Unknown', phone: '', chatId: '' };
}

/** The actual SUPERVISOR_MAP scan, extracted so getSupervisorForCurrentWeek_
 * can try the literal department name and then its real-department fallback
 * without duplicating this loop. Returns null (not the 'Unknown' object) on
 * no match, so the caller can tell "found nothing" apart from "found Unknown"
 * and keep trying fallbacks. */
function lookupSupervisorForWeek_(dept) {
  var ss = SpreadsheetApp.openById(DASH_ID);
  var sh = ss.getSheetByName('SUPERVISOR_MAP');
  if (!sh) return null;

  var data = sh.getDataRange().getValues();
  var today = new Date();
  var todayStr = Utilities.formatDate(today, 'Asia/Kolkata', 'yyyy-MM-dd');

  for (var i = 1; i < data.length; i++) {
    var rowDept = (data[i][0] || '').toString().trim();
    if (rowDept !== dept) continue;

    var weekStart = data[i][4];
    var weekEnd = data[i][5];
    var active = (data[i][6] || '').toString().trim().toUpperCase();

    if (active !== 'YES') continue;
    if (!weekStart || !weekEnd) continue;

    var startStr = Utilities.formatDate(new Date(weekStart), 'Asia/Kolkata', 'yyyy-MM-dd');
    var endStr = Utilities.formatDate(new Date(weekEnd), 'Asia/Kolkata', 'yyyy-MM-dd');

    if (todayStr >= startStr && todayStr <= endStr) {
      return {
        name: data[i][1] || 'Unknown',
        phone: data[i][2] || '',
        chatId: data[i][3] || '',
        weekStart: startStr,
        weekEnd: endStr
      };
    }
  }

  return null;
}

/**
 * Get ALL supervisors for a department (for DME reference)
 */
function getAllSupervisorsForDepartment_(dept) {
  var ss = SpreadsheetApp.openById(DASH_ID);
  var sh = ss.getSheetByName('SUPERVISOR_MAP');
  if (!sh) return [];
  
  var data = sh.getDataRange().getValues();
  var supervisors = [];
  
  for (var i = 1; i < data.length; i++) {
    var rowDept = (data[i][0] || '').toString().trim();
    if (rowDept !== dept) continue;
    
    var active = (data[i][6] || '').toString().trim().toUpperCase();
    if (active !== 'YES') continue;
    
    supervisors.push({
      name: data[i][1] || 'Unknown',
      phone: data[i][2] || '',
      chatId: data[i][3] || '',
      weekStart: data[i][4] || '',
      weekEnd: data[i][5] || ''
    });
  }
  
  return supervisors;
}

// ── Alias for backward compatibility ──
function getSupervisorInfo_(dept, shift) {
  return getSupervisorForCurrentWeek_(dept);
}

// ============================================================
// SECTION 3: PROCESS FORM RESPONSES
// ============================================================

function processSupervisorFormResponse() {
  var ss = SpreadsheetApp.openById(DASH_ID);
  
  var formSh = ss.getSheetByName('FORM_RESPONSES');
  if (!formSh) {
    Logger.log('❌ FORM_RESPONSES tab not found.');
    return;
  }
  
  var mapSh = ss.getSheetByName('SUPERVISOR_MAP');
  if (!mapSh) {
    Logger.log('❌ SUPERVISOR_MAP tab not found.');
    return;
  }
  
  var lastRow = formSh.getLastRow();
  if (lastRow < 2) {
    Logger.log('ℹ️ No form responses to process.');
    return;
  }
  
  var statusCheck = formSh.getRange(lastRow, 8).getValue();
  if (statusCheck === 'PROCESSED') {
    Logger.log('ℹ️ Response already processed.');
    return;
  }
  
  var response = formSh.getRange(lastRow, 1, 1, formSh.getLastColumn()).getValues()[0];
  
  var department = (response[1] || '').toString().trim();
  var supervisor = (response[2] || '').toString().trim();
  var phone = (response[3] || '').toString().trim();
  var chatId = (response[4] || '').toString().trim();
  var weekStart = response[5];
  var weekEnd = response[6];
  
  if (!department || !supervisor) {
    Logger.log('❌ Missing department or supervisor name.');
    return;
  }
  
  var startStr = Utilities.formatDate(new Date(weekStart), 'Asia/Kolkata', 'dd-MMM-yyyy');
  var endStr = Utilities.formatDate(new Date(weekEnd), 'Asia/Kolkata', 'dd-MMM-yyyy');
  
  mapSh.appendRow([
    department,
    supervisor,
    phone,
    chatId,
    startStr,
    endStr,
    'YES'
  ]);
  
  formSh.getRange(lastRow, 8).setValue('PROCESSED');
  formSh.getRange(lastRow, 8).setBackground('#C8E6C9');
  
  Logger.log('✅ Supervisor added: ' + supervisor + ' (' + department + ') for week ' + startStr + ' to ' + endStr);
  
  sendTelegramAlert('✅ Supervisor added: ' + supervisor + ' for ' + department + ' (' + startStr + ' to ' + endStr + ')');
}

// NOTE: an earlier definition of setupFormTrigger() lived here, wiring an
// onFormSubmit trigger to processSupervisorFormResponse(). It was shadowed by
// the second definition further down this file — Apps Script keeps the last
// definition of a duplicated name — so it never ran and is removed. The live
// one targets processFormSubmissions(); processSupervisorFormResponse() is now
// unreferenced and kept only as a fallback.

// ============================================================
// SECTION 4: SHIFT DETECTION
// ============================================================

function getShiftToCheck_() {
  var now = new Date();
  var hours = now.getHours();
  var minutes = now.getMinutes();
  var timeMinutes = hours * 60 + minutes;
  
  var shift1Start = 8 * 60 + 30;
  var shift1End = 15 * 60 + 30;
  var shift2Start = 15 * 60 + 30;
  var shift2End = 23 * 60 + 30;
  var shift3Start = 23 * 60 + 30;
  var shift3End = 8 * 60 + 30;
  
  if (timeMinutes >= shift1Start && timeMinutes < shift1End) {
    return { shift: 'Shift 1', deadline: '16:30' };
  } else if (timeMinutes >= shift2Start && timeMinutes < shift2End) {
    return { shift: 'Shift 2', deadline: '00:30' };
  } else if (timeMinutes >= shift3Start || timeMinutes < shift3End) {
    return { shift: 'Shift 3', deadline: '09:30' };
  }
  return null;
}

/**
 * Normalise whatever a RAW tab's third column holds into a shift name.
 *
 * The RAW tabs do not agree on what that column means:
 *   HT        → 'First Shift' / 'Second Shift' / 'Third Shift'
 *   Manpower  → '1st Staff' / '2nd Staff' / '3rd Staff' / 'General Staff'
 *   Final     → 'General Shift'
 *   Cutting   → a person's name ('B.S. Todmal'), i.e. who filled the form
 *
 * Returns 'Shift 1'/'Shift 2'/'Shift 3' when the value genuinely identifies a
 * shift, and null when it does not — null means "this tab does not separate
 * shifts", which the caller treats as: any row for that date counts.
 */
function normaliseShift_(value) {
  var v = (value || '').toString().toLowerCase();
  if (!v) return null;
  if (/\bfirst\b|\b1st\b|\bshift\s*1\b|^s1$/.test(v))  return 'Shift 1';
  if (/\bsecond\b|\b2nd\b|\bshift\s*2\b|^s2$/.test(v)) return 'Shift 2';
  if (/\bthird\b|\b3rd\b|\bshift\s*3\b|^s3$/.test(v))  return 'Shift 3';
  return null;
}

/**
 * Has this department submitted data for this shift on this date?
 *
 * ⚠ FIXED 12 Aug 2026. The previous implementation parsed the RAW tab's first
 * column as a timestamp and required `dt.getHours() >= 8 / 15 / 23`. Those
 * columns hold a DATE ONLY ('4/1/2026'), so getHours() is always 0 and the
 * test could never pass for any shift. The function therefore returned false
 * for every department on every sweep, and ESCALATION_LOG shows exactly that:
 * 29 of 37 sweeps between 5 and 12 Aug escalated all ten departments at once,
 * the rest being the same sweep split over a minute boundary. Every reminder,
 * DME alert and escalation sent so far has been a false positive, which is
 * also why the supervisor column in that log is blank.
 *
 * Matching is now on the date plus the (unreliable) shift column, via
 * normaliseShift_.
 */
function hasDataForShift_(dept, shift, date) {
  var rawTab = DEPT_TO_RAW_TAB[dept];
  if (!rawTab) return false;
  
  var ss = SpreadsheetApp.openById(DASH_ID);
  var sh = ss.getSheetByName(rawTab);
  if (!sh || sh.getLastRow() < 2) return false;
  
  var data = sh.getDataRange().getValues();
  var dateStr = Utilities.formatDate(date, 'Asia/Kolkata', 'yyyy-MM-dd');
  
  for (var i = 1; i < data.length; i++) {
    var d = data[i][0];
    if (!d) continue;
    var dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) continue;
    if (Utilities.formatDate(dt, 'Asia/Kolkata', 'yyyy-MM-dd') !== dateStr) continue;
    
    var rowShift = normaliseShift_(data[i][2]);
    // null = this tab does not distinguish shifts, so a row for the date is
    // the only evidence available and counts for the shift being checked.
    if (rowShift === null || rowShift === shift) return true;
  }
  return false;
}

function getMissingDepartments_(shift, date) {
  var missing = [];
  
  DEPARTMENTS.forEach(function(dept) {
    var hasData = hasDataForShift_(dept, shift, date);
    if (!hasData) {
      var supervisor = getSupervisorForCurrentWeek_(dept);
      missing.push({
        department: dept,
        supervisor: supervisor.name,
        phone: supervisor.phone,
        chatId: supervisor.chatId
      });
    }
  });
  
  return missing;
}

function buildMissingListText_(missing) {
  if (missing.length === 0) return '✅ All departments have submitted data.';
  
  var lines = [];
  missing.forEach(function(m) {
    var phoneText = m.phone ? ' | 📞 ' + m.phone : '';
    lines.push('  • ' + m.department + ' — 👤 ' + m.supervisor + phoneText);
    // The DME chases these by hand; give them the form to forward rather than
    // making them hunt for it per department.
    getFormsForDept_(m.department).forEach(function(f) {
      lines.push('    🔗 ' + f.name + ': ' + f.url);
    });
  });
  return lines.join('\n');
}

function sendTelegramToChatId(chatId, message) {
  if (!chatId || chatId === '') return;
  
  var token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) {
    Logger.log('❌ TELEGRAM_BOT_TOKEN not set');
    return;
  }
  
  var url = 'https://api.telegram.org/bot' + token + '/sendMessage';
  var payload = {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML'
  };
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    var response = UrlFetchApp.fetch(url, options);
    Logger.log('✅ Telegram sent to ' + chatId);
  } catch(e) {
    Logger.log('❌ Telegram send failed to ' + chatId + ': ' + e);
  }
}

/**
 * ⚠ ADDED 13 Aug 2026 — THIS FUNCTION DID NOT EXIST. It was called from seven
 * places (sendGentleReminder's no-chat-id fallback, sendDMEDeadlineAlert,
 * sendFollowUpAlert, sendDailySummary, and two supervisor-registration
 * confirmations) and was never defined anywhere in this file. Every one of
 * those calls threw ReferenceError: sendTelegramAlert is not defined.
 *
 * The blast radius was worse than "that one alert never sent." Apps Script
 * does not catch an exception thrown inside a forEach callback — it kills the
 * WHOLE function invocation. So in sendGentleReminder(), the moment the loop
 * reached one department whose supervisor had no chat ID (which, before
 * today, was every department — Telegram onboarding did not exist), the
 * throw stopped every department AFTER it in that same run from being
 * notified too, even ones with a perfectly good, already-registered chat ID.
 * sendDMEDeadlineAlert/sendFollowUpAlert/sendDailySummary called it
 * unconditionally, so those three have never delivered a single message,
 * ever, to anyone.
 *
 * These three functions were already writing PLANT-WIDE reports — every
 * missing department in one message — not a single supervisor's nudge. That
 * is exactly "an entire report," so rather than build a new report format,
 * this makes that existing content actually arrive, addressed to the plant
 * owner. Individual per-department reminders are unaffected: sendGentleReminder
 * already sends those straight to each supervisor's own chatId when one is on
 * file — this function is only ever the plant-wide reports, or the fallback
 * when a specific supervisor has no chat ID yet.
 */
function sendTelegramAlert(message) {
  var ownerChatId = PropertiesService.getScriptProperties().getProperty('OWNER_TELEGRAM_CHAT_ID');
  if (!ownerChatId) {
    Logger.log('⚠️ OWNER_TELEGRAM_CHAT_ID not set — plant-wide alert not delivered. Message the bot with the owner\'s name to register it.');
    return;
  }
  sendTelegramToChatId(ownerChatId, message);
}

function getShiftTiming_(shift) {
  var config = SHIFT_CONFIG_DATA[shift];
  return config ? config.start + ' – ' + config.end : 'Unknown';
}

function getShiftDeadline_(shift) {
  var config = SHIFT_CONFIG_DATA[shift];
  return config ? config.deadline : 'Unknown';
}

function logEscalation_(dept, shift, supervisor, level) {
  var ss = SpreadsheetApp.openById(DASH_ID);
  var sh = ss.getSheetByName('ESCALATION_LOG');
  if (!sh) return;
  
  var now = new Date();
  sh.appendRow([
    Utilities.formatDate(now, 'Asia/Kolkata', 'yyyy-MM-dd'),
    Utilities.formatDate(now, 'Asia/Kolkata', 'HH:mm'),
    dept,
    shift,
    supervisor,
    level,
    'Alert sent'
  ]);
}

function wasEscalatedToday_(dept, shift) {
  var ss = SpreadsheetApp.openById(DASH_ID);
  var sh = ss.getSheetByName('ESCALATION_LOG');
  if (!sh || sh.getLastRow() < 2) return false;
  
  var data = sh.getDataRange().getValues();
  var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  
  for (var i = 1; i < data.length; i++) {
    var date = (data[i][0] instanceof Date) ? 
      Utilities.formatDate(data[i][0], 'Asia/Kolkata', 'yyyy-MM-dd') : 
      (data[i][0] || '');
    if (date === today && (data[i][2] || '') === dept && (data[i][3] || '') === shift) {
      return true;
    }
  }
  return false;
}

// ============================================================
// SECTION 5: ALERT FUNCTIONS
// ============================================================

function sendGentleReminder() {
  var shiftInfo = getShiftToCheck_();
  if (!shiftInfo) {
    Logger.log('⚠️ No active shift to check.');
    return;
  }
  
  var today = new Date();
  var dateStr = Utilities.formatDate(today, 'Asia/Kolkata', 'dd-MMM-yyyy');
  var timeStr = Utilities.formatDate(today, 'Asia/Kolkata', 'hh:mm a');
  
  var missing = getMissingDepartments_(shiftInfo.shift, today);
  
  if (missing.length === 0) {
    Logger.log('✅ ' + shiftInfo.shift + ' — All departments have data.');
    return;
  }
  
  missing.forEach(function(m) {
    // Wrapped per-department, deliberately. One supervisor without a chat ID,
    // or one failed network call, must never stop every department AFTER it
    // in this same run from being notified — that is exactly the bug that
    // sendTelegramAlert being undefined caused for months (see its comment).
    try {
      var msg = '⏰ REMINDER — ' + m.department + ' Data Due in 15 Minutes\n';
      msg += '📅 ' + dateStr + ' | ⏰ ' + timeStr + '\n\n';
      msg += '🔄 ' + shiftInfo.shift + ' (' + getShiftTiming_(shiftInfo.shift) + ')\n';
      msg += '⏱️ Grace period ends at ' + getShiftDeadline_(shiftInfo.shift) + '\n\n';
      msg += '⚠️ YOUR DEPARTMENT PENDING:\n';
      msg += '  • ' + m.department + ' — 📋 Please upload NOW\n\n';
      msg += buildFormLinkLine_(m.department);
      
      if (m.chatId && m.chatId !== '') {
        sendTelegramToChatId(m.chatId, msg);
      } else {
        // No chat ID on file for this department's supervisor — tell the
        // owner directly, rather than silently skipping the reminder.
        sendTelegramAlert('⚠️ No Telegram registered for ' + m.department + ' (' + m.supervisor + ') — reminder not delivered. They need to message the bot with their name.');
      }
    } catch (err) {
      Logger.log('❌ sendGentleReminder failed for ' + m.department + ': ' + err);
    }
    
    Utilities.sleep(500);
  });
  
  Logger.log('📨 Gentle reminders sent to ' + missing.length + ' supervisors for ' + shiftInfo.shift);
}

function sendDMEDeadlineAlert() {
  var shiftInfo = getShiftToCheck_();
  if (!shiftInfo) {
    Logger.log('⚠️ No active shift to check.');
    return;
  }
  
  var today = new Date();
  var dateStr = Utilities.formatDate(today, 'Asia/Kolkata', 'dd-MMM-yyyy');
  var timeStr = Utilities.formatDate(today, 'Asia/Kolkata', 'hh:mm a');
  
  var missing = getMissingDepartments_(shiftInfo.shift, today);
  
  if (missing.length === 0) {
    Logger.log('✅ ' + shiftInfo.shift + ' — All departments submitted on time.');
    return;
  }
  
  var msg = '🚨 DME ALERT — ' + shiftInfo.shift + ' Grace Period Ended\n';
  msg += '📅 ' + dateStr + ' | ⏰ ' + timeStr + '\n';
  msg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  msg += '⏰ Grace period for ' + shiftInfo.shift + ' has ENDED\n\n';
  msg += '🔴 MISSING DEPARTMENTS:\n';
  msg += buildMissingListText_(missing) + '\n\n';
  msg += '📋 DME ACTION REQUIRED:\n';
  msg += '  ✅ Call supervisors above immediately\n';
  msg += '  ✅ Follow-up at ' + getShiftDeadline_(shiftInfo.shift) + ' + 30 min\n\n';
  msg += '🔗 Dashboard: ' + ScriptApp.getService().getUrl();
  
  sendTelegramAlert(msg);
  
  missing.forEach(function(m) {
    logEscalation_(m.department, shiftInfo.shift, m.supervisor, 'LOW');
  });
  
  Logger.log('📨 DME deadline alert sent for ' + shiftInfo.shift);
}

function sendFollowUpAlert() {
  var shiftInfo = getShiftToCheck_();
  if (!shiftInfo) {
    Logger.log('⚠️ No active shift to check.');
    return;
  }
  
  var today = new Date();
  var dateStr = Utilities.formatDate(today, 'Asia/Kolkata', 'dd-MMM-yyyy');
  var timeStr = Utilities.formatDate(today, 'Asia/Kolkata', 'hh:mm a');
  
  var missing = getMissingDepartments_(shiftInfo.shift, today);
  
  if (missing.length === 0) {
    Logger.log('✅ ' + shiftInfo.shift + ' — All departments now have data.');
    return;
  }
  
  var stillMissing = [];
  missing.forEach(function(m) {
    if (wasEscalatedToday_(m.department, shiftInfo.shift)) {
      stillMissing.push(m);
    }
  });
  
  if (stillMissing.length === 0) {
    Logger.log('✅ ' + shiftInfo.shift + ' — New submissions completed.');
    return;
  }
  
  var msg = '⚠️ DME FOLLOW-UP — ' + shiftInfo.shift + ' STILL Missing\n';
  msg += '📅 ' + dateStr + ' | ⏰ ' + timeStr + '\n';
  msg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  msg += '⏰ 30 minutes overdue\n\n';
  msg += '🔴 STILL MISSING:\n';
  msg += buildMissingListText_(stillMissing) + '\n\n';
  msg += '📋 DME ACTION REQUIRED:\n';
  msg += '  ✅ Escalate to Plant Head if not resolved\n';
  msg += '  ✅ This will appear in today\'s 12:30 AM summary\n\n';
  msg += '🔗 Dashboard: ' + ScriptApp.getService().getUrl();
  
  sendTelegramAlert(msg);
  
  stillMissing.forEach(function(m) {
    logEscalation_(m.department, shiftInfo.shift, m.supervisor, 'MEDIUM');
  });
  
  Logger.log('📨 Follow-up alert sent for ' + shiftInfo.shift);
}

function sendDailySummary() {
  var yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  var dateStr = Utilities.formatDate(yesterday, 'Asia/Kolkata', 'dd-MMM-yyyy');
  
  var allMissing = { 'Shift 1': [], 'Shift 2': [], 'Shift 3': [] };
  
  ['Shift 1', 'Shift 2', 'Shift 3'].forEach(function(shift) {
    allMissing[shift] = getMissingDepartments_(shift, yesterday);
  });
  
  var msg = '📊 VFPL Factory OS — DAILY SUMMARY\n';
  msg += '📅 ' + dateStr + ' | ⏰ 12:30 AM\n';
  msg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  
  var totalMissing = 0;
  ['Shift 1', 'Shift 2', 'Shift 3'].forEach(function(shift) {
    var missing = allMissing[shift];
    if (missing.length > 0) {
      msg += '🔴 ' + shift + ' (' + getShiftTiming_(shift) + ')\n';
      msg += buildMissingListText_(missing) + '\n\n';
      totalMissing += missing.length;
    } else {
      msg += '✅ ' + shift + ' — All complete ✅\n\n';
    }
  });
  
  msg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  msg += totalMissing === 0 ? '✅ ALL CLEAR! 🎉' : '⚠️ ' + totalMissing + ' missing entries.';
  msg += '\n\n🔗 Dashboard: ' + ScriptApp.getService().getUrl();
  
  sendTelegramAlert(msg);
  Logger.log('📨 Daily summary sent for ' + dateStr + ' (' + totalMissing + ' missing)');
}

function sendWeeklyPerformance() {
  var msg = '📊 VFPL Factory OS — WEEKLY PERFORMANCE\n';
  msg += '📅 Week ending: ' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MMM-yyyy') + '\n';
  msg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  msg += '📋 Check WEEKLY_PERFORMANCE tab for detailed scores.\n\n';
  msg += '🔗 Dashboard: ' + ScriptApp.getService().getUrl();
  
  sendTelegramAlert(msg);
  Logger.log('📨 Weekly performance sent');
}

// ============================================================
// SECTION 6: DEPLOY TRIGGERS
// ============================================================

function deployShiftTrackingTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var func = t.getHandlerFunction();
    if (['sendGentleReminder', 'sendDMEDeadlineAlert', 'sendFollowUpAlert', 'sendDailySummary', 'sendWeeklyPerformance', 'recordShiftCompliance', 'rebuildWeeklyPerformance', 'syncOpsDashboardToSupabase',
       'processTelegramOnboarding'].indexOf(func) > -1) {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  ScriptApp.newTrigger('sendGentleReminder').timeBased().atHour(9).nearMinute(15).everyDays(1).create();
  ScriptApp.newTrigger('sendGentleReminder').timeBased().atHour(16).nearMinute(15).everyDays(1).create();
  ScriptApp.newTrigger('sendGentleReminder').timeBased().atHour(0).nearMinute(15).everyDays(1).create();
  
  ScriptApp.newTrigger('sendDMEDeadlineAlert').timeBased().atHour(9).nearMinute(30).everyDays(1).create();
  ScriptApp.newTrigger('sendDMEDeadlineAlert').timeBased().atHour(16).nearMinute(30).everyDays(1).create();
  ScriptApp.newTrigger('sendDMEDeadlineAlert').timeBased().atHour(0).nearMinute(30).everyDays(1).create();
  
  ScriptApp.newTrigger('sendFollowUpAlert').timeBased().atHour(10).nearMinute(0).everyDays(1).create();
  ScriptApp.newTrigger('sendFollowUpAlert').timeBased().atHour(17).nearMinute(0).everyDays(1).create();
  ScriptApp.newTrigger('sendFollowUpAlert').timeBased().atHour(1).nearMinute(0).everyDays(1).create();
  
  ScriptApp.newTrigger('sendDailySummary').timeBased().atHour(0).nearMinute(30).everyDays(1).create();
  
  ScriptApp.newTrigger('sendWeeklyPerformance').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).nearMinute(0).create();
  
  // Submission sweep. The RAW tabs carry no submission timestamp (date only),
  // so the sweep's own run time is the best available proxy for when data
  // arrived. Every 15 minutes keeps that proxy tight enough to be useful.
  ScriptApp.newTrigger('recordShiftCompliance').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('rebuildWeeklyPerformance').timeBased().atHour(1).nearMinute(0).everyDays(1).create();
  
  // Push to Supabase right after each compliance sweep, so the app's Forms tab
  // and the department production figures are never more than ~15 minutes
  // behind the sheet. Skipped silently if the Script Properties are not set,
  // so deploying triggers before configuring credentials is not a failure.
  ScriptApp.newTrigger('syncOpsDashboardToSupabase').timeBased().everyMinutes(15).create();
  
  // Telegram onboarding — every 5 minutes. A supervisor who just messaged the
  // bot should not have to wait a quarter hour to find out whether it worked.
  // No-ops instantly if TELEGRAM_BOT_TOKEN is unset, same as the sync above.
  ScriptApp.newTrigger('processTelegramOnboarding').timeBased().everyMinutes(5).create();
  
  Logger.log('✅ All shift tracking triggers deployed successfully!');
}

// ============================================================
// SECTION 7: VERIFICATION
// ============================================================

function verifyTabsPopulated() {
  var ss = SpreadsheetApp.openById(DASH_ID);
  
  var tabs = ['SUPERVISOR_MAP', 'SHIFT_CONFIG', 'FORM_LINKS', 'DATA_SUBMISSION_LOG', 'WEEKLY_PERFORMANCE', 'FORM_RESPONSES', 'ESCALATION_LOG'];
  
  Logger.log('=== VERIFYING TABS ===');
  
  tabs.forEach(function(tabName) {
    var sh = ss.getSheetByName(tabName);
    if (!sh) {
      Logger.log('  ❌ ' + tabName + ' — NOT FOUND');
      return;
    }
    
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    Logger.log('  ✅ ' + tabName + ' — Rows: ' + lastRow + ', Columns: ' + lastCol);
  });
  
  Logger.log('=== VERIFICATION COMPLETE ===');
}

function testAllFunctions() {
  Logger.log('=== TESTING SUPERVISOR TRACKING ===');
  
  var shiftInfo = getShiftToCheck_();
  Logger.log('Current shift: ' + (shiftInfo ? shiftInfo.shift : 'None'));
  
  var sup = getSupervisorForCurrentWeek_('Cutting');
  Logger.log('Cutting supervisor this week: ' + sup.name + ' | ' + sup.phone + ' | ' + sup.chatId);
  
  var today = new Date();
  var hasData = hasDataForShift_('Cutting', 'Shift 1', today);
  Logger.log('Cutting Shift 1 has data today: ' + hasData);
  
  var missing = getMissingDepartments_('Shift 1', today);
  Logger.log('Missing departments for Shift 1: ' + missing.length);
  missing.forEach(function(m) {
    Logger.log('  - ' + m.department + ' (' + m.supervisor + ')');
  });
  
  Logger.log('=== TEST COMPLETE ===');
}

// ============================================================
// SECTION 8: MAIN DEPLOYMENT — RUN THIS
// ============================================================

// NOTE: an earlier definition of oneTimeSetup() lived here and was shadowed by
// the one further down this file, for the same reason as setupFormTrigger()
// above. Removed so the file has one setup entry point.
// ============================================================
// FORM RESPONSES 1 — PROCESSOR
// ============================================================

/**
 * Get the form responses tab (handles both naming conventions)
 */
function getFormResponsesTab_() {
  var ss = SpreadsheetApp.openById(DASH_ID);
  
  // Try "Form Responses 1" first (Google Forms default)
  var sh = ss.getSheetByName('Form Responses 1');
  if (sh) return sh;
  
  // Try "FORM_RESPONSES" (our naming convention)
  sh = ss.getSheetByName('FORM_RESPONSES');
  if (sh) return sh;
  
  // If neither exists, create FORM_RESPONSES
  sh = ss.insertSheet('FORM_RESPONSES');
  var headers = [
    'Timestamp',
    'Department',
    'Supervisor Name',
    'Phone',
    'Telegram Chat ID',
    'Week Start (Monday)',
    'Week End (Sunday)',
    'Status'
  ];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1565C0')
    .setFontColor('#FFFFFF');
  
  return sh;
}

/**
 * PROCESS FORM SUBMISSIONS — Run this manually or via trigger
 */
function processFormSubmissions() {
  var ss = SpreadsheetApp.openById(DASH_ID);
  
  // Get the form responses tab
  var formSh = getFormResponsesTab_();
  if (!formSh) {
    Logger.log('❌ Form responses tab not found.');
    return;
  }
  
  // Get the supervisor map tab
  var mapSh = ss.getSheetByName('SUPERVISOR_MAP');
  if (!mapSh) {
    Logger.log('❌ SUPERVISOR_MAP tab not found.');
    return;
  }
  
  // Get all data from form responses
  var data = formSh.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log('ℹ️ No form responses to process.');
    return;
  }
  
  // Find column indexes (form responses can have different column order)
  var headers = data[0];
  var colIndex = {};
  var expectedCols = ['Timestamp', 'Department', 'Supervisor Name', 'Phone', 'Telegram Chat ID', 'Week Start', 'Week End'];
  
  // ⚠ FIXED 12 Aug 2026 — this importer had never added a single supervisor.
  // It looked for headers named exactly 'Week Start (Monday)' and
  // 'Week End (Sunday)'. The live registration form writes 'Week Start
  // (Saturday)' and 'Week End (Thursday)', so neither matched, the missing-
  // column check below fired, and the function returned before doing any work
  // — silently, every single time. SUPERVISOR_MAP has rows because they were
  // put there some other way.
  //
  // Rather than pick a convention and risk being wrong about the working week,
  // the two week columns now match on PREFIX, so 'Week Start (Saturday)',
  // 'Week Start (Monday)' and a bare 'Week Start' all resolve. The other five
  // columns still need an exact match, because a loose match there could bind
  // the wrong column.
  var PREFIX_MATCHED = { 'Week Start': true, 'Week End': true };
  
  expectedCols.forEach(function(colName) {
    for (var i = 0; i < headers.length; i++) {
      var header = headers[i] ? headers[i].toString().trim() : '';
      if (!header) continue;
      var hit = PREFIX_MATCHED[colName]
        ? header.indexOf(colName) === 0
        : header === colName;
      if (hit) {
        colIndex[colName] = i;
        break;
      }
    }
  });
  
  // Check if we found all columns
  var missingCols = expectedCols.filter(function(col) { return colIndex[col] === undefined; });
  if (missingCols.length > 0) {
    Logger.log('⚠️ Missing columns in form responses: ' + missingCols.join(', '));
    return;
  }
  
  var processed = 0;
  var skipped = 0;
  
  // Process each row (skip header row)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    
    // Check if already processed (look for Status column if exists)
    var statusCol = headers.indexOf('Status');
    if (statusCol > -1 && row[statusCol] === 'PROCESSED') {
      skipped++;
      continue;
    }
    
    var department = (row[colIndex['Department']] || '').toString().trim();
    var supervisor = (row[colIndex['Supervisor Name']] || '').toString().trim();
    var phone = (row[colIndex['Phone']] || '').toString().trim();
    var chatId = (row[colIndex['Telegram Chat ID']] || '').toString().trim();
    var weekStart = row[colIndex['Week Start']];
    var weekEnd = row[colIndex['Week End']];
    
    if (!department || !supervisor) {
      Logger.log('⚠️ Row ' + (i+1) + ' missing department or supervisor name. Skipping.');
      skipped++;
      continue;
    }
    
    // Format dates
    var startStr = weekStart ? Utilities.formatDate(new Date(weekStart), 'Asia/Kolkata', 'dd-MMM-yyyy') : '';
    var endStr = weekEnd ? Utilities.formatDate(new Date(weekEnd), 'Asia/Kolkata', 'dd-MMM-yyyy') : '';
    
    // Add to SUPERVISOR_MAP
    mapSh.appendRow([
      department,
      supervisor,
      phone,
      chatId,
      startStr,
      endStr,
      'YES'
    ]);
    
    // Mark as processed
    if (statusCol > -1) {
      formSh.getRange(i + 1, statusCol + 1).setValue('PROCESSED');
      formSh.getRange(i + 1, statusCol + 1).setBackground('#C8E6C9');
    }
    
    processed++;
    Logger.log('✅ Added: ' + supervisor + ' (' + department + ') for week ' + startStr + ' to ' + endStr);
  }
  
  Logger.log('📊 Processing complete: ' + processed + ' added, ' + skipped + ' skipped.');
  
  if (processed > 0) {
    sendTelegramAlert('✅ ' + processed + ' supervisor(s) added from form submissions.');
  }
}

/**
 * SET UP FORM TRIGGER (Monitors "Form Responses 1" tab)
 */
function setupFormTrigger() {
  // Remove existing triggers
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'processFormSubmissions') {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  // Create new trigger
  ScriptApp.newTrigger('processFormSubmissions')
    .forSpreadsheet(DASH_ID)
    .onFormSubmit()
    .create();
  
  Logger.log('✅ Form submission trigger set up!');
  Logger.log('📋 Watching: Form Responses 1 tab');
}

/**
 * MANUAL PROCESS — Run this to process all pending form submissions
 */
function processPendingFormSubmissions() {
  Logger.log('🚀 Processing pending form submissions...');
  processFormSubmissions();
  Logger.log('✅ Done!');
}

/**
 * ONE-TIME SETUP — Creates all tabs with sample data
 */
function oneTimeSetup() {
  Logger.log('🚀 STARTING ONE-TIME SETUP...');
  
  var ss = SpreadsheetApp.openById(DASH_ID);
  
  // 1. Create/Update SUPERVISOR_MAP
  createDynamicSupervisorMap_(ss);
  
  // 2. Create/Update SHIFT_CONFIG
  createShiftConfigTab_(ss);
  
  // 3. Create/Update DATA_SUBMISSION_LOG
  createDataSubmissionLogTab_(ss);
  
  // 4. Create/Update WEEKLY_PERFORMANCE
  createWeeklyPerformanceTab_(ss);
  
  // 5. Create/Update ESCALATION_LOG
  createEscalationLogTab_(ss);
  
  // 6. Ensure FORM_RESPONSES exists (for manual entries)
  getFormResponsesTab_();
  
  // 7. Set up form trigger
  setupFormTrigger();
  
  // 8. Verify
  verifyTabsPopulated();
  
  Logger.log('');
  Logger.log('✅ ONE-TIME SETUP COMPLETE!');
  Logger.log('');
  Logger.log('📋 NEXT STEPS:');
  Logger.log('  1. Share Google Form link with DME');
  Logger.log('  2. DME fills supervisor data');
  Logger.log('  3. Run: processPendingFormSubmissions() to process existing responses');
  Logger.log('  4. Or wait: trigger auto-processes new submissions');
  Logger.log('  5. Run: deployShiftTrackingTriggers() to start alerts');
}

// ============================================================
// QUICK FIX — If Form Responses 1 already has data
// ============================================================

function quickProcessForm() {
  Logger.log('🚀 Quick processing form responses...');
  processFormSubmissions();
  verifyTabsPopulated();
}function updateTo3Supervisors() {
  var ss = SpreadsheetApp.openById(DASH_ID);
  var sh = ss.getSheetByName('SUPERVISOR_MAP');
  if (!sh) {
    Logger.log('❌ SUPERVISOR_MAP not found.');
    return;
  }
  
  // Clear existing data (keep headers)
  var lastRow = sh.getLastRow();
  if (lastRow > 1) {
    sh.getRange(2, 1, lastRow - 1, 7).clearContent();
  }
  
  // ─── 3 SUPERVISORS PER DEPARTMENT ───
  // Each department gets 3 supervisors (for 3 weeks / 3 shifts)
  var departments = [
    'Cutting', 'Forge', 'Press', 'Machine', 'HT', 'Final',
    'Electricity', 'Oil', 'Staff Manpower', 'Contract Manpower'
  ];
  
  // Week dates (3 weeks)
  var weeks = [
    { start: '04-Aug-2026', end: '10-Aug-2026' },
    { start: '11-Aug-2026', end: '17-Aug-2026' },
    { start: '18-Aug-2026', end: '24-Aug-2026' }
  ];
  
  var sampleData = [];
  
  departments.forEach(function(dept) {
    weeks.forEach(function(week, idx) {
      sampleData.push([
        dept,
        '______',  // Supervisor Name
        '______',  // Phone
        '______',  // Telegram Chat ID
        week.start,
        week.end,
        'YES'
      ]);
    });
  });
  
  if (sampleData.length > 0) {
    sh.getRange(2, 1, sampleData.length, 7).setValues(sampleData);
  }
  
  sh.autoResizeColumns(1, 7);
  
  Logger.log('✅ SUPERVISOR_MAP updated with 3 supervisors per department.');
  Logger.log('📊 Total rows: ' + sampleData.length + ' (10 departments × 3 supervisors)');
}

// ============================================================
// END OF Alert.gs
// ============================================================
// ============================================================
// SECTION 9: FORM LINKS + COMPLIANCE SCORING  (added 12 Aug 2026)
// ============================================================
//
// Two things this section adds:
//
//   1. A real Google Form link in the reminders. The gentle reminder used to
//      end with the literal text "[Google Form Link]" — a placeholder that was
//      never filled in — so supervisors were told to upload with no way to.
//
//   2. A submission record. DATA_SUBMISSION_LOG and WEEKLY_PERFORMANCE were
//      created with headers but nothing ever wrote a row to either — both are
//      still empty in the live sheet. recordShiftCompliance() fills the first,
//      rebuildWeeklyPerformance() rolls it up into the second.
//
// What that record is NOT (Yash, 12 Aug): a score. It logs on time / late /
// missing and the delay in minutes, so the app knows what is outstanding.
// The points scheme drafted earlier the same day was removed — the shift
// timings drive notifications in the app, not a number against a name.

// ── FORM_LINKS TAB ────────────────────────────────────────

/**
 * Creates the FORM_LINKS tab and seeds it from DEPT_FORM_URLS.
 *
 * Unlike the other create*Tab_ helpers this deliberately does NOT clear an
 * existing tab — the whole point is that whoever owns the forms can correct a
 * wrong link in the sheet, and re-running setup must not wipe that. Only
 * departments with no row yet are appended.
 */
function createFormLinksTab_(ss) {
  var sh = ss.getSheetByName(FORM_LINKS_TAB);
  var headers = ['Department', 'Form Name', 'Frequency', 'Responsible Person', 'Form URL', 'Send in reminder?'];
  
  // An earlier version of this script created FORM_LINKS with three columns.
  // Rebuild rather than half-migrate if the shape does not match.
  if (sh && sh.getLastColumn() < headers.length) {
    ss.deleteSheet(sh);
    sh = null;
  }
  
  if (!sh) {
    sh = ss.insertSheet(FORM_LINKS_TAB);
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold')
      .setBackground('#1565C0')
      .setFontColor('#FFFFFF');
  }
  
  // Keyed on department + form name so re-running setup never overwrites a
  // link someone has corrected in the sheet, and never duplicates a row.
  var existing = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function(r) {
      existing[(r[0] || '').toString().trim() + '|' + (r[1] || '').toString().trim()] = true;
    });
  }
  
  var toAdd = [];
  DEPT_FORM_SEED.forEach(function(row) {
    if (existing[row[0] + '|' + row[1]]) return;
    toAdd.push(row);
  });
  
  if (toAdd.length > 0) {
    sh.getRange(sh.getLastRow() + 1, 1, toAdd.length, headers.length).setValues(toAdd);
  }
  
  sh.autoResizeColumns(1, headers.length);
  Logger.log('  \u2705 ' + FORM_LINKS_TAB + ' ready (' + toAdd.length + ' row(s) added)');
  
  var noForm = [];
  DEPARTMENTS.forEach(function(dept) {
    if (getFormsForDept_(dept).length === 0) noForm.push(dept);
  });
  if (noForm.length > 0) {
    Logger.log('  \u26a0 No form link for: ' + noForm.join(', '));
  }
}

var _formCache = null;

/**
 * The daily forms a department must submit: FORM_LINKS tab first, falling back
 * to DEPT_FORM_SEED when the tab has not been created yet. Rows with
 * "Send in reminder?" set to anything other than YES are skipped, which is how
 * a form gets muted without deleting its row.
 */
function getFormsForDept_(dept) {
  if (_formCache === null) {
    _formCache = {};
    var rows = null;
    var sh = SpreadsheetApp.openById(DASH_ID).getSheetByName(FORM_LINKS_TAB);
    if (sh && sh.getLastRow() > 1 && sh.getLastColumn() >= 6) {
      rows = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
    } else {
      rows = DEPT_FORM_SEED;
    }
    rows.forEach(function(r) {
      var d = (r[0] || '').toString().trim();
      var name = (r[1] || '').toString().trim();
      var url = (r[4] || '').toString().trim();
      var include = (r[5] || '').toString().trim().toUpperCase();
      if (!d || !url || include !== 'YES') return;
      if (!_formCache[d]) _formCache[d] = [];
      _formCache[d].push({ name: name, url: url });
    });
  }
  return _formCache[dept] || [];
}

/**
 * The upload block for a reminder. When nothing is configured, say so plainly
 * rather than printing a placeholder that looks like a link — the failure that
 * started all this.
 */
function buildFormLinkLine_(dept) {
  var forms = getFormsForDept_(dept);
  if (forms.length === 0) {
    return '\u26a0\ufe0f No form link configured for ' + dept + ' \u2014 add it to the ' + FORM_LINKS_TAB + ' tab.';
  }
  if (forms.length === 1) {
    return '\ud83d\udd17 Upload here: ' + forms[0].url;
  }
  var lines = ['\ud83d\udd17 Forms due for ' + dept + ':'];
  forms.forEach(function(f) {
    lines.push('  \u2022 ' + f.name + '\n    ' + f.url);
  });
  return lines.join('\n');
}

// ── SHIFT DEADLINES AS REAL DATES ─────────────────────────

function parseHm_(hm) {
  var parts = (hm || '').split(':');
  return { h: parseInt(parts[0], 10), m: parseInt(parts[1], 10) };
}

/**
 * The deadline for a shift that STARTED on shiftDate, as a Date.
 *
 * A deadline earlier on the clock than the shift start belongs to the next
 * calendar day: Shift 2 runs to 23:30 with a 00:30 deadline, and Shift 3
 * starts at 23:30 with a 09:30 deadline the following morning. Shift 1
 * (08:30 start, 16:30 deadline) stays on the same day.
 */
function getShiftDeadlineDateTime_(shift, shiftDate) {
  var cfg = SHIFT_CONFIG_DATA[shift];
  if (!cfg) return null;
  
  var start = parseHm_(cfg.start);
  var dl = parseHm_(cfg.deadline);
  
  var d = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate(), dl.h, dl.m, 0, 0);
  if (dl.h * 60 + dl.m < start.h * 60 + start.m) d.setDate(d.getDate() + 1);
  return d;
}

// ── COMPLIANCE SWEEP ──────────────────────────────────────

/** Keys already present in DATA_SUBMISSION_LOG, so the sweep stays idempotent. */
function loadComplianceKeys_(sh) {
  var keys = {};
  if (sh.getLastRow() < 2) return keys;
  
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  data.forEach(function(r) {
    var d = r[0];
    if (!d) return;
    var dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return;
    var dateStr = Utilities.formatDate(dt, 'Asia/Kolkata', 'yyyy-MM-dd');
    keys[dateStr + '|' + (r[1] || '') + '|' + (r[2] || '')] = true;
  });
  return keys;
}

/**
 * Writes one DATA_SUBMISSION_LOG row per (date, department, shift) once its
 * outcome is settled — either the data has appeared, or it is late enough to
 * be called missing. Runs every 15 minutes.
 *
 * ⚠ Entry Time is the time this sweep first SAW the data, not the time the
 * form was submitted. The RAW tabs record a date with no time of day, so the
 * true submission moment is not recoverable from them. The 15-minute cadence
 * keeps that approximation well inside the one-hour buckets the penalty uses,
 * but a submission made minutes before a deadline can still land in the sweep
 * just after it. If exact timing ever matters, the fix is to read the shop
 * forms' own response timestamps rather than the RAW tabs.
 */
function recordShiftCompliance() {
  var ss = SpreadsheetApp.openById(DASH_ID);
  var sh = ss.getSheetByName('DATA_SUBMISSION_LOG');
  if (!sh) {
    Logger.log('❌ DATA_SUBMISSION_LOG not found — run setupDynamicSupervisorTabs() first.');
    return;
  }
  
  var now = new Date();
  var logged = loadComplianceKeys_(sh);
  var rows = [];
  
  for (var offset = COMPLIANCE_LOOKBACK_DAYS; offset >= 0; offset--) {
    var shiftDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    var dateStr = Utilities.formatDate(shiftDate, 'Asia/Kolkata', 'yyyy-MM-dd');
    
    ['Shift 1', 'Shift 2', 'Shift 3'].forEach(function(shift) {
      var deadline = getShiftDeadlineDateTime_(shift, shiftDate);
      if (!deadline) return;
      
      DEPARTMENTS.forEach(function(dept) {
        var key = dateStr + '|' + dept + '|' + shift;
        if (logged[key]) return;
        
        var supervisor = getSupervisorForCurrentWeek_(dept);
        var minutesPastDeadline = Math.round((now.getTime() - deadline.getTime()) / 60000);
        
        if (hasDataForShift_(dept, shift, shiftDate)) {
          var delay = Math.max(0, minutesPastDeadline);
          rows.push([
            dateStr,
            dept,
            shift,
            supervisor.name || 'Unknown',
            Utilities.formatDate(now, 'Asia/Kolkata', 'HH:mm'),
            delay === 0 ? 'ON TIME' : 'LATE',
            delay
          ]);
          logged[key] = true;
        } else if (minutesPastDeadline > MISSING_CUTOFF_HOURS * 60) {
          rows.push([
            dateStr,
            dept,
            shift,
            supervisor.name || 'Unknown',
            '',
            'MISSING',
            ''
          ]);
          logged[key] = true;
        }
        // Otherwise the shift is still open, or late but inside the cutoff —
        // leave it unlogged so a later sweep can still record it as submitted.
      });
    });
  }
  
  if (rows.length === 0) {
    Logger.log('ℹ️ Compliance sweep: nothing new to record.');
    return;
  }
  
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  Logger.log('✅ Compliance sweep: ' + rows.length + ' row(s) written.');
}

// ── WEEKLY ROLL-UP ────────────────────────────────────────

/**
 * Saturday of the week containing `date`, as yyyy-MM-dd.
 *
 * ⚠ CONFIRMED 13 Aug 2026 (Yash): the real working week is Saturday through
 * Thursday, with Friday as the weekly off — "unless we have urgent
 * production, Friday is working; 90% of the time Friday is off." That matches
 * the live registration form exactly ("Week Start (Saturday)" / "Week End
 * (Thursday)"), which the PREVIOUS version of this function disagreed with —
 * it computed Monday, on the grounds that "that is what the script has always
 * assumed," with a note to fix it once the real week was known. It is now
 * known, so this computes Saturday.
 *
 * Nothing else needed to change for the Friday exception itself: shift
 * assignment (employee_shifts) is already per-date, so a working Friday is
 * just a Friday HR assigns shifts for, same as any other day, and a day off
 * is a Friday with none. There is no separate "is this Friday working" flag
 * to maintain.
 */
function weekStartFor_(date) {
  var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  var dow = d.getDay();               // 0 = Sunday
  // Days to step back to reach the most recent Saturday (dow 6).
  var back = (dow + 1) % 7;
  d.setDate(d.getDate() - back);
  return Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd');
}

/**
 * Rebuilds WEEKLY_PERFORMANCE from DATA_SUBMISSION_LOG. Rebuilt rather than
 * appended so a corrected log row is reflected on the next run.
 *
 * Counts only — submitted on time, submitted late, never submitted. The
 * score, points and performance band this used to emit were removed 12 Aug
 * (see the note at the top of the file).
 */
function rebuildWeeklyPerformance() {
  var ss = SpreadsheetApp.openById(DASH_ID);
  var log = ss.getSheetByName('DATA_SUBMISSION_LOG');
  var out = ss.getSheetByName('WEEKLY_PERFORMANCE');
  if (!log || !out) {
    Logger.log('❌ DATA_SUBMISSION_LOG or WEEKLY_PERFORMANCE missing.');
    return;
  }
  if (log.getLastRow() < 2) {
    Logger.log('ℹ️ No submission rows to roll up yet.');
    return;
  }
  
  var data = log.getRange(2, 1, log.getLastRow() - 1, 7).getValues();
  var groups = {};
  
  data.forEach(function(r) {
    var d = r[0];
    if (!d) return;
    var dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return;
    
    var dept = (r[1] || '').toString().trim();
    var supervisor = (r[3] || 'Unknown').toString().trim();
    var status = (r[5] || '').toString().trim().toUpperCase();
    var week = weekStartFor_(dt);
    
    var key = supervisor + '|' + dept + '|' + week;
    if (!groups[key]) {
      groups[key] = { supervisor: supervisor, dept: dept, week: week,
                      total: 0, onTime: 0, late: 0, missing: 0 };
    }
    var g = groups[key];
    g.total++;
    if (status === 'ON TIME') g.onTime++;
    else if (status === 'LATE') g.late++;
    else g.missing++;
  });
  
  var list = [];
  Object.keys(groups).forEach(function(k) { list.push(groups[k]); });
  
  // Sorted for readability only — by week, then department, then name. This
  // is deliberately NOT a ranking: the previous version ordered supervisors
  // best-to-worst by points, which is the scoring Yash asked to drop.
  list.sort(function(a, b) {
    if (a.week !== b.week) return a.week < b.week ? 1 : -1;
    if (a.dept !== b.dept) return a.dept < b.dept ? -1 : 1;
    return a.supervisor < b.supervisor ? -1 : 1;
  });
  
  var rows = list.map(function(g) {
    return [g.supervisor, g.dept, g.week, g.total, g.onTime, g.late, g.missing];
  });
  
  if (out.getLastRow() > 1) {
    out.getRange(2, 1, out.getLastRow() - 1, out.getLastColumn()).clearContent();
  }
  if (rows.length > 0) {
    out.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
  
  Logger.log('✅ WEEKLY_PERFORMANCE rebuilt: ' + rows.length + ' row(s).');
}


// ============================================================
// SUPABASE SYNC — dashboard data into the app
// ============================================================
//
// The Forge OS app cannot read a Google Sheet. Two things it needs live only
// here, so they get pushed to Supabase:
//
//   form_submissions    — which (date, department, shift) actually came in,
//                         so the Forms tab can show what is outstanding
//   production_records  — the RAW tab rows, so department production can
//                         appear on the manager and owner dashboards
//
// Both land in tables created by PATCH_15. Writes use the service role key,
// which bypasses RLS — that is why neither table has an INSERT policy and why
// nothing installed on a phone can forge a row.
//
// ⚠ SETUP, ONCE. In the Apps Script editor: Project Settings → Script
// Properties → add
//     SUPABASE_URL               https://odfwtdpvpfzdrznvurru.supabase.co
//     SUPABASE_SERVICE_ROLE_KEY  <the service_role key from Supabase>
// The service role key must never be committed to git or pasted into chat.
// scripts/MigrateToSupabase.gs uses the same two properties, so if that
// script was ever configured these are already set.

var SUPABASE_PUSH_BATCH = 500;

/**
 * Where the credentials come from, in order of preference.
 *
 * Script Properties win over the inline constants, so moving the key out of
 * the file later needs no code change — set the two properties and the inline
 * values stop being consulted.
 */
function getSupabaseCredentials_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('SUPABASE_URL') || SUPABASE_URL_INLINE;
  var key = props.getProperty('SUPABASE_SERVICE_ROLE_KEY') || SUPABASE_SERVICE_ROLE_KEY_INLINE;

  if (!url || !key) {
    throw new Error(
      'No Supabase credentials. Either paste your key into ' +
      'SUPABASE_SERVICE_ROLE_KEY_INLINE at the top of this file, or set ' +
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Project Settings → Script Properties.'
    );
  }
  return { url: url, key: key };
}

/**
 * Upserts rows into a Supabase table, batched.
 *
 * Uses Prefer: resolution=merge-duplicates against the table's row_key unique
 * constraint, so a sweep that re-reads yesterday updates rather than
 * duplicates. Returns the number of rows sent.
 */
function supabasePush_(table, rows) {
  if (!rows || rows.length === 0) return 0;

  var creds = getSupabaseCredentials_();
  var baseUrl = creds.url;
  var serviceKey = creds.key;

  var sent = 0;
  for (var i = 0; i < rows.length; i += SUPABASE_PUSH_BATCH) {
    var batch = rows.slice(i, i + SUPABASE_PUSH_BATCH);
    var res = UrlFetchApp.fetch(baseUrl.replace(/\/$/, '') + '/rest/v1/' + table, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        apikey: serviceKey,
        Authorization: 'Bearer ' + serviceKey,
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      payload: JSON.stringify(batch),
      muteHttpExceptions: true
    });

    var code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      // Loud on purpose. A silently discarded error here is exactly how the
      // app's own notification inserts failed unnoticed for a week.
      throw new Error('Supabase push to ' + table + ' failed (' + code + '): ' + res.getContentText());
    }
    sent += batch.length;
  }
  return sent;
}

/** yyyy-MM-dd in IST, from a Date or a sheet cell. */
function toDateKey_(value) {
  if (!value) return null;
  var d = (value instanceof Date) ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  return Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd');
}

/**
 * Pushes DATA_SUBMISSION_LOG into form_submissions.
 *
 * Per (date, department, shift), not per form — the RAW tabs record that a
 * department submitted for a shift, never which of its 3-6 daily forms that
 * was. The app can therefore show an outstanding shift, not an outstanding
 * form, until each form's own response sheet is wired up.
 */
function syncFormSubmissionsToSupabase() {
  var ss = SpreadsheetApp.openById(DASH_ID);
  var sh = ss.getSheetByName('DATA_SUBMISSION_LOG');
  if (!sh || sh.getLastRow() < 2) {
    Logger.log('ℹ️ form_submissions: nothing logged yet.');
    return 0;
  }

  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  var rows = [];

  data.forEach(function(r) {
    var dateKey = toDateKey_(r[0]);
    var dept = DEPT_TO_DB_DEPARTMENT[(r[1] || '').toString().trim()];
    if (!dateKey || !dept) return;

    var shift = (r[2] || '').toString().trim() || null;
    var status = (r[5] || '').toString().trim().toUpperCase();
    if (['ON TIME', 'LATE', 'MISSING'].indexOf(status) === -1) return;

    rows.push({
      row_key: dateKey + '|' + dept + '|' + (shift || ''),
      date: dateKey,
      department: dept,
      shift: shift,
      status: status,
      delay_minutes: (r[6] === '' || r[6] === null) ? null : Number(r[6]),
      entry_time: (r[4] || '').toString() || null,
      supervisor_name: (r[3] || '').toString() || null
    });
  });

  var sent = supabasePush_('form_submissions', rows);
  Logger.log('✅ form_submissions: ' + sent + ' row(s) pushed.');
  return sent;
}

/**
 * Pushes the RAW production tabs into production_records.
 *
 * The three tabs that carry real production have three shapes:
 *   Cutting  Date | Machine | Shift | VF_No | Qty
 *   HT       Date | Furnace | Shift | Qty
 *   Final    Date | Process | Shift | VF_No | Qty
 * so `unit` takes column 2 whatever it is called, quantity is the last
 * numeric column, and VF_No is only read where the tab has five columns.
 *
 * ⚠ The Shift column is not reliably a shift. Yash confirmed 12 Aug that
 * Cutting rows hold the name of whoever is responsible for filling the form
 * ('B.S. Todmal'), not a shift. normaliseShift_ returns null for those and the
 * row is stored with a null shift rather than being dropped — the quantity is
 * still real production.
 */
function syncProductionToSupabase() {
  var ss = SpreadsheetApp.openById(DASH_ID);
  var rows = [];

  Object.keys(DEPT_TO_DB_DEPARTMENT).forEach(function(dept) {
    if (NON_PRODUCTION_DEPTS[dept]) return;   // kWh / litres, not parts — see the note above.

    var tabName = DEPT_TO_RAW_TAB[dept];
    var sh = tabName ? ss.getSheetByName(tabName) : null;
    if (!sh || sh.getLastRow() < 2) return;

    var values = sh.getDataRange().getValues();
    var width = values[0].length;

    for (var i = 1; i < values.length; i++) {
      var r = values[i];
      var dateKey = toDateKey_(r[0]);
      if (!dateKey) continue;

      var unit = (r[1] || '').toString().trim() || null;
      var shift = normaliseShift_(r[2]);
      var vfNo = width >= 5 ? ((r[3] || '').toString().trim() || null) : null;
      var qtyRaw = width >= 5 ? r[4] : r[3];
      var qty = (qtyRaw === '' || qtyRaw === null || qtyRaw === undefined) ? null : Number(qtyRaw);
      if (qty !== null && isNaN(qty)) qty = null;

      rows.push({
        row_key: [dateKey, DEPT_TO_DB_DEPARTMENT[dept], shift || '', unit || '', vfNo || ''].join('|'),
        date: dateKey,
        department: DEPT_TO_DB_DEPARTMENT[dept],
        shift: shift,
        unit: unit,
        vf_no: vfNo,
        qty: qty
      });
    }
  });

  // Two rows for the same machine, shift and VF number on one day collapse to
  // one row_key; keep the last, which is the corrected value if someone edited
  // the sheet.
  var deduped = {};
  rows.forEach(function(row) { deduped[row.row_key] = row; });
  var unique = Object.keys(deduped).map(function(k) { return deduped[k]; });

  var sent = supabasePush_('production_records', unique);
  Logger.log('✅ production_records: ' + sent + ' row(s) pushed (' + rows.length + ' read).');
  return sent;
}

/** Both syncs. This is what the trigger calls. */
function syncOpsDashboardToSupabase() {
  var forms = syncFormSubmissionsToSupabase();
  var production = syncProductionToSupabase();
  Logger.log('✅ Sync complete: ' + forms + ' submission row(s), ' + production + ' production row(s).');
}

/**
 * Run this once from the editor after setting the two Script Properties. It
 * pushes everything and reports what landed, so a credential or column
 * mistake surfaces here rather than silently on a timer at 01:00.
 */
function testSupabaseSync() {
  getSupabaseCredentials_();   // throws with instructions if neither source is filled in
  syncOpsDashboardToSupabase();
  Logger.log('✅ Supabase sync test passed. Check the app: manager → Reports, supervisor → Forms.');
}


// ============================================================
// TELEGRAM ONBOARDING (13 Aug 2026)
// ============================================================
//
// Several SUPERVISOR_MAP rows have a blank Telegram Chat ID, because a
// numeric chat ID is not something a person knows off the top of their
// head — you only get it by messaging a bot and having the bot tell you.
// The weekly registration form asks for it anyway, so most people leave it
// blank or guess wrong.
//
// This closes that gap without changing the registration form: a supervisor
// messages the bot with their name, the bot's replies are polled here every
// few minutes, and a name match against the CURRENT WEEK's SUPERVISOR_MAP
// rows writes the chat ID in directly — no typing a long number into a form.
//
// ⚠ SETUP, ONCE. Project Settings → Script Properties → add
//     TELEGRAM_BOT_TOKEN   the token from @BotFather for the bot supervisors
//                          will message (this project's chat token, shared
//                          with sendTelegramToChatId above — send FROM one
//                          bot, register FOR the same one).
// Then message the bot from your OWN phone once and run
// processTelegramOnboarding() manually to confirm it can read updates before
// putting it on a timer.
//
// ⚠ MATCHING IS DELIBERATELY CONSERVATIVE. A message is only accepted when
// it matches EXACTLY ONE currently-active SUPERVISOR_MAP row by name
// (case-insensitive substring, either direction). Zero matches or more than
// one are logged and skipped rather than guessed — the "B.S. Todmal" vs
// "Balasaheb Shivaji Todmal" name-variant problem already documented
// elsewhere in this file is exactly why a wrong auto-match would be worse
// than no match.
//
// THE OWNER USES THE SAME FLOW. Yash is not a rotating weekly supervisor, so
// he has no SUPERVISOR_MAP row to match against — but "message the bot with
// your name" is one instruction HR can give everyone, owner included, rather
// than a special case to explain separately. A message matching any of
// OWNER_NAME_TRIGGERS is checked FIRST, before the SUPERVISOR_MAP lookup, and
// writes OWNER_TELEGRAM_CHAT_ID as a Script Property instead of a sheet row —
// that is what sendTelegramAlert() reads to deliver the plant-wide DME /
// follow-up / daily-summary reports.
var OWNER_NAME_TRIGGERS = ['yash', 'yash munot', 'yash jinendra munot', 'owner', 'vfl1001'];

/** The Telegram numeric user/chat id last confirmed processed, so the same
 * message is never matched twice. Stored in Script Properties, not a sheet
 * cell, since it is bookkeeping for this function alone. */
function getLastTelegramUpdateId_() {
  var v = PropertiesService.getScriptProperties().getProperty('TELEGRAM_LAST_UPDATE_ID');
  return v ? parseInt(v, 10) : 0;
}
function setLastTelegramUpdateId_(id) {
  PropertiesService.getScriptProperties().setProperty('TELEGRAM_LAST_UPDATE_ID', String(id));
}

/**
 * Polls Telegram for new messages and matches each sender's name against
 * this week's SUPERVISOR_MAP rows, writing their chat_id (column D) in on a
 * unique match. Meant to run every few minutes via deployShiftTrackingTriggers().
 */
function processTelegramOnboarding() {
  var token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) {
    Logger.log('❌ TELEGRAM_BOT_TOKEN not set — nothing to poll.');
    return;
  }

  var lastId = getLastTelegramUpdateId_();
  var res = UrlFetchApp.fetch(
    'https://api.telegram.org/bot' + token + '/getUpdates?offset=' + (lastId + 1) + '&timeout=0',
    { muteHttpExceptions: true }
  );
  var body = JSON.parse(res.getContentText());
  if (!body.ok) {
    Logger.log('❌ getUpdates failed: ' + res.getContentText());
    return;
  }

  var updates = body.result || [];
  if (updates.length === 0) {
    Logger.log('ℹ️ Telegram onboarding: no new messages.');
    return;
  }

  var ss = SpreadsheetApp.openById(DASH_ID);
  var sh = ss.getSheetByName('SUPERVISOR_MAP');
  var registered = 0;
  var unmatched = [];

  updates.forEach(function(update) {
    setLastTelegramUpdateId_(update.update_id);

    var msg = update.message;
    if (!msg || !msg.text || !msg.chat) return;

    var text = msg.text.replace(/^\/start\s*/i, '').trim();
    if (!text || text.length < 3) return;   // bare "/start" with nothing to match on

    var chatId = String(msg.chat.id);

    if (OWNER_NAME_TRIGGERS.indexOf(text.toLowerCase()) > -1) {
      PropertiesService.getScriptProperties().setProperty('OWNER_TELEGRAM_CHAT_ID', chatId);
      registered++;
      sendTelegramToChatId(chatId, '✅ Registered as plant owner. You will receive the DME, follow-up and daily summary reports here.');
      return;
    }

    var match = matchSupervisorByName_(sh, text);

    if (match === 'none') {
      unmatched.push(text);
      sendTelegramToChatId(chatId,
        'Could not find "' + text + '" in this week\'s supervisor list. ' +
        'Check the spelling matches what you registered with, or ask HR.');
    } else if (match === 'ambiguous') {
      unmatched.push(text + ' (ambiguous)');
      sendTelegramToChatId(chatId,
        'More than one supervisor matches "' + text + '" this week — ask HR to set your Chat ID manually.');
    } else {
      match.range.setValue(chatId);
      registered++;
      sendTelegramToChatId(chatId, '✅ Registered. You will receive shift alerts here from now on.');
    }
  });

  Logger.log('✅ Telegram onboarding: ' + registered + ' registered, ' + unmatched.length + ' unmatched (' + unmatched.join(', ') + ').');
}

/** Returns 'none', 'ambiguous', or { range } — the Chat ID cell to write, for
 * exactly one currently-active SUPERVISOR_MAP row whose name contains, or is
 * contained by, the given text (case-insensitive). */
function matchSupervisorByName_(sh, text) {
  if (!sh) return 'none';

  var data = sh.getDataRange().getValues();
  var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  var needle = text.toLowerCase();
  var hits = [];

  for (var i = 1; i < data.length; i++) {
    var active = (data[i][6] || '').toString().trim().toUpperCase();
    if (active !== 'YES') continue;

    var weekStart = data[i][4], weekEnd = data[i][5];
    if (!weekStart || !weekEnd) continue;
    var startStr = Utilities.formatDate(new Date(weekStart), 'Asia/Kolkata', 'yyyy-MM-dd');
    var endStr = Utilities.formatDate(new Date(weekEnd), 'Asia/Kolkata', 'yyyy-MM-dd');
    if (today < startStr || today > endStr) continue;

    var name = (data[i][1] || '').toString().trim().toLowerCase();
    if (!name) continue;
    if (name.indexOf(needle) === -1 && needle.indexOf(name) === -1) continue;

    hits.push(i + 1);   // 1-indexed sheet row
  }

  if (hits.length === 0) return 'none';
  if (hits.length > 1) return 'ambiguous';
  return { range: sh.getRange(hits[0], 4) };   // column D = Telegram Chat ID
}

// ── SELF-CHECK ────────────────────────────────────────────

/**
 * Run this after pasting the script. It exercises the pure logic — deadline
 * rollovers and shift normalisation — without touching Telegram, and reports
 * the form links configured for each department.
 *
 * Keeps its name so the instructions already given to Yash still apply, even
 * though the scoring curve it used to check is gone.
 */
function testComplianceScoring() {
  var failures = [];
  function check(label, actual, expected) {
    if (String(actual) !== String(expected)) {
      failures.push(label + ': got ' + actual + ', expected ' + expected);
    }
  }
  
  var base = new Date(2026, 7, 12);          // 12 Aug 2026
  function dl(shift) {
    return Utilities.formatDate(getShiftDeadlineDateTime_(shift, base), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm');
  }
  check('Shift 1 deadline', dl('Shift 1'), '2026-08-12 16:30');
  check('Shift 2 deadline', dl('Shift 2'), '2026-08-13 00:30');
  check('Shift 3 deadline', dl('Shift 3'), '2026-08-13 09:30');
  
  // weekStartFor_: Saturday of the containing week, for every day of the week.
  // 8 Aug 2026 is a Saturday; 14 Aug 2026 is the following Friday.
  check('week start (Sat itself)', weekStartFor_(new Date(2026, 7, 8)),  '2026-08-08');
  check('week start (Sun)',        weekStartFor_(new Date(2026, 7, 9)),  '2026-08-08');
  check('week start (Wed)',        weekStartFor_(new Date(2026, 7, 12)), '2026-08-08');
  check('week start (Fri)',        weekStartFor_(new Date(2026, 7, 14)), '2026-08-08');
  
  check('First Shift',   normaliseShift_('First Shift'),   'Shift 1');
  check('2nd Staff',     normaliseShift_('2nd Staff'),     'Shift 2');
  check('Third Shift',   normaliseShift_('Third Shift'),   'Shift 3');
  check('General Shift', normaliseShift_('General Shift'), 'null');
  check('person name',   normaliseShift_('B.S. Todmal'),   'null');
  check('blank',         normaliseShift_(''),              'null');
  
  Logger.log('=== FORM LINKS ===');
  DEPARTMENTS.forEach(function(dept) {
    var forms = getFormsForDept_(dept);
    if (forms.length === 0) {
      Logger.log('  ❌ ' + dept + ': NOT CONFIGURED');
      return;
    }
    Logger.log('  ✅ ' + dept + ': ' + forms.length + ' form(s)');
    forms.forEach(function(f) { Logger.log('       • ' + f.name + ' — ' + f.url); });
  });
  
  Logger.log('=== SELF-CHECK ===');
  if (failures.length === 0) {
    Logger.log('✅ All 13 logic checks passed.');
  } else {
    failures.forEach(function(f) { Logger.log('❌ ' + f); });
    throw new Error(failures.length + ' self-check failure(s) — see log.');
  }
}
