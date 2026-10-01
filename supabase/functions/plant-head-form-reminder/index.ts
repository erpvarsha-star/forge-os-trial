/**
 * plant-head-form-reminder
 *
 * Yash, 30 Sep 2026: a new Google Form (`form_links`, department='MANAGEMENT')
 * was added for Fazal Ilahi Khan (plant_head, VFL1386) "to be filled by 5th
 * of every month" — with an explicit request for a notification sent to him
 * from the 1st to the 5th.
 *
 * Intended to run daily (cron, 09:00 IST, matching mrm-reminder's
 * convention). On the 1st-5th IST (inclusive) of each month, sends one
 * in-app + push reminder per active plant_head per still-undismissed form —
 * in practice just Fazal and just this one form today, but scoped generally
 * (role='plant_head', every MANAGEMENT-department form_links row with
 * send_in_reminder=true) so a second plant_head or a second monthly form
 * later doesn't need a new function, just a form_links row.
 *
 * De-duplicated against `notifications` the same way mrm-reminder's
 * escalation is (no extra schema column): related_entity_type='form_links',
 * related_entity_id=`${form.id}:${istDateStr()}`, so a job that fires more
 * than once on the same IST day — or a cron misfire — cannot double-notify.
 */

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { notifyEmployees } from '../_shared/push.ts';
import { istNow, istDateStr } from '../_shared/istDate.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const db = supabaseAdmin();
  const now = istNow();
  const dayOfMonth = now.getUTCDate();
  const today = istDateStr();

  if (dayOfMonth < 1 || dayOfMonth > 5) {
    return jsonResponse({ skipped: true, reason: 'outside 1st-5th reminder window', dayOfMonth });
  }

  try {
    const { data: forms } = await db
      .from('form_links')
      .select('id, form_name, url')
      .eq('department', 'MANAGEMENT')
      .eq('is_active', true)
      .eq('send_in_reminder', true);

    const { data: plantHeads } = await db
      .from('employees')
      .select('id')
      .eq('role', 'plant_head')
      .eq('is_active', true);

    let notified = 0;

    for (const form of forms ?? []) {
      const relatedEntityId = `${form.id}:${today}`;

      const { data: alreadySent } = await db
        .from('notifications')
        .select('id')
        .eq('type', 'monthly_form_reminder')
        .eq('related_entity_id', relatedEntityId)
        .limit(1);

      if (alreadySent && alreadySent.length > 0) continue;
      if (!plantHeads || plantHeads.length === 0) continue;

      await notifyEmployees(db, {
        employeeIds: plantHeads.map((e: { id: string }) => e.id),
        type: 'monthly_form_reminder',
        title: 'Monthly form due',
        body: `${form.form_name} is due by the 5th. Please fill it in.`,
        relatedEntityType: 'form_links',
        relatedEntityId,
      });
      notified += 1;
    }

    return jsonResponse({ dayOfMonth, formsChecked: forms?.length ?? 0, notified });
  } catch (err) {
    console.error('plant-head-form-reminder failed', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
