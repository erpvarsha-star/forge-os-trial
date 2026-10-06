/**
 * auto-checkout
 *
 * Yash, 6 Oct 2026: "if they dont check out in 24 hrs then we consider
 * them checked out as per their shift."
 *
 * Finds every `attendance_records` row where `check_in_time` is not null,
 * `check_out_time` is still null, and at least 24h have elapsed since
 * `check_in_time` — plain elapsed-duration math (subtracting two
 * timestamps), one of the few places this project's locked IST rule
 * explicitly allows a bare comparison with no `istDate.ts` helper, since
 * duration math is timezone-invariant by construction (see CLAUDE.md,
 * "IST everywhere").
 *
 * For each match: fills in `check_out_time` / `hours_worked` using the
 * exact same "no checkout = normal full day" convention already locked in
 * 28 Sep 2026 (`lib/workingHours.ts`'s `defaultHoursForShift()` /
 * `effectiveHoursWorked()` — General/General (Pune) = 9h, Shift 4/5 = 12h,
 * everything else = the 8.5h floor), then runs the result through the
 * same shift-finalization + overtime logic a manual checkout uses
 * (`lib/workingHours.ts`'s `finalizeShiftAndOvertime()`, 6 Oct 2026 —
 * reclassifies Shift 1/Shift 3 to Shift 4/Shift 5 once hours_worked hits
 * 12h, same threshold, same "visibility only, never payroll" rule).
 *
 * ⚠ DUPLICATION, ACCEPTED ON PURPOSE: Deno edge functions cannot import
 * from `lib/`, so both of those functions are hand-replicated below —
 * same pattern already used by `scripts/AttendanceReport.gs` for
 * `defaultHoursForShift()`. KEEP ALL THREE COPIES IN SYNC BY HAND if the
 * 8.5/9/12 numbers, the 12h OT threshold, or the Shift1->4 / Shift3->5
 * reclassification ever change.
 *
 * Runs as the service-role client, which bypasses RLS entirely — the
 * `employee_shifts` reclassification write below is management-only under
 * RLS (PATCH_59) for an ordinary authenticated user, but that restriction
 * does not apply here.
 *
 * Intended to run hourly (cron) — same frequency as `shift-reminder`'s
 * default mode and `forms_due_reminder`, the other time-sensitive jobs in
 * this project.
 */

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

// ---------------------------------------------------------------------------
// Hand-replicated from lib/workingHours.ts — see the docstring above.
// ---------------------------------------------------------------------------
const MIN_WORKING_HOURS = 8.5;

function defaultHoursForShift(shiftName: string | null | undefined): number {
  if (shiftName === 'General' || shiftName === 'General (Pune)') return 9;
  if (shiftName === 'Shift 4' || shiftName === 'Shift 5') return 12;
  return MIN_WORKING_HOURS;
}

const OVERTIME_RECLASSIFY_HOURS_THRESHOLD = 12;
const OVERTIME_RECLASSIFY_TARGET: Record<string, string> = {
  'Shift 1': 'Shift 4',
  'Shift 3': 'Shift 5',
};

function finalizeShiftAndOvertime(
  shiftName: string | null | undefined,
  hoursWorked: number
): { reclassifyToShiftName: string | null; overtimeHours: number } {
  const target = shiftName ? OVERTIME_RECLASSIFY_TARGET[shiftName] : undefined;
  if (target && hoursWorked >= OVERTIME_RECLASSIFY_HOURS_THRESHOLD) {
    return {
      reclassifyToShiftName: target,
      overtimeHours: Math.round((hoursWorked - OVERTIME_RECLASSIFY_HOURS_THRESHOLD) * 100) / 100,
    };
  }
  const nominal = defaultHoursForShift(shiftName);
  return {
    reclassifyToShiftName: null,
    overtimeHours: Math.max(0, Math.round((hoursWorked - nominal) * 100) / 100),
  };
}
// ---------------------------------------------------------------------------

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const db = supabaseAdmin();

  try {
    const cutoffIso = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();

    const { data: openRecords, error: fetchError } = await db
      .from('attendance_records')
      .select('id, employee_id, date, check_in_time')
      .not('check_in_time', 'is', null)
      .is('check_out_time', null)
      .lte('check_in_time', cutoffIso);

    if (fetchError) throw fetchError;

    let processed = 0;
    const failures: string[] = [];

    for (const record of openRecords ?? []) {
      try {
        // Today's resolved shift for this record's own date — whatever it
        // was (HR-assigned or inferred), same as a manual checkout reads.
        const { data: employeeShift } = await db
          .from('employee_shifts')
          .select('shift:shifts(name)')
          .eq('employee_id', record.employee_id)
          .eq('date', record.date)
          .maybeSingle();

        const shiftName =
          (employeeShift as { shift?: { name?: string } | null } | null)?.shift?.name ?? null;

        const hoursWorked = defaultHoursForShift(shiftName);
        const checkInTime = new Date(record.check_in_time as string);
        const checkOutTime = new Date(checkInTime.getTime() + hoursWorked * 60 * 60 * 1000);

        const { reclassifyToShiftName, overtimeHours } = finalizeShiftAndOvertime(shiftName, hoursWorked);

        const { error: updateError } = await db
          .from('attendance_records')
          .update({
            check_out_time: checkOutTime.toISOString(),
            hours_worked: hoursWorked,
            overtime_hours: overtimeHours,
          })
          .eq('id', record.id);
        if (updateError) throw updateError;

        if (reclassifyToShiftName) {
          const { data: newShift } = await db
            .from('shifts')
            .select('id')
            .eq('name', reclassifyToShiftName)
            .maybeSingle();
          if (newShift?.id) {
            // Service-role client — bypasses the employee_shifts_write RLS
            // policy (management-only), unlike the client-side checkout
            // flow which goes through set_my_shift_for_date() instead.
            // assignment_source is set explicitly here (not via the RPC's
            // conflict-branch reset logic, PATCH_78) since this is a plain
            // upsert, not set_my_shift_for_date() — Needs Your Call
            // (app/(owner)/needs-your-call.tsx) reads this column to find
            // shifts the system guessed on rather than HR allocating.
            await db
              .from('employee_shifts')
              .upsert(
                { employee_id: record.employee_id, date: record.date, shift_id: newShift.id, assignment_source: 'system_reclassified' },
                { onConflict: 'employee_id,date' }
              );
          }
        }

        processed += 1;
      } catch (err) {
        failures.push(`${record.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return jsonResponse({ checked: openRecords?.length ?? 0, processed, failures });
  } catch (err) {
    console.error('auto-checkout failed', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
