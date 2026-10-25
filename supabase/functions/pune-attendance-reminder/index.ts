// pune-attendance-reminder — reminds the Pune admin + HR when no Pune attendance exists for today (IST).
// verify_jwt false; idempotent per IST day, so safe for anyone to call. Cron: PATCH_107 (19:00 IST).
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { istDateStr } from '../_shared/istDate.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const db = supabaseAdmin();
    const today = istDateStr();

    const { data: pune, error: pErr } = await db
      .from('employees').select('id, emp_code, department').eq('is_active', true).eq('work_location', 'Pune');
    if (pErr) return jsonResponse({ error: pErr.message }, 500);
    if (!pune?.length) return jsonResponse({ skipped: 'no pune employees' });

    const { count, error: cErr } = await db.from('attendance_records')
      .select('id', { count: 'exact', head: true })
      .eq('date', today).in('employee_id', pune.map((e: any) => e.id));
    if (cErr) return jsonResponse({ error: cErr.message }, 500);
    if ((count ?? 0) > 0) return jsonResponse({ skipped: 'attendance present', date: today });

    const { data: hr, error: hErr } = await db
      .from('employees').select('emp_code').eq('is_active', true).eq('role', 'hr_admin');
    if (hErr) return jsonResponse({ error: hErr.message }, 500);
    const recipients = [...new Set([
      ...pune.filter((e: any) => e.department === 'Administration').map((e: any) => e.emp_code),
      ...(hr ?? []).map((e: any) => e.emp_code),
    ])];
    if (!recipients.length) return jsonResponse({ skipped: 'no recipients', date: today });

    const { data: already } = await db.from('app_notifications').select('employee_code')
      .eq('type', 'pune_attendance_reminder').eq('payload->>date', today).in('employee_code', recipients);
    const done = new Set((already ?? []).map((r: any) => r.employee_code));
    const todo = recipients.filter((c) => !done.has(c));
    if (!todo.length) return jsonResponse({ skipped: 'already reminded', date: today });

    const rows = todo.map((employee_code) => ({
      employee_code, type: 'pune_attendance_reminder',
      title_en: 'Pune attendance pending', title_hi: 'पुणे उपस्थिति बाकी है',
      body_en: `Pune attendance for ${today} has not been entered yet.`,
      body_hi: `${today} की पुणे उपस्थिति अभी दर्ज नहीं की गई है।`,
      payload: { date: today },
    }));
    const { error: iErr } = await db.from('app_notifications').insert(rows);
    if (iErr) return jsonResponse({ error: iErr.message }, 500);

    let pushed = 0, pushError: string | undefined;
    try {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeCodes: todo, type: 'pune_attendance_reminder',
          title: 'Pune attendance pending / पुणे उपस्थिति बाकी है', body: rows[0].body_en, skipInApp: true,
        }),
      });
      if (res.ok) pushed = todo.length; else pushError = `push http ${res.status}`;
    } catch (e) { pushError = String(e); }

    return jsonResponse({ date: today, notified: todo.length, pushed, ...(pushError ? { pushError } : {}) });
  } catch (e) {
    console.error('pune-attendance-reminder failed', e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
