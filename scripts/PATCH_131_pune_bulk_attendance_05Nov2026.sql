-- PATCH_131_pune_bulk_attendance_05Nov2026.sql
--
-- Owner decision, 5 Nov 2026 (exact words): "build bulk upload and retain 3 days window."
--
-- Kajal (VFL1567, Pune attendance clerk) needs to enter a whole past month's
-- BUNG* home-worker attendance in one pass. The existing single-date screen
-- (components/PuneAttendance.tsx + pune_set_attendance) only ever let her
-- reach back MAX_DAYS_BACK days — on 5 Nov 2026 that left her unable to
-- enter 1-28 Oct at all.
--
-- This patch:
--   1. Tightens pune_set_attendance's lookback window from 7 days to 3 days
--      (the new bulk flow below is the real catch-up mechanism now, so the
--      single-date screen goes back to being for same-day/near-term entry).
--   2. Adds pune_bulk_set_attendance() — enter a whole month in one RPC call,
--      scoped to the previous-calendar-month-through-today IST window,
--      all-or-nothing on validation, never overwrites a punched row.
--   3. Adds pune_bulk_attendance_status() — a read-only companion so the new
--      UI can show what's already on file for an employee+month before the
--      clerk edits anything (RLS on attendance_records does not let a
--      member-role clerk SELECT other employees' rows directly, so this has
--      to go through a SECURITY DEFINER RPC, same as everything else in the
--      pune_* family).
--
-- Both new functions use the exact same caller/location checks as the
-- existing pune_set_attendance/pune_attendance_roster (attendance_clerk_location
-- must be set on the caller; the target employee's work_location must match
-- it) and the same "never overwrite a punched row" rule.
--
-- Safe to re-run: pune_set_attendance's statement is CREATE OR REPLACE FUNCTION
-- (it keeps its exact existing signature, so this is a no-conflict replace,
-- not a drop).
--
-- ⚠ LIVE-APPLY NOTE (5 Nov 2026): the two new functions below use OUT
-- parameter names (entry_date, not date) chosen to avoid a real plpgsql
-- ambiguity bug caught during live testing — "date" as an OUT parameter name
-- collides with attendance_records.date inside the function body's
-- INSERT/SELECT statements ("column reference \"date\" is ambiguous").
-- The first live CREATE used "date" as the OUT column (per this file's
-- earlier draft) and was broken; fixing it needed a different RETURNS TABLE
-- shape, which Postgres refuses as CREATE OR REPLACE ("cannot change return
-- type of existing function") and needs a DROP FUNCTION instead. Same known
-- issue as elsewhere in this project (see "Fraud alerts" / "Needs Your
-- Call" sections of CLAUDE.md): the Supabase MCP tool's DROP FUNCTION call
-- times out waiting for a confirmation that never arrives in this session.
-- Worked around the same way this project has before: ALTER FUNCTION ...
-- RENAME TO pune_bulk_set_attendance_v1_broken / pune_bulk_attendance_status_v1_broken
-- (freeing the real name) + REVOKE EXECUTE on the renamed copies, then
-- CREATE FUNCTION (not REPLACE) under the real names with the fixed
-- entry_date-named signature below. The two *_v1_broken functions are left
-- live but inert (execute revoked from PUBLIC/authenticated; nothing
-- references them) — ask the owner to run
-- `drop function public.pune_bulk_set_attendance_v1_broken(uuid, jsonb); drop function public.pune_bulk_attendance_status_v1_broken(uuid, date);`
-- in the SQL Editor when convenient, same as the other owner-run drops this
-- project already has pending. On the live project the two functions below
-- were actually applied with plain CREATE FUNCTION (the names were freed by
-- the rename above); this file keeps CREATE OR REPLACE so a fresh
-- environment that has never seen the broken first draft can still apply it
-- in one pass.

-- ============================================================================
-- 1. Tighten pune_set_attendance's lookback window: 7 days -> 3 days
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pune_set_attendance(
  p_employee_id uuid,
  p_date date,
  p_status text,
  p_ot_hours numeric DEFAULT 0,
  p_outstation_travel boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller employees%ROWTYPE;
  v_target employees%ROWTYPE;
  v_id uuid;
  v_existed boolean;
BEGIN
  SELECT * INTO v_caller FROM employees WHERE auth_user_id = auth.uid();
  IF NOT FOUND OR v_caller.attendance_clerk_location IS NULL THEN
    RAISE EXCEPTION 'not an attendance clerk';
  END IF;

  SELECT * INTO v_target FROM employees WHERE id = p_employee_id;
  IF NOT FOUND OR v_target.work_location IS DISTINCT FROM v_caller.attendance_clerk_location THEN
    RAISE EXCEPTION 'employee not in your location';
  END IF;

  IF p_status NOT IN ('P','L','HL','WO') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  IF p_date > (now() AT TIME ZONE 'Asia/Kolkata')::date
     OR p_date < (now() AT TIME ZONE 'Asia/Kolkata')::date - 3 THEN
    RAISE EXCEPTION 'date out of range: today and previous 3 days only';
  END IF;

  IF p_ot_hours < 0 THEN
    RAISE EXCEPTION 'invalid OT hours';
  END IF;

  IF EXISTS (SELECT 1 FROM attendance_records
             WHERE employee_id = p_employee_id AND date = p_date
               AND check_in_time IS NOT NULL) THEN
    RAISE EXCEPTION 'row already has a punch; cannot overwrite';
  END IF;

  SELECT EXISTS (SELECT 1 FROM attendance_records
                 WHERE employee_id = p_employee_id AND date = p_date) INTO v_existed;

  INSERT INTO attendance_records (employee_id, date, status, ot_hours, outstation_travel)
  VALUES (p_employee_id, p_date, p_status, p_ot_hours, p_outstation_travel)
  ON CONFLICT (employee_id, date) DO UPDATE SET
    status = EXCLUDED.status,
    ot_hours = EXCLUDED.ot_hours,
    outstation_travel = EXCLUDED.outstation_travel
  RETURNING id INTO v_id;

  INSERT INTO audit_log (actor_employee_id, table_name, row_id, action, new_values)
  VALUES (v_caller.id, 'attendance_records', v_id,
          CASE WHEN v_existed THEN 'update' ELSE 'insert' END,
          jsonb_build_object('employee_id', p_employee_id, 'date', p_date, 'status', p_status,
                             'ot_hours', p_ot_hours, 'outstation_travel', p_outstation_travel,
                             'via', 'pune_set_attendance'));

  RETURN v_id;
END
$function$;

-- ============================================================================
-- 2. pune_bulk_set_attendance — enter a whole past month in one call
-- ============================================================================
-- p_entries: jsonb array of {"date":"YYYY-MM-DD","status":"P"|"L"|"HL"|"WO",
--            "ot_hours":number (optional, default 0),
--            "outstation_travel":boolean (optional, default false)}
--
-- Allowed date range: first day of the PREVIOUS calendar month (IST) through
-- today (IST) inclusive. All entries are validated before anything is
-- written; an invalid entry raises (naming the offending date) and rolls
-- back the whole call. A date whose row already has a punch (check_in_time
-- set) is skipped, not raised — the rest of the batch still applies.
CREATE OR REPLACE FUNCTION public.pune_bulk_set_attendance(
  p_employee_id uuid,
  p_entries jsonb
)
RETURNS TABLE(entry_date date, applied boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller employees%ROWTYPE;
  v_target employees%ROWTYPE;
  v_today date;
  v_lower date;
  v_entry jsonb;
  v_date date;
  v_status text;
  v_ot numeric;
  v_travel boolean;
  v_existing_checkin timestamptz;
  v_existed boolean;
  v_id uuid;
BEGIN
  SELECT * INTO v_caller FROM employees WHERE auth_user_id = auth.uid();
  IF NOT FOUND OR v_caller.attendance_clerk_location IS NULL THEN
    RAISE EXCEPTION 'not an attendance clerk';
  END IF;

  SELECT * INTO v_target FROM employees WHERE id = p_employee_id;
  IF NOT FOUND OR v_target.work_location IS DISTINCT FROM v_caller.attendance_clerk_location THEN
    RAISE EXCEPTION 'employee not in your location';
  END IF;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_entries) = 0 THEN
    RAISE EXCEPTION 'no entries provided';
  END IF;

  v_today := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_lower := date_trunc('month', v_today - interval '1 month')::date;

  -- Validation pass: every entry must be well-formed before anything is written.
  -- (An exception anywhere aborts the whole function call and rolls back
  -- every write already made inside it, but this pass additionally ensures
  -- no partial audit_log scanning happens for a batch that is going to fail.)
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    BEGIN
      v_date := (v_entry->>'date')::date;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid or missing date in entry: %', v_entry;
    END;

    v_status := v_entry->>'status';
    v_ot := COALESCE((v_entry->>'ot_hours')::numeric, 0);

    IF v_date IS NULL THEN
      RAISE EXCEPTION 'invalid or missing date in entry: %', v_entry;
    END IF;

    IF v_date > v_today OR v_date < v_lower THEN
      RAISE EXCEPTION 'date out of range: % (allowed % through % — previous calendar month through today)', v_date, v_lower, v_today;
    END IF;

    IF v_status IS NULL OR v_status NOT IN ('P','L','HL','WO') THEN
      RAISE EXCEPTION 'invalid status % for date %', v_status, v_date;
    END IF;

    IF v_ot < 0 THEN
      RAISE EXCEPTION 'invalid OT hours for date %', v_date;
    END IF;
  END LOOP;

  -- Apply pass.
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_date := (v_entry->>'date')::date;
    v_status := v_entry->>'status';
    v_ot := COALESCE((v_entry->>'ot_hours')::numeric, 0);
    v_travel := COALESCE((v_entry->>'outstation_travel')::boolean, false);

    SELECT ar.check_in_time INTO v_existing_checkin
    FROM attendance_records ar
    WHERE ar.employee_id = p_employee_id AND ar.date = v_date;

    IF v_existing_checkin IS NOT NULL THEN
      entry_date := v_date;
      applied := false;
      reason := 'already has a punch; skipped';
      RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM attendance_records ar WHERE ar.employee_id = p_employee_id AND ar.date = v_date
    ) INTO v_existed;

    INSERT INTO attendance_records (employee_id, date, status, ot_hours, outstation_travel)
    VALUES (p_employee_id, v_date, v_status, v_ot, v_travel)
    ON CONFLICT (employee_id, date) DO UPDATE SET
      status = EXCLUDED.status,
      ot_hours = EXCLUDED.ot_hours,
      outstation_travel = EXCLUDED.outstation_travel
    RETURNING id INTO v_id;

    INSERT INTO audit_log (actor_employee_id, table_name, row_id, action, new_values)
    VALUES (v_caller.id, 'attendance_records', v_id,
            CASE WHEN v_existed THEN 'update' ELSE 'insert' END,
            jsonb_build_object('employee_id', p_employee_id, 'date', v_date, 'status', v_status,
                               'ot_hours', v_ot, 'outstation_travel', v_travel,
                               'via', 'pune_bulk_set_attendance'));

    entry_date := v_date;
    applied := true;
    reason := NULL;
    RETURN NEXT;
  END LOOP;

  RETURN;
END
$function$;

GRANT EXECUTE ON FUNCTION public.pune_bulk_set_attendance(uuid, jsonb) TO authenticated;

-- ============================================================================
-- 3. pune_bulk_attendance_status — read-only, existing rows for employee+month
-- ============================================================================
-- RLS on attendance_records does not let a member-role clerk SELECT other
-- employees' rows directly (attendance_records_select is
-- employee_id = current_employee_id() OR is_management() OR a supervisor's
-- own team — a Pune clerk is neither), so the bulk-entry UI reads existing
-- rows through this SECURITY DEFINER RPC instead of a direct table select.
CREATE OR REPLACE FUNCTION public.pune_bulk_attendance_status(
  p_employee_id uuid,
  p_month date
)
RETURNS TABLE(entry_date date, status text, check_in_time timestamptz, ot_hours numeric, outstation_travel boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller employees%ROWTYPE;
  v_target employees%ROWTYPE;
  v_month_start date;
  v_month_end date;
BEGIN
  SELECT * INTO v_caller FROM employees WHERE auth_user_id = auth.uid();
  IF NOT FOUND OR v_caller.attendance_clerk_location IS NULL THEN
    RAISE EXCEPTION 'not an attendance clerk';
  END IF;

  SELECT * INTO v_target FROM employees WHERE id = p_employee_id;
  IF NOT FOUND OR v_target.work_location IS DISTINCT FROM v_caller.attendance_clerk_location THEN
    RAISE EXCEPTION 'employee not in your location';
  END IF;

  v_month_start := date_trunc('month', p_month)::date;
  v_month_end := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;

  RETURN QUERY
  SELECT ar.date AS entry_date, ar.status, ar.check_in_time,
         COALESCE(ar.ot_hours, 0), COALESCE(ar.outstation_travel, false)
  FROM attendance_records ar
  WHERE ar.employee_id = p_employee_id
    AND ar.date BETWEEN v_month_start AND v_month_end;
END
$function$;

GRANT EXECUTE ON FUNCTION public.pune_bulk_attendance_status(uuid, date) TO authenticated;
