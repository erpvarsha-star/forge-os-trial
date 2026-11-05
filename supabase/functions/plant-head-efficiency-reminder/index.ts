// plant-head-efficiency-reminder — nudges every active plant_head (role-queried,
// never hardcoded) that the current IST calendar month's worker efficiency %
// has not been entered yet (`payroll_efficiency_entries`), from the 1st of
// the month until a row exists for that `payroll_month`. Stops firing for
// that month the moment a row appears — same "stop once it exists" shape as
// `pune-attendance-reminder`'s own daily check, just monthly instead of
// daily. Built 5 Nov 2026 (round 6), owner: "create plan for this and start
// working at 5.30 am ist on it" (see PENDING.md RESUME STATE "round 6").
//
// Distinct from the existing `plant-head-form-reminder` (nudges about
// Fazal's Google Form "Worker Monthly Efficiency", 1st-5th IST only,
// unrelated to this in-app `payroll_efficiency_entries` row).
//
// `payroll_efficiency_entries.payroll_month` is `text`, format 'YYYY-MM'
// (confirmed live via information_schema.columns before writing this, per
// CLAUDE.md's "verify against live data, don't assume" rule — same format
// used throughout `payroll_canteen_entries`/`payroll_society_recoveries`).
//
// verify_jwt FALSE, same as every reminder-style function in this project —
// the function is its own gate (reads/writes a deduped notification row
// only). Cron job (separate patch file) sends a dummy but PRESENT
// Authorization header — a verify_jwt:false function's gateway only needs
// *some* Authorization header to avoid silently dropping the request before
// it reaches here; the value itself is never checked. This is the exact bug
// `pune-attendance-reminder`'s cron had for 9 days (26 Oct - 4 Nov 2026,
// see CLAUDE.md) — never omit the header.

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { istDateStr, istMonthYear } from '../_shared/istDate.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const db = supabaseAdmin();
    const today = istDateStr();
    const { month, year } = istMonthYear();
    const payrollMonth = `${year}-${month}`; // 'YYYY-MM', matches payroll_efficiency_entries.payroll_month

    const { count, error: eErr } = await db
      .from('payroll_efficiency_entries')
      .select('id', { count: 'exact', head: true })
      .eq('payroll_month', payrollMonth);
    if (eErr) return jsonResponse({ error: eErr.message }, 500);
    if ((count ?? 0) > 0) return jsonResponse({ skipped: 'efficiency already entered', payrollMonth });

    const { data: heads, error: hErr } = await db
      .from('employees').select('emp_code').eq('is_active', true).eq('role', 'plant_head');
    if (hErr) return jsonResponse({ error: hErr.message }, 500);
    const recipients = [...new Set((heads ?? []).map((e: any) => e.emp_code))];
    if (!recipients.length) return jsonResponse({ skipped: 'no plant_head recipients', payrollMonth });

    const { data: already, error: aErr } = await db.from('app_notifications').select('employee_code')
      .eq('type', 'plant_head_efficiency_reminder').eq('payload->>date', today).in('employee_code', recipients);
    if (aErr) return jsonResponse({ error: aErr.message }, 500);
    const done = new Set((already ?? []).map((r: any) => r.employee_code));
    const todo = recipients.filter((c) => !done.has(c));
    if (!todo.length) return jsonResponse({ skipped: 'already reminded', payrollMonth, date: today });

    const bodyEn = `${payrollMonth} worker efficiency % has not been entered yet.`;
    const bodyHi = `${payrollMonth} के लिए वर्कर दक्षता % अभी दर्ज नहीं की गई है।`;

    const rows = todo.map((employee_code) => ({
      employee_code, type: 'plant_head_efficiency_reminder',
      title_en: 'Efficiency % pending', title_hi: 'दक्षता % बाकी है',
      body_en: bodyEn, body_hi: bodyHi,
      payload: { date: today, payrollMonth },
    }));
    const { error: iErr } = await db.from('app_notifications').insert(rows);
    if (iErr) return jsonResponse({ error: iErr.message }, 500);

    let pushed = 0, pushError: string | undefined;
    try {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeCodes: todo, type: 'plant_head_efficiency_reminder',
          title: 'Efficiency % pending / दक्षता % बाकी है', body: bodyEn, skipInApp: true,
        }),
      });
      if (res.ok) pushed = todo.length; else pushError = `push http ${res.status}`;
    } catch (e) { pushError = String(e); }

    return jsonResponse({
      payrollMonth, date: today, notified: todo.length, pushed, ...(pushError ? { pushError } : {}),
    });
  } catch (e) {
    console.error('plant-head-efficiency-reminder failed', e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
