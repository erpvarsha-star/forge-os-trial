-- PATCH_135_daily_shift_allocation_12Nov2026.sql
--
-- Owner decision, 12 Nov 2026 (CLAUDE.md "Owner decisions of 12 Nov 2026
-- (second batch)"): VFL1560 (Shaikh Majeed, Maintenance) and VFL1566
-- (Abhimanyu Kakde, VMC Shop) want to allocate shifts to their team DAILY
-- instead of weekly. Every other allocator (the other 6 named in
-- Shift_Planning_1.csv, plus HR's own unscoped screen) is completely
-- untouched — this is a 2-person carve-out, data-driven via a new column,
-- not two hardcoded emp_codes in app code.
--
-- Mirrors allocate_team_shift_week()'s exact security check
-- (scripts/PATCH_62_shift_allocator_28Sep2026.sql) — same grants, same
-- shift_allocator_id = current_employee_id() boundary — just one date
-- instead of six.

BEGIN;

-- 1. New column, default 'weekly' so every existing allocator is byte-
--    identical to before this patch.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS shift_allocation_mode text NOT NULL DEFAULT 'weekly'
    CHECK (shift_allocation_mode IN ('weekly', 'daily'));

-- 2. Flip only the two named employees.
UPDATE employees SET shift_allocation_mode = 'daily'
WHERE emp_code IN ('VFL1560', 'VFL1566');

-- 3. allocate_team_shift_day() — same security boundary as
--    allocate_team_shift_week(), single date instead of a 6-day week.
CREATE OR REPLACE FUNCTION public.allocate_team_shift_day(
  p_employee_id uuid,
  p_shift_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.current_employee_id();
  v_allocator uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not an employee';
  END IF;

  SELECT shift_allocator_id INTO v_allocator FROM employees WHERE id = p_employee_id;
  IF v_allocator IS NULL OR v_allocator <> v_caller THEN
    RAISE EXCEPTION 'not this employee''s shift allocator';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shifts WHERE id = p_shift_id) THEN
    RAISE EXCEPTION 'unknown shift';
  END IF;

  INSERT INTO employee_shifts (employee_id, shift_id, date)
  VALUES (p_employee_id, p_shift_id, p_date)
  ON CONFLICT (employee_id, date) DO UPDATE SET shift_id = EXCLUDED.shift_id;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_team_shift_day(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_team_shift_day(uuid, uuid, date) TO authenticated;

COMMIT;
