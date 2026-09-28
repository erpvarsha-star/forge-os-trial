-- PATCH_59: let an employee record the shift their own check-in resolved to
-- 28 Sep 2026
--
-- employee_shifts writes are is_management()-only (RLS). The 27 Sep
-- "infer shift when none is assigned" insert therefore failed silently for
-- every non-management employee: 39 check-ins since 27 Sep had no shift row
-- and lateness was never evaluated for them. Yash (28 Sep) also made the
-- check-in time override HR's allocation, which needs an update as well.
--
-- SECURITY DEFINER, scoped to the caller's own employee_id, and only for the
-- current working date or the one before it (Shift 3 files under the
-- previous day), so it can't be used to rewrite anyone's shift history.

CREATE OR REPLACE FUNCTION public.set_my_shift_for_date(p_date date, p_shift_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid := public.current_employee_id();
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'not an employee';
  END IF;
  IF p_date NOT IN (v_today, v_today - 1) THEN
    RAISE EXCEPTION 'date out of range';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM shifts WHERE id = p_shift_id) THEN
    RAISE EXCEPTION 'unknown shift';
  END IF;

  INSERT INTO employee_shifts (employee_id, shift_id, date)
  VALUES (v_emp, p_shift_id, p_date)
  ON CONFLICT (employee_id, date) DO UPDATE SET shift_id = EXCLUDED.shift_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_shift_for_date(date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_shift_for_date(date, uuid) TO authenticated;
