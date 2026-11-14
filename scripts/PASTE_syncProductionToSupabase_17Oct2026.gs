// Open the live Apps Script project -> ALERT.gs -> find `function syncProductionToSupabase()` ->
// replace that whole function (down to its closing brace) with this one -> Save -> run testSupabaseSync once.
// Apply scripts/PATCH_89_production_records_process_dropout_17Oct2026.sql in Supabase FIRST.

// 17 Oct 2026 fix. The old version read each RAW_* tab by column POSITION
// (D=vf_no, E=qty when the tab was 5+ columns wide). That was right for
// Cutting/Final/HT but wrong for Forge/Press/Machine, which carry an extra
// Prod_Type / Process column before VF_No, so vf_no received the production
// type and qty received the VF number -> NaN -> null. Every Forge/Press/
// Machine qty in Supabase was null since April. Columns are now mapped BY
// HEADER NAME (header is row 2, row 1 is blank; found by scanning the first
// 5 rows for "Date" in column A). The old "keep last" dedup also silently
// dropped genuine repeated rows (same date/machine/shift/type/VF, different
// qty), so each repeat now gets an occurrence suffix (|#2, |#3 ...) instead
// and every sheet row becomes its own record. Needs PATCH_89 applied first
// (adds production_records.process + dropout_qty).
function syncProductionToSupabase() {
  var ss = SpreadsheetApp.openById(DASH_ID);
  var rows = [];
  var seen = {};

  // Lower-case and strip spaces/underscores so "VF_No", "VF No", "vfno" match.
  function normHeader_(v) {
    return (v === null || v === undefined ? '' : v.toString()).toLowerCase().replace(/[\s_]+/g, '');
  }
  function colIndex_(headers, names) {
    for (var n = 0; n < names.length; n++) {
      var idx = headers.indexOf(names[n]);
      if (idx !== -1) return idx;
    }
    return -1;
  }
  function parseNum_(raw) {
    if (raw === '' || raw === null || raw === undefined) return null;
    var n = Number(raw);
    return isNaN(n) ? null : n;
  }

  Object.keys(DEPT_TO_DB_DEPARTMENT).forEach(function(dept) {
    if (NON_PRODUCTION_DEPTS[dept]) return;

    var tabName = DEPT_TO_RAW_TAB[dept];
    var sh = tabName ? ss.getSheetByName(tabName) : null;
    if (!sh || sh.getLastRow() < 2) return;

    var values = sh.getDataRange().getValues();

    // Header row = first of the first 5 rows whose column A is "Date".
    var headerRow = -1;
    for (var h = 0; h < Math.min(5, values.length); h++) {
      if (normHeader_(values[h][0]) === 'date') { headerRow = h; break; }
    }
    if (headerRow === -1) {
      Logger.log('⚠️ production_records: no "Date" header in first 5 rows of ' + tabName + ' — tab skipped.');
      return;
    }

    var headers = values[headerRow].map(normHeader_);
    var vfCol = colIndex_(headers, ['vfno']);
    var qtyCol = colIndex_(headers, ['qty']);
    var dropCol = colIndex_(headers, ['dropoutqty']);
    // Prod_Type / Process only counts when it is NOT column B: in RAW_FINAL
    // "Process" IS column B, which is already the unit.
    var processCol = colIndex_(headers, ['prodtype', 'process']);
    if (processCol === 1) processCol = -1;

    var dbDept = DEPT_TO_DB_DEPARTMENT[dept];

    for (var i = headerRow + 1; i < values.length; i++) {
      var r = values[i];
      var dateKey = toDateKey_(r[0]);
      if (!dateKey) continue;

      var unit = (r[1] || '').toString().trim() || null;
      var shift = normaliseShift_(r[2]);
      var vfNo = vfCol !== -1 ? ((r[vfCol] || '').toString().trim() || null) : null;
      var qty = qtyCol !== -1 ? parseNum_(r[qtyCol]) : null;
      var process = processCol !== -1 ? ((r[processCol] || '').toString().trim() || null) : null;
      var dropoutQty = dropCol !== -1 ? parseNum_(r[dropCol]) : null;

      // Cutting/HT/Final have no process, so their keys stay exactly as before.
      var parts = process
        ? [dateKey, dbDept, shift || '', unit || '', process, vfNo || '']
        : [dateKey, dbDept, shift || '', unit || '', vfNo || ''];
      var base = parts.join('|');
      seen[base] = (seen[base] || 0) + 1;
      var rowKey = seen[base] === 1 ? base : base + '|#' + seen[base];

      rows.push({
        row_key: rowKey,
        date: dateKey,
        department: dbDept,
        shift: shift,
        unit: unit,
        vf_no: vfNo,
        qty: qty,
        process: process,
        dropout_qty: dropoutQty
      });
    }
  });

  var sent = supabasePush_('production_records', rows);
  Logger.log('✅ production_records: ' + sent + ' row(s) pushed.');
  return sent;
}
