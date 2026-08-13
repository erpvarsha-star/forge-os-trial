/**
 * shift-reminder
 *
 * Two jobs in one function, both driven by Module 2 (Workforce Management):
 * "HR assigns weekly shifts every Thursday, employees notified immediately."
 *
 * 1. `weekly_shift_notify` (schedule: Thursdays, after HR finishes planning) —
 *    notifies every active employee who has a shift row for the upcoming
 *    Mon-Sun week, and separately alerts HR Admin / Plant Head about any
 *    active employee still missing a shift assignment for that week.
 *
 * 2. `daily_checkin_reminder` (schedule: hourly) — for every shift starting
 *    within the next 30 minutes (per plant_config.form_shift_schedule —
 *    see the note on that key below), reminds the assigned employee to
 *    check in, feeding the late-detection flow in Workflow 1.
 *
 * 3. `forms_due_reminder` (schedule: every 15 minutes) — raises an in-app
 *    notification shortly before each shift's Google Form deadline, per Yash
 *    12 Aug: the Operations Dashboard shift timings are for notifying people
 *    in the app, not for scoring them. Deadlines come from
 *    plant_config.form_shift_schedule; the forms come from form_links
 *    (PATCH_14), so muting a form is a boolean in the table, not a redeploy.
 *
 * POST body: { "mode": "weekly_shift_notify" | "daily_checkin_reminder"
 *                    | "forms_due_reminder" }
 * If omitted, mode is inferred from the current IST day of week — which never
 * infers forms_due_reminder, so that one needs its own cron entry passing
 * {"mode":"forms_due_reminder"} explicitly.
 */

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin, getPlantConfig } from '../_shared/supabaseAdmin.ts';
import { notifyEmployees } from '../_shared/push.ts';

function istNow(): Date {
  const utc = new Date();
  return new Date(utc.getTime() + 5.5 * 60 * 60 * 1000);
}

/**
 * The upcoming Saturday-through-Thursday work week.
 *
 * ⚠ CHANGED 13 Aug 2026. Confirmed with Yash: the real working week is
 * Saturday to Thursday, Friday off — "unless we have urgent production,
 * Friday is working; 90% of the time Friday is off." This used to compute
 * Monday-to-Sunday, which was simply wrong; nothing about a working Friday
 * needed a separate flag, since employee_shifts is already per-date and a
 * working Friday is just a Friday HR assigned shifts for.
 *
 * Called on Thursdays (see the mode-inference at the bottom of this file),
 * the last working day of the CURRENT week, to announce the NEXT week — so
 * "next Saturday" here means the Saturday two days after a Thursday call,
 * matching scripts/ALERT.gs's weekStartFor_(), which computes the same week
 * boundary from the compliance side.
 */
function nextSaturdayToThursday(from: Date): { start: string; end: string } {
  const day = from.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const daysUntilSaturday = ((6 - day) % 7) || 7; // next Saturday, never today
  const start = new Date(from);
  start.setUTCDate(from.getUTCDate() + daysUntilSaturday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 5); // Sat -> Thu is 6 days inclusive
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

async function weeklyShiftNotify(db: ReturnType<typeof supabaseAdmin>) {
  const { start, end } = nextSaturdayToThursday(istNow());

  const { data: assignments } = await db
    .from('employee_shifts')
    .select('employee_id, shift:shifts(name, start_time)')
    .gte('date', start)
    .lte('date', end);

  const employeesWithShift = new Set<string>((assignments ?? []).map((s: { employee_id: string }) => s.employee_id));

  if (employeesWithShift.size > 0) {
    await notifyEmployees(db, {
      employeeIds: Array.from(employeesWithShift),
      type: 'weekly_shift_assigned',
      title: 'Your shift plan is ready',
      body: `Your shifts for ${start} to ${end} have been assigned. Check the Shifts tab.`,
    });
  }

  // Everyone except the owner is expected to have a shift assignment.
  // ⚠ FIXED 13 Aug: this used to also exclude role 'ai_agent' — a role value
  // that only exists in the old, ignored initial_schema.sql. FINAL_SCHEMA's
  // employees.role CHECK constraint has no 'ai_agent' option, so no row can
  // ever have it; the exclusion was a harmless no-op, but it's exactly the
  // kind of stale reference to the old schema CLAUDE.md says to avoid.
  const { data: activeEmployees } = await db
    .from('employees')
    .select('id')
    .eq('is_active', true)
    .neq('role', 'owner');

  const missing = (activeEmployees ?? [])
    .map((e: { id: string }) => e.id)
    .filter((id: string) => !employeesWithShift.has(id));

  if (missing.length > 0) {
    const { data: hrAndPlantHead } = await db
      .from('employees')
      .select('id')
      .in('role', ['hr_admin', 'plant_head'])
      .eq('is_active', true);

    await notifyEmployees(db, {
      employeeIds: (hrAndPlantHead ?? []).map((e: { id: string }) => e.id),
      type: 'shift_gap_alert',
      title: 'Shift plan incomplete',
      body: `${missing.length} active employee(s) have no shift assigned for ${start} to ${end}.`,
    });
  }

  return { weekStart: start, weekEnd: end, notified: employeesWithShift.size, missing: missing.length };
}

interface ShiftWindow {
  shift: string;
  start: string;
  end: string;
  deadline: string;
}

interface FormShiftSchedule {
  lead_minutes: number;
  shifts: ShiftWindow[];
}

/**
 * ⚠ FOUND AND FIXED 13 Aug. This used to read a separate plant_config key,
 * 'shift_start_times', with a hardcoded fallback of
 * {morning:'06:00', evening:'14:00', night:'22:00', general:'09:00'}. Those
 * exact values are the seed from the OLD, ignored
 * supabase/migrations/20260803090000_initial_schema.sql — FINAL_SCHEMA never
 * carried that plant_config row forward, and no patch has ever inserted a
 * 'shift_start_times' key under FINAL_SCHEMA either. So in the real,
 * deployed database this getPlantConfig() call always missed and silently
 * fell back to those stale 06:00/14:00/22:00/09:00 values — which don't
 * match this plant's real shifts (08:30 / 15:30 / 23:30, per
 * plant_config.form_shift_schedule, seeded and live since PATCH_14). Every
 * real `shifts.start_time` this was ever compared against would read
 * "08:30" etc., never "06:00", so `dueStartTimes` could never contain a
 * value that matched anything — this reminder has never fired for anyone.
 * Fixed by reading form_shift_schedule (the one shift-timing source that IS
 * actually seeded under FINAL_SCHEMA) instead of maintaining a second,
 * never-seeded config key in parallel.
 */
async function dailyCheckinReminder(db: ReturnType<typeof supabaseAdmin>) {
  const now = istNow();
  const today = now.toISOString().slice(0, 10);
  const schedule = await getPlantConfig<FormShiftSchedule>(db, 'form_shift_schedule', {
    lead_minutes: 15,
    shifts: [],
  });

  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  // Shifts whose start time falls within the next 30 minutes.
  const dueShifts = (schedule.shifts ?? []).filter((s) => {
    const [h, m] = (s.start ?? '').split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return false;
    const diff = h * 60 + m - nowMinutes;
    return diff >= 0 && diff <= 30;
  });

  if (dueShifts.length === 0) {
    return { today, remindedShiftTypes: [], notified: 0 };
  }

  const dueShiftNames = dueShifts.map((s) => s.shift);
  const dueStartTimes = dueShifts.map((s) => s.start);

  // employee_shifts joined with shifts master — filter by shift start_time
  const { data: assignments } = await db
    .from('employee_shifts')
    .select('employee_id, shift:shifts(name, start_time)')
    .eq('date', today);

  const employeeIds = Array.from(
    new Set<string>(
      (assignments ?? [])
        .filter((a: { shift?: { start_time?: string } }) => dueStartTimes.includes(a.shift?.start_time ?? ''))
        .map((a: { employee_id: string }) => a.employee_id)
    )
  );

  if (employeeIds.length > 0) {
    await notifyEmployees(db, {
      employeeIds,
      type: 'checkin_reminder',
      title: 'Shift starting soon',
      body: 'Your shift starts within 30 minutes. Check in with GPS + QR at the gate.',
    });
  }

  return { today, remindedShiftTypes: dueShiftNames, notified: employeeIds.length };
}

/**
 * Notifies the people responsible for a department's daily Google Forms that
 * the deadline for the shift just ending is close.
 *
 * ⚠ The cron interval must be no coarser than `lead_minutes`, or the window
 * closes between two invocations and the reminder is simply never sent. With
 * the seeded lead of 15 minutes, run this every 15 minutes. Widening the lead
 * in plant_config is the supported way to run it less often — the dedupe
 * below means a wider window still sends exactly one nudge per shift.
 */
async function formsDueReminder(db: ReturnType<typeof supabaseAdmin>) {
  const now = istNow();
  const schedule = await getPlantConfig<FormShiftSchedule>(db, 'form_shift_schedule', {
    lead_minutes: 15,
    shifts: [],
  });

  const lead = Number(schedule.lead_minutes) || 15;
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const dueShifts = (schedule.shifts ?? []).filter((s) => {
    const [h, m] = (s.deadline ?? '').split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return false;

    // A deadline past midnight (Shift 2 ends 23:30, due 00:30) reads as a
    // large negative difference late in the evening; roll it forward a day.
    let diff = h * 60 + m - nowMinutes;
    if (diff < -12 * 60) diff += 24 * 60;

    return diff >= 0 && diff <= lead;
  });

  if (dueShifts.length === 0) {
    return { dueShifts: [], notified: 0 };
  }

  // Only forms still flagged for reminders. A form can stay listed in the app
  // tab (is_active) while being left out of the nudge (send_in_reminder).
  const { data: forms } = await db
    .from('form_links')
    .select('department, form_name')
    .eq('is_active', true)
    .eq('send_in_reminder', true);

  const byDepartment = new Map<string, string[]>();
  for (const f of (forms ?? []) as { department: string; form_name: string }[]) {
    const list = byDepartment.get(f.department) ?? [];
    list.push(f.form_name);
    byDepartment.set(f.department, list);
  }

  if (byDepartment.size === 0) {
    return { dueShifts: dueShifts.map((s) => s.shift), notified: 0 };
  }

  const { data: recipients } = await db
    .from('employees')
    .select('id, department')
    .in('department', Array.from(byDepartment.keys()))
    .in('role', ['supervisor', 'manager'])
    .eq('is_active', true);

  // The IST calendar date the deadline falls on. Because this only runs
  // inside the lead window, "now" is already on the deadline's own day even
  // for the 00:30 one.
  const dateStr = now.toISOString().slice(0, 10);
  let notified = 0;
  const skipped: string[] = [];

  for (const shift of dueShifts) {
    for (const [department, formNames] of byDepartment) {
      const dedupeKey = `${dateStr}|${shift.shift}|${department}`;

      const { data: already } = await db
        .from('notifications')
        .select('id')
        .eq('type', 'form_due_reminder')
        .eq('related_entity_id', dedupeKey)
        .limit(1);

      if (already && already.length > 0) {
        skipped.push(dedupeKey);
        continue;
      }

      const employeeIds = (recipients ?? [])
        .filter((e: { department: string }) => e.department === department)
        .map((e: { id: string }) => e.id);

      if (employeeIds.length === 0) continue;

      const result = await notifyEmployees(db, {
        employeeIds,
        type: 'form_due_reminder',
        title: `${shift.shift} forms due ${shift.deadline}`,
        body:
          `${formNames.length} daily form(s) for ${department} are due by ${shift.deadline}. ` +
          `Open the Forms tab to submit.`,
        relatedEntityType: 'form_links',
        relatedEntityId: dedupeKey,
      });
      notified += result.notified;
    }
  }

  return { dueShifts: dueShifts.map((s) => s.shift), departments: byDepartment.size, notified, skipped };
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  let mode: string | undefined;
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      mode = body?.mode;
    } catch {
      // no body — fall through to inference
    }
  }

  if (!mode) {
    mode = istNow().getUTCDay() === 4 ? 'weekly_shift_notify' : 'daily_checkin_reminder';
  }

  const db = supabaseAdmin();

  try {
    if (mode === 'weekly_shift_notify') {
      return jsonResponse({ mode, ...(await weeklyShiftNotify(db)) });
    }
    if (mode === 'daily_checkin_reminder') {
      return jsonResponse({ mode, ...(await dailyCheckinReminder(db)) });
    }
    if (mode === 'forms_due_reminder') {
      return jsonResponse({ mode, ...(await formsDueReminder(db)) });
    }
    return jsonResponse({ error: 'Unknown mode' }, 400);
  } catch (err) {
    console.error('shift-reminder failed', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
