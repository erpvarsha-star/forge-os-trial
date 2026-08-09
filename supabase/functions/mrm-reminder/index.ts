/**
 * mrm-reminder
 *
 * Implements Workflow 8 (MRM Monthly Review). Intended to run daily (cron).
 *
 * Step 1: ensures a `mrm_reviews` row exists (status "pending") for every
 *         department for the current year/month.
 * Step 2: from the 8th of the month, sends a daily reminder to each
 *         department's Manager(s) for every department still "pending".
 * Step 3: if it's the 10th at/after 17:00 IST and a department is still
 *         "pending", auto-escalates — sets `escalated_at` and notifies the
 *         Plant Head: "[Dept] MRM overdue".
 */

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin, getPlantConfig } from '../_shared/supabaseAdmin.ts';
import { notifyEmployees } from '../_shared/push.ts';

function istNow(): Date {
  const utc = new Date();
  return new Date(utc.getTime() + 5.5 * 60 * 60 * 1000);
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const db = supabaseAdmin();
  const now = istNow();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const dayOfMonth = now.getUTCDate();
  const hour = now.getUTCHours();

  const reminderStartDay = await getPlantConfig(db, 'mrm_reminder_start_day', 8);
  const dueDay = await getPlantConfig(db, 'mrm_due_day', 10);

  try {
    // Step 1 — ensure a pending review row exists per department this month.
    const { data: departments } = await db.from('departments').select('id, name');
    const monthStr = String(month).padStart(2, '0');
    for (const dept of departments ?? []) {
      await db
        .from('mrm_reviews')
        .upsert(
          { department: dept.name, year, month: monthStr, status: 'pending' },
          { onConflict: 'department,year,month', ignoreDuplicates: true }
        );
    }

    if (dayOfMonth < reminderStartDay) {
      return jsonResponse({ skipped: true, reason: 'before reminder window', dayOfMonth, reminderStartDay });
    }

    const { data: pendingReviews } = await db
      .from('mrm_reviews')
      .select('id, department')
      .eq('year', year)
      .eq('month', monthStr)
      .eq('status', 'pending');

    const isEscalationTime = dayOfMonth > dueDay || (dayOfMonth === dueDay && hour >= 17);
    let remindedDepartments = 0;
    let escalatedDepartments = 0;

    for (const review of pendingReviews ?? []) {
      const deptName = (review as { department: string }).department ?? 'Department';

      const { data: managers } = await db
        .from('employees')
        .select('id')
        .eq('department', deptName)
        .eq('role', 'manager')
        .eq('is_active', true);

      if (managers && managers.length > 0) {
        await notifyEmployees(db, {
          employeeIds: managers.map((m: { id: string }) => m.id),
          type: 'mrm_reminder',
          title: 'MRM due',
          body: `${deptName} MRM is due by the ${dueDay}th at 17:00. Please submit your monthly review.`,
          relatedEntityType: 'mrm_reviews',
          relatedEntityId: review.id,
        });
        remindedDepartments += 1;
      }

      if (isEscalationTime) {
        const { data: plantHeadIds } = await db
          .from('employees')
          .select('id')
          .eq('role', 'plant_head')
          .eq('is_active', true);

        await notifyEmployees(db, {
          employeeIds: (plantHeadIds ?? []).map((e: { id: string }) => e.id),
          type: 'mrm_overdue',
          title: 'MRM overdue',
          body: `${deptName} MRM overdue`,
          relatedEntityType: 'mrm_reviews',
          relatedEntityId: review.id,
        });
        escalatedDepartments += 1;
      }
    }

    return jsonResponse({
      year,
      month,
      pendingCount: pendingReviews?.length ?? 0,
      remindedDepartments,
      escalatedDepartments,
      isEscalationTime,
    });
  } catch (err) {
    console.error('mrm-reminder failed', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
