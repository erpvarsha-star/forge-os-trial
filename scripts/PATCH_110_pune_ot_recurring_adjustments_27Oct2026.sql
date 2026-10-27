-- ============================================================================
-- PATCH_110: Pune OT hours, outstation travel, per-person OT rates,
--            recurring adjustments, Sep-2026 salary increments, BUNG09 advance
-- Date: 2026-10-27
-- Applied by: Kimi (Supabase MCP, project odfwtdpvpfzdrznvurru)
-- Status: APPLIED LIVE and verified 27 Oct 2026
-- REPO COPY IS RECORD-ONLY (already applied live; do NOT re-run). This repo is
-- public, so per CLAUDE.md pay figures and names are redacted below ([redacted]).
-- Structure, functions, columns and constraints are verbatim. The live rows hold
-- the real values.
-- ============================================================================
-- NOTE: PATCH_109 (uses_app flag, attendance_clerk_location, pune_set_attendance
-- v1, uq_attendance_emp_date) and PATCH_109b (pune_attendance_roster v1) were
-- applied live without patch files. This patch SUPERSEDES both functions with
-- their final versions below. If 109/109b were never committed, commit their
-- column adds alongside this file:
--   ALTER TABLE employees ADD COLUMN IF NOT EXISTS attendance_clerk_location text;
--   ALTER TABLE employees ADD COLUMN IF NOT EXISTS uses_app boolean NOT NULL DEFAULT true;
--   UPDATE employees SET attendance_clerk_location='Pune' WHERE emp_code='VFL1567';
--   UPDATE employees SET uses_app=false WHERE emp_code LIKE 'BUNG%';
--   CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_emp_date ON attendance_records(employee_id, date);
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Attendance: OT hours + outstation travel (entered by Pune clerk next day)
-- ----------------------------------------------------------------------------
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS ot_hours numeric NOT NULL DEFAULT 0;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS outstation_travel boolean NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- 2. Per-person flat OT rate on the salary structure (Pune/BUNG only)
--    BUNG30 / BUNG33: flat hourly rates [redacted]
--    (NOT formula-based; confirmed by owner 27 Oct 2026)
-- ----------------------------------------------------------------------------
ALTER TABLE employee_salary_structure ADD COLUMN IF NOT EXISTS ot_rate numeric;
UPDATE employee_salary_structure s SET ot_rate = /*redacted*/ NULL FROM employees e WHERE s.employee_id=e.id AND e.emp_code='BUNG30' AND s.is_active;
UPDATE employee_salary_structure s SET ot_rate = /*redacted*/ NULL FROM employees e WHERE s.employee_id=e.id AND e.emp_code='BUNG33' AND s.is_active;

-- ----------------------------------------------------------------------------
-- 3. recurring_adjustments: fixed monthly earnings/deductions NOT part of
--    salary structure (e.g. VFL1567's fixed allowance, paid every month,
--    kept OUTSIDE statutory gross per the sheet practice)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recurring_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  kind text NOT NULL CHECK (kind IN ('earning','deduction')),
  label text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  active_from date NOT NULL,
  active_to date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recurring_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recur_mgmt ON recurring_adjustments;
CREATE POLICY recur_mgmt ON recurring_adjustments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM employees e WHERE e.auth_user_id = auth.uid() AND e.role IN ('owner','hr_admin','plant_head')));

-- VFL1567 fixed monthly allowance [redacted] from October 2026
INSERT INTO recurring_adjustments (employee_id, kind, label, amount, active_from)
SELECT id, 'earning', 'Fixed monthly allowance (other)', /*redacted*/ 1, '2026-10-01'::date
FROM employees WHERE emp_code='VFL1567'
AND NOT EXISTS (SELECT 1 FROM recurring_adjustments r WHERE r.employee_id = employees.id AND r.label='Fixed monthly allowance (other)');

-- ----------------------------------------------------------------------------
-- 4. pune_set_attendance FINAL (5-arg; replaces 3-arg overload which was DROPPED)
--    Adds OT hours + outstation travel. Defaults keep old 3-arg app calls working.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.pune_set_attendance(uuid, date, text);
CREATE OR REPLACE FUNCTION public.pune_set_attendance(p_employee_id uuid, p_date date, p_status text, p_ot_hours numeric DEFAULT 0, p_outstation_travel boolean DEFAULT false)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
     OR p_date < (now() AT TIME ZONE 'Asia/Kolkata')::date - 7 THEN
    RAISE EXCEPTION 'date out of range: today and previous 7 days only';
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

-- ----------------------------------------------------------------------------
-- 5. pune_attendance_roster FINAL: returns saved ot_hours + outstation_travel
--    so a status-only re-save can prefill and never wipe OT/travel data
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS pune_attendance_roster(date);
CREATE OR REPLACE FUNCTION public.pune_attendance_roster(p_date date)
 RETURNS TABLE(employee_id uuid, emp_code text, name text, status text, check_in_time timestamp with time zone, ot_hours numeric, outstation_travel boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_loc text;
BEGIN
  SELECT attendance_clerk_location INTO v_loc FROM employees WHERE auth_user_id = auth.uid();
  IF v_loc IS NULL THEN
    RAISE EXCEPTION 'not an attendance clerk';
  END IF;

  RETURN QUERY
  SELECT e.id, e.emp_code, e.name, ar.status, ar.check_in_time,
         COALESCE(ar.ot_hours, 0), COALESCE(ar.outstation_travel, false)
  FROM employees e
  LEFT JOIN attendance_records ar ON ar.employee_id = e.id AND ar.date = p_date
  WHERE e.work_location = v_loc AND e.is_active
  ORDER BY e.emp_code;
END $function$;

-- ----------------------------------------------------------------------------
-- 6. DATA FIX (applied 27 Oct 2026): Sep-2026 salary increments.
--    Old rows closed effective_to 2026-08-31 (Claude set their effective_from
--    to 2026-04-01, commit 5a4f02a). New rows effective 2026-09-01:
--      VFL1389, VFL1556, VFL1566, VFL5322, VFL5442: new basic/CTC rows [redacted]
--      VFL5464: NEW record, effective 2026-07-26 (none existed) [redacted]
--    Full component splits are in the live rows; source = owner's
--    "VFL Employee Salary Sheet 2026 Onwards" (Sep 2026 tab).
--
-- 7. DATA FIX (applied 27 Oct 2026): BUNG09 advance
--    advance_requests row: amount [redacted] (given 13 Mar 2026),
--    monthly_deduction [redacted], outstanding_balance [redacted], status approved.
--    Mar-Sep already recovered via sheets; Oct/Nov/Dec recover in app.
-- ----------------------------------------------------------------------------
