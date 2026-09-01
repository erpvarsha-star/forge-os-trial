/**
 * convertQuotationXlsToSheets.gs
 *
 * WHY THIS EXISTS
 * ---------------
 * The quotation archive in Drive is mostly legacy .xls (Excel 97-2003).
 * Claude's Drive connector can read .xlsx cleanly but returns
 * "unsupported mime type" for .xls, so ~39 of the ~50 quotation files
 * cannot be extracted into the Quotation Master without a conversion step.
 *
 * This script converts every .xls in the quotation folder(s) into a native
 * Google Sheet, IN PLACE, leaving the original .xls untouched. Once run,
 * every quotation becomes machine-readable and the Quotation Master can be
 * completed for all customers.
 *
 * HOW TO RUN (one paste, one authorise, one click)
 * ------------------------------------------------
 *   1. script.google.com -> New project
 *   2. Paste this whole file over Code.gs
 *   3. Run -> convertQuotationXlsToSheets
 *   4. Authorise when prompted (Drive access)
 *   5. Watch the log. It prints one line per file.
 *
 * SAFE TO RE-RUN. It skips any file that already has a converted twin,
 * so a second run after a timeout picks up exactly where it stopped.
 *
 * NOTHING IS SHARED PUBLICLY. Converted copies inherit the folder's
 * existing permissions - no link-sharing, no public exposure of pricing.
 */

// Quotation folders. Folder A is the main 2022-2024 archive; folder B is the
// older vfl.npd@gmail.com set.
var QUOTE_FOLDER_IDS = [
  '1E-JKk1wR8Y9GlUFlzWq97BzcPjzNG0LB',
  '1-dNwM6BPxlWEftmiULyW7TuUJqhiIl5c'
];

// Converted files get this suffix so the original and the copy are
// distinguishable at a glance, and so re-runs can detect prior work.
var CONVERTED_SUFFIX = ' [GSHEET]';

var XLS_MIME = 'application/vnd.ms-excel';

function convertQuotationXlsToSheets() {
  var totals = { scanned: 0, converted: 0, skipped: 0, failed: 0 };

  QUOTE_FOLDER_IDS.forEach(function (folderId) {
    var folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      Logger.log('FOLDER NOT ACCESSIBLE: ' + folderId + ' -> ' + e.message);
      return;
    }

    Logger.log('--- Folder: ' + folder.getName() + ' (' + folderId + ') ---');

    // Build the set of names already converted, so re-runs are idempotent.
    var alreadyDone = {};
    var existing = folder.getFiles();
    while (existing.hasNext()) {
      var name = existing.next().getName();
      if (name.indexOf(CONVERTED_SUFFIX) !== -1) {
        alreadyDone[name] = true;
      }
    }

    var files = folder.getFilesByType(XLS_MIME);
    while (files.hasNext()) {
      var file = files.next();
      totals.scanned++;

      var targetName = file.getName() + CONVERTED_SUFFIX;
      if (alreadyDone[targetName]) {
        Logger.log('SKIP (already converted): ' + file.getName());
        totals.skipped++;
        continue;
      }

      try {
        // Drive.Files.copy with a Google Sheets mimeType performs the
        // conversion server-side. This is the step the connector's plain
        // copy cannot do.
        Drive.Files.copy(
          {
            title: targetName,
            parents: [{ id: folderId }],
            mimeType: MimeType.GOOGLE_SHEETS
          },
          file.getId()
        );
        Logger.log('CONVERTED: ' + file.getName());
        totals.converted++;
      } catch (e) {
        Logger.log('FAILED: ' + file.getName() + ' -> ' + e.message);
        totals.failed++;
      }
    }
  });

  Logger.log(
    '\n=== DONE ===\nscanned: ' + totals.scanned +
    '\nconverted: ' + totals.converted +
    '\nskipped (already done): ' + totals.skipped +
    '\nfailed: ' + totals.failed
  );

  if (totals.failed > 0) {
    Logger.log('Re-run to retry the failures - converted files are skipped.');
  }

  return totals;
}

/**
 * REQUIRED ONE-TIME SETUP inside the Apps Script editor:
 *
 *   Services (+) -> Drive API -> v2 -> Add
 *
 * This script uses the advanced Drive service (Drive.Files.copy) because it
 * is the only call that converts .xls to a native Google Sheet. DriveApp's
 * own makeCopy() preserves the original format and does NOT convert - that
 * was verified directly before writing this.
 *
 * If you see "Drive is not defined", the service above has not been added.
 */

/**
 * Optional: undo. Trashes every [GSHEET] copy this script created,
 * leaving all originals intact. Use only if you want to start over.
 */
function undoConvertQuotationXlsToSheets() {
  var trashed = 0;
  QUOTE_FOLDER_IDS.forEach(function (folderId) {
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    while (files.hasNext()) {
      var f = files.next();
      if (f.getName().indexOf(CONVERTED_SUFFIX) !== -1) {
        f.setTrashed(true);
        Logger.log('TRASHED: ' + f.getName());
        trashed++;
      }
    }
  });
  Logger.log('Trashed ' + trashed + ' converted copies. Originals untouched.');
  return trashed;
}
