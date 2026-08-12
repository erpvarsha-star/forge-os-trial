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
 *    within the next 30 minutes (per plant_config.shift_start_times),
 *    reminds the assigned employee to check in, feeding the late-detection
 *    flow in Workflow 1.
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

function nextMondayToSunday(from: Date): { start: string; end: string } {
  const day = from.getUTCDay(); // 0 = Sunday
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const start = new Date(from);
  start.setUTCDate(from.getUTCDate() + daysUntilMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

async function weeklyShiftNotify(db: ReturnType<typeof supabaseAdmin>) {
  const { start, end } = nextMondayToSunday(istNow());

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

  const { data: activeEmployees } = await db
    .from('employees')
    .select('id')
    .eq('is_active', true)
    .not('role', 'in', '(owner,ai_agent)');

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

async function dailyCheckinReminder(db: ReturnType<typeof supabaseAdmin>) {
  const now = istNow();
  const today = now.toISOString().slice(0, 10);
  const shiftTimes = await getPlantConfig(db, 'shift_start_times', {
    morning: '06:00',
    evening: '14:00',
    night: '22:00',
    general: '09:00',
  });

  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  // Find shift names whose start_time falls within the next 30 minutes.
  const dueTimes = Object.entries(shiftTimes).filter(([, time]) => {
    const [h, m] = (time as string).split(':').map(Number);
    const diff = h * 60 + m - nowMinutes;
    return diff >= 0 && diff <= 30;
  });

  if (dueTimes.length === 0) {
    return { today, remindedShiftTypes: [], notified: 0 };
  }

  const dueShiftTypes = dueTimes.map(([shiftType]) => shiftType);
  const dueStartTimes = dueTimes.map(([, time]) => time as string);

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

  return { today, remindedShiftTypes: dueShiftTypes, notified: employeeIds.length };
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
