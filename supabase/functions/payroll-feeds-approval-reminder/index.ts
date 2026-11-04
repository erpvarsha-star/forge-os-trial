// payroll-feeds-approval-reminder — nudges HR when any payroll_canteen_entries
// / payroll_society_recoveries rows, for any payroll_month, are still sitting
// at approval_status != 'approved'. Built 4 Nov 2026, owner said "yes"
// (see CLAUDE.md "Owner instruction of 4 Nov 2026" — complete pending items).
//
// verify_jwt FALSE, same as every other reminder-style function in this
// project (pune-attendance-reminder, plant-head-form-reminder, shift-reminder,
// mrm-reminder) — the API gateway does not check Authorization for these at
// all, so the function is its own gate (it only ever reads + writes a
// deduped notification row, same safety argument every other reminder here
// already relies on).
//
// ⚠ Cron header lesson (found 4 Nov 2026 in pune-attendance-reminder, see
// scripts/PATCH_107_pune_attendance_reminder_cron_25Oct2026.sql's correction
// comment): a verify_jwt:false function still needs the gateway to see SOME
// Authorization header, or the gateway silently drops the request before it
// ever reaches here — the value itself is never checked. The cron job for
// this function (PATCH_128) sends 'Bearer no-auth-required', same dummy
// value auto-checkout's cron already uses. Never schedule this function's
// cron with headers that omit Authorization entirely.
//
// Scope (confirmed, do not widen without asking): HR admins ONLY — never the
// owner or plant_head for this one. Dedup: one notification per HR admin per
// IST calendar day while any pending rows exist; if nothing is pending, send
// nothing (same as pune-attendance-reminder's own "skipped" early-return).
//
// ⚠ "Current payroll_month" is NOT "the current IST calendar month" — found
// live, 4 Nov 2026, while verifying this function for real: `payroll_month`
// tracks which PAY PERIOD a feed row belongs to, not the calendar month it
// was entered in. HR's own Payroll Feeds screen (`app/(hr-admin)/payroll-
// feeds.tsx`) defaults its month picker to the current IST month but lets
// HR navigate it back — and the real, live pending rows (31 canteen + 20
// society, entered 2 Nov 2026) are tagged `payroll_month='2026-10'` because
// HR is still clearing out October's run's feeds in early November. Filtering
// this reminder to the literal current calendar month ('2026-11') would have
// made it silently fire nothing for exactly the real, live case it exists to
// catch. So this function checks EVERY payroll_month with pending rows, not
// just one — correct both for this exact situation and for whenever HR is
// mid-way through more than one month's feeds at once.

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { istDateStr } from '../_shared/istDate.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const db = supabaseAdmin();
    const today = istDateStr();

    const { data: canteenRows, error: cErr } = await db
      .from('payroll_canteen_entries').select('payroll_month')
      .neq('approval_status', 'approved');
    if (cErr) return jsonResponse({ error: cErr.message }, 500);

    const { data: societyRows, error: sErr } = await db
      .from('payroll_society_recoveries').select('payroll_month')
      .neq('approval_status', 'approved');
    if (sErr) return jsonResponse({ error: sErr.message }, 500);

    const pendingCanteen = canteenRows?.length ?? 0;
    const pendingSociety = societyRows?.length ?? 0;
    const totalPending = pendingCanteen + pendingSociety;
    if (totalPending === 0) return jsonResponse({ skipped: 'nothing pending' });

    const months = [...new Set([
      ...(canteenRows ?? []).map((r: any) => r.payroll_month),
      ...(societyRows ?? []).map((r: any) => r.payroll_month),
    ])].sort();
    const monthList = months.join(', ');

    // HR admins only — queried by role, never hardcoded (same pattern as
    // plant-head-form-reminder's role query). Owner/plant_head deliberately
    // excluded from recipients for this reminder (confirmed scope).
    const { data: hr, error: hErr } = await db
      .from('employees').select('emp_code').eq('is_active', true).eq('role', 'hr_admin');
    if (hErr) return jsonResponse({ error: hErr.message }, 500);
    const recipients = [...new Set((hr ?? []).map((e: any) => e.emp_code))];
    if (!recipients.length) return jsonResponse({ skipped: 'no hr_admin recipients', months });

    const { data: already, error: aErr } = await db.from('app_notifications').select('employee_code')
      .eq('type', 'payroll_feeds_approval_reminder').eq('payload->>date', today).in('employee_code', recipients);
    if (aErr) return jsonResponse({ error: aErr.message }, 500);
    const done = new Set((already ?? []).map((r: any) => r.employee_code));
    const todo = recipients.filter((c) => !done.has(c));
    if (!todo.length) return jsonResponse({ skipped: 'already reminded', months, date: today });

    const bodyEn = `${totalPending} canteen/society entries are awaiting your approval for ${monthList} ` +
      `(${pendingCanteen} canteen, ${pendingSociety} society).`;
    const bodyHi = `${monthList} के लिए ${totalPending} कैंटीन/सोसाइटी प्रविष्टियाँ आपकी मंज़ूरी का इंतज़ार कर रही हैं ` +
      `(${pendingCanteen} कैंटीन, ${pendingSociety} सोसाइटी)।`;

    const rows = todo.map((employee_code) => ({
      employee_code, type: 'payroll_feeds_approval_reminder',
      title_en: 'Payroll feeds awaiting approval', title_hi: 'पेरोल फ़ीड मंज़ूरी का इंतज़ार कर रही हैं',
      body_en: bodyEn, body_hi: bodyHi,
      payload: { date: today, months, pendingCanteen, pendingSociety, totalPending },
    }));
    const { error: iErr } = await db.from('app_notifications').insert(rows);
    if (iErr) return jsonResponse({ error: iErr.message }, 500);

    let pushed = 0, pushError: string | undefined;
    try {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeCodes: todo, type: 'payroll_feeds_approval_reminder',
          title: 'Payroll feeds awaiting approval / पेरोल फ़ीड मंज़ूरी का इंतज़ार कर रही हैं',
          body: bodyEn, skipInApp: true,
        }),
      });
      if (res.ok) pushed = todo.length; else pushError = `push http ${res.status}`;
    } catch (e) { pushError = String(e); }

    return jsonResponse({
      date: today, months, pendingCanteen, pendingSociety, totalPending,
      notified: todo.length, pushed, ...(pushError ? { pushError } : {}),
    });
  } catch (e) {
    console.error('payroll-feeds-approval-reminder failed', e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
