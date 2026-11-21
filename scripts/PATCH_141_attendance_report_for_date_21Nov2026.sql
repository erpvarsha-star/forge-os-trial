-- PATCH_141_attendance_report_for_date_21Nov2026.sql
-- Applied live 21 Nov 2026 via the Supabase MCP tool, one statement at a time
-- (this project's "DROP/apply_migration can silently time out" workaround —
-- see PATCH_82 / the "Needs Your Call" build notes in CLAUDE.md).
--
-- WHY: daily_attendance_report (PATCH_74/77) only ever shows TODAY and
-- YESTERDAY (IST) — it's a fixed UNION ALL of
-- (now() AT TIME ZONE 'Asia/Kolkata')::date and that minus 1. An
-- investigation into VFL1453 (18 Nov 2026) found this is a systemic gap:
-- looking up ANY employee's attendance more than 1 day in the past always
-- reads as "not present" in this view (and in the dashboard "today" tiles /
-- useShiftCheckinSummary), even when the real attendance_records row exists
-- and is completely correct.
--
-- Owner-approved fix: an ADDITIVE, date-parameterized lookup so HR/the owner
-- can self-serve check ANY past date in SQL Editor/Table Editor without a
-- Claude round-trip — same self-serve philosophy as the existing 2-day view
-- (CLAUDE.md "Self-serve data review", locked decision from Yash, 6 Oct 2026).
--
-- daily_attendance_report itself is NOT modified or dropped. This is purely
-- additive. Same access pattern as the existing view: SELECT/EXECUTE is
-- granted only to service_role/postgres (dashboard/SQL-Editor access),
-- explicitly revoked from anon/authenticated (Postgres grants EXECUTE on a
-- new function to PUBLIC by default — revoked here so this never becomes
-- reachable from the app's own RLS-gated client queries).

-- 1. Single-date lookup. Same column set, same business rules
--    (check-in/out HH:MM in IST, the no-checkout working-hours default,
--    late_minutes, overtime_hours) as daily_attendance_report, just for an
--    arbitrary date instead of hardcoded today/yesterday.
CREATE OR REPLACE FUNCTION public.attendance_report_for_date(p_date date)
RETURNS TABLE (
  report_date date,
  emp_code text,
  name text,
  department text,
  check_in text,
  check_out text,
  working_hrs numeric,
  late_mins integer,
  overtime_hrs numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_date AS report_date,
    e.emp_code,
    e.name,
    COALESCE(e.department, ''::text) AS department,
    to_char((ar.check_in_time AT TIME ZONE 'Asia/Kolkata'::text), 'HH24:MI'::text) AS check_in,
    to_char((ar.check_out_time AT TIME ZONE 'Asia/Kolkata'::text), 'HH24:MI'::text) AS check_out,
    COALESCE(ar.hours_worked,
        CASE
            WHEN ar.check_in_time IS NOT NULL THEN
            CASE
                WHEN s.name = ANY (ARRAY['General'::text, 'General (Pune)'::text]) THEN 9::numeric
                WHEN s.name = ANY (ARRAY['Shift 4'::text, 'Shift 5'::text]) THEN 12::numeric
                ELSE 8.5
            END
            ELSE NULL::numeric
        END) AS working_hrs,
    ar.late_minutes AS late_mins,
    ar.overtime_hours AS overtime_hrs
  FROM employees e
  LEFT JOIN attendance_records ar ON ar.employee_id = e.id AND ar.date = p_date
  LEFT JOIN employee_shifts es ON es.employee_id = e.id AND es.date = p_date
  LEFT JOIN shifts s ON s.id = es.shift_id
  WHERE e.is_active = true
  ORDER BY e.department, e.name;
$$;

-- 2. Range convenience wrapper (one statement per day, built on #1 so the
--    business rules live in exactly one place).
CREATE OR REPLACE FUNCTION public.attendance_report_for_range(p_start date, p_end date)
RETURNS TABLE (
  report_date date,
  emp_code text,
  name text,
  department text,
  check_in text,
  check_out text,
  working_hrs numeric,
  late_mins integer,
  overtime_hrs numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.*
  FROM generate_series(p_start, p_end, interval '1 day') d(day)
  CROSS JOIN LATERAL public.attendance_report_for_date(d.day::date) r
  ORDER BY r.report_date DESC, r.department, r.name;
$$;

-- 3. Grants — match daily_attendance_report's pattern exactly: dashboard/
--    SQL-Editor access (service_role, postgres) only, never anon/authenticated.
REVOKE ALL ON FUNCTION public.attendance_report_for_date(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attendance_report_for_date(date) FROM anon;
REVOKE ALL ON FUNCTION public.attendance_report_for_date(date) FROM authenticated;
REVOKE ALL ON FUNCTION public.attendance_report_for_range(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attendance_report_for_range(date, date) FROM anon;
REVOKE ALL ON FUNCTION public.attendance_report_for_range(date, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_report_for_date(date) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.attendance_report_for_range(date, date) TO service_role, postgres;

-- VERIFICATION (run 21 Nov 2026, all passed):
-- 1. Grants confirmed via has_function_privilege(): anon=false,
--    authenticated=false, service_role=true, postgres=true on both
--    functions — matches daily_attendance_report's own grants exactly
--    (which show only service_role/postgres, no anon/authenticated row at
--    all, in information_schema.role_table_grants).
-- 2. select * from attendance_report_for_date('2026-11-18')
--    where emp_code='VFL1453';
--    -> {report_date: 2026-11-18, emp_code: VFL1453, name: Laxman Yadav,
--        department: Forge Shop, check_in: 18:48, check_out: 07:00,
--        working_hrs: 12.20, late_mins: null, overtime_hrs: 0.2}
--    Matches the real attendance_records row exactly (check_in_time
--    2026-11-18 13:18:52.874+00 = 18:48 IST; check_out_time
--    2026-11-19 01:30:36.168+00 = 07:00 IST; hours_worked 12.20;
--    overtime_hours 0.2) — this is the concrete proof the fix works.
-- 3. Spot-checked 2026-11-10 for VFL5324/VFL1450/VFL5318: all three
--    matched their real attendance_records rows exactly (check-in/out
--    times, hours_worked, late_minutes, overtime_hours).
--    attendance_report_for_range('2026-11-10','2026-11-18') returned
--    exactly 9 rows for VFL1453 (10th through 18th inclusive).
-- 4. pg_get_viewdef('daily_attendance_report') re-read after this patch —
--    byte-identical to its definition before the patch. Untouched.
