// ============================================================
// resolveFormSheets.gs — find each form's REAL current response
// sheet, without anyone (me included) guessing between duplicates
// ============================================================
//
// WHY THIS EXISTS. Investigating per-form ticking (13 Aug) confirmed the
// data needed exists: each individual Google Form has its own response
// spreadsheet with a Timestamp column, distinct from the shared RAW_* tabs
// on the Operations Dashboard. But Drive also has MULTIPLE copies of many
// of these forms — different years, "Copy of" duplicates left over from
// whoever set these up. For "VMC Shop Daily Check sheet" alone there are
// at least 4 similarly-named files. Picking the wrong one would silently
// point compliance tracking at a stale sheet with no error, no warning —
// exactly the kind of failure this whole project has been full of
// (hasDataForShift_, sendTelegramAlert, the notifications insert).
//
// The fix is not "guess more carefully" — it's not guessing at all.
// FormApp.getDestinationId() asks Google Forms itself which spreadsheet a
// given form is CURRENTLY linked to. That is authoritative; there is no
// "which copy is real" question once you have the real Form object, because
// the platform is answering, not a filename pattern.
//
// The one thing still needing a person's judgment: which of several
// similarly-named FORM files (not response sheets — the forms themselves
// also get duplicated) is the live one. This script narrows that down
// automatically (excludes anything titled "Copy of ...", ranks by most
// recently modified) but does NOT silently pick — it writes every
// candidate to a sheet for you to glance at and confirm, because that
// judgment call belongs to a person, not to an automated guess.
//
// ⚠ RUN THIS FROM THE OPERATIONS DASHBOARD'S APPS SCRIPT PROJECT (or any
// project with Drive access to these forms) — NOT from ALERT.gs's own
// project. It only reads Drive metadata and Form destinations; it writes
// nothing to any form, response, or existing dashboard data.
//
// USAGE: run resolveFormSheets() once. Check the FORM_SHEET_MAP tab it
// creates in the Operations Dashboard spreadsheet. Each row is one of the
// 24 daily forms; CONFIDENCE is 'high' when exactly one live (non-"Copy of")
// form matched the name, 'REVIEW' when more than one did — those rows need
// you to open the listed candidates and pick the real one by hand. Nothing
// downstream reads this tab until you have looked at every REVIEW row.

var RESOLVE_DASH_ID = '1GHdhrRtOhQFshsAOCK4n3GiJp-6a03k8bn0V_M04wSY';

// Exactly the 24 form names from scripts/ALERT.gs's DEPT_FORM_SEED / the
// live FORM_LINKS tab, kept here as plain data so this script has no
// dependency on ALERT.gs at all.
var FORM_NAMES_TO_RESOLVE = [
  'Cutting PMS', 'Cutting Daily check sheet', 'Cutting Planning', 'Overtime Form',
  'Forge Daily check sheet', 'Forge PMS', 'Forge Shop Planning',
  'Press Daily check sheet', 'Press PMS', 'Press Shop Planning',
  'Machine Daily check sheet', 'Machine PMS', 'Machine Shop Planning',
  'VFPL Sales Dispatch Actual Form', 'Dispatch Plan-Machine Shop',
  'HT Daily check sheet', 'HT PMS', 'HT Shop Planning',
  'Final Daily check sheet', 'Final PMS', 'Final Shop Planning',
  '57F4 Inward Form', '57F4 Outward Form',
  // PATCH_19 additions
  'Maintanance Daily check sheet', 'VFPL Electricity Consumable Form',
  'VFL 24Hrs Electricity Consumable Form', 'VFL Oil Consumable',
  'VMC Shop Daily Check sheet'
];

function resolveFormSheets() {
  var ss = SpreadsheetApp.openById(RESOLVE_DASH_ID);
  var sh = ss.getSheetByName('FORM_SHEET_MAP');
  if (!sh) sh = ss.insertSheet('FORM_SHEET_MAP');
  sh.clearContents();
  sh.clearFormats();

  var headers = ['Form Name', 'Confidence', 'Resolved Sheet ID', 'Resolved Sheet URL',
                 'Form ID Used', 'Form Last Modified', 'Other Candidates (name | id | modified)'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#1565C0').setFontColor('#FFFFFF');

  var rows = [];
  var highConfidence = 0, needsReview = 0, noMatch = 0;

  FORM_NAMES_TO_RESOLVE.forEach(function (formName) {
    // mimeType filter is critical — without it Drive also returns the
    // response SPREADSHEETS (which are often titled similarly, e.g. "VFL
    // VMC Shop Daily Check sheet 2026-2027"), and this must only ever
    // consider actual Form objects.
    var it = DriveApp.searchFiles(
      'title = "' + formName.replace(/"/g, '\\"') + '" and mimeType = "application/vnd.google-apps.form" and trashed = false'
    );
    var candidates = [];
    while (it.hasNext()) candidates.push(it.next());

    // "Copy of X" is a different title than "X", so the exact-title search
    // above already excludes most duplicates. This second filter catches
    // the rarer case of a copy that was later renamed back to the same
    // title as the original.
    var live = candidates.filter(function (f) {
      return f.getName().toLowerCase().indexOf('copy of') !== 0;
    });
    var pool = live.length > 0 ? live : candidates;

    if (pool.length === 0) {
      rows.push([formName, 'NO MATCH', '', '', '', '', 'No form file found with this exact title — check spelling against the live registry.']);
      noMatch++;
      return;
    }

    pool.sort(function (a, b) { return b.getLastUpdated() - a.getLastUpdated(); });
    var chosen = pool[0];

    var destId = '';
    var destUrl = '';
    try {
      var form = FormApp.openById(chosen.getId());
      destId = form.getDestinationId() || '';
      destUrl = destId ? SpreadsheetApp.openById(destId).getUrl() : '(form has no linked response sheet)';
    } catch (err) {
      destUrl = 'ERROR opening form: ' + err;
    }

    var confidence = pool.length === 1 ? 'high' : 'REVIEW';
    if (confidence === 'high') highConfidence++; else needsReview++;

    var others = pool.slice(1).map(function (f) {
      return f.getName() + ' | ' + f.getId() + ' | ' + f.getLastUpdated();
    }).join('  ///  ');

    rows.push([
      formName, confidence, destId, destUrl,
      chosen.getId(), chosen.getLastUpdated(), others
    ]);
  });

  if (rows.length > 0) {
    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sh.autoResizeColumns(1, headers.length);

  Logger.log('✅ FORM_SHEET_MAP built: ' + highConfidence + ' high-confidence, ' +
    needsReview + ' need manual review, ' + noMatch + ' no match found.');
  if (needsReview > 0) {
    Logger.log('⚠️ Open the FORM_SHEET_MAP tab and check every REVIEW row before this feeds anything real.');
  }
}
