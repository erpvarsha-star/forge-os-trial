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
 * POST body: { "mode": "weekly_shift_notify" | "daily_checkin_reminder" }
 * If omitted, mode is inferred from the current IST day of week.
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

  const { data: shifts } = await db
    .from('shifts')
    .select('employee_id, shift_type, shift_date')
    .gte('shift_date', start)
    .lte('shift_date', end);

  const employeesWithShift = new Set<string>((shifts ?? []).map((s: { employee_id: string }) => s.employee_id));

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
  const dueShiftTypes = Object.entries(shiftTimes)
    .filter(([, time]) => {
      const [h, m] = (time as string).split(':').map(Number);
      const startMinutes = h * 60 + m;
      const diff = startMinutes - nowMinutes;
      return diff >= 0 && diff <= 30; // within the next 30 minutes
    })
    .map(([shiftType]) => shiftType);

  if (dueShiftTypes.length === 0) {
    return { today, remindedShiftTypes: [], notified: 0 };
  }

  const { data: shifts } = await db
    .from('shifts')
    .select('employee_id, shift_type')
    .eq('shift_date', today)
    .in('shift_type', dueShiftTypes);

  const employeeIds = Array.from(new Set<string>((shifts ?? []).map((s: { employee_id: string }) => s.employee_id)));

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
    return jsonResponse({ error: 'Unknown mode' }, 400);
  } catch (err) {
    console.error('shift-reminder failed', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
