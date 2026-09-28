-- PATCH_62: Shift-allocator relationship + department allocator screens
-- 28 Sep 2026
--
-- Yash uploaded a real weekly shift-planning roster (Shift_Planning_1.csv):
-- 8 department groups, each with one named allocator who sets Shift
-- 1/2/3/General for their group every Thursday, week starting Saturday.
-- Only HR had a shift-assignment screen (app/(hr-admin)/shifts.tsx,
-- unscoped — sees the whole company). This patch adds the data side for
-- giving the other 7 named allocators their own scoped screen.
--
-- Decision from Yash: shift-allocation authority is a SEPARATE
-- relationship from supervisor_id, not a replacement for it — checked
-- live data first and found supervisor_id already correctly serves a
-- different job (attendance confirmation) for several of these same
-- departments, pointing to different people than the CSV's allocators.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. New column: who allocates this employee's weekly shift.
-- ---------------------------------------------------------------------------
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_allocator_id uuid REFERENCES employees(id);

-- ---------------------------------------------------------------------------
-- 2. CON24 Shriram Pawar (Maintenance) — in the CSV, not yet in employees.
-- Same consultant pattern as PATCH_35: role='member' (until/unless a
-- future session gives him a real role), category='consultant', salary=0,
-- no phone/salary given in this sheet so left as PATCH_35 left them.
-- ---------------------------------------------------------------------------
INSERT INTO employees (emp_code, name, department, role, category, salary, is_active, must_change_pin, language_preference, gender)
VALUES ('CON24', 'Shriram Pawar', 'Maintenance', 'member', 'consultant', 0, true, true, 'en', 'male')
ON CONFLICT (emp_code) DO NOTHING;

-- Provision his login — identical mechanics to PATCH_35's consultant loop
-- (synthetic email, PIN = '20' + last 4 digits of the CON number).
DO $$
DECLARE
  v_emp RECORD;
  v_pin TEXT;
  v_email TEXT;
  v_user_id uuid;
BEGIN
  FOR v_emp IN SELECT id, emp_code FROM employees WHERE emp_code = 'CON24' AND auth_user_id IS NULL LOOP
    v_pin := '20' || lpad(regexp_replace(v_emp.emp_code, '\D', '', 'g'), 4, '0');
    v_email := lower(v_emp.emp_code) || '@forgeos.local';

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
      v_email, crypt(v_pin, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}'
    )
    RETURNING id INTO v_user_id;

    UPDATE employees SET auth_user_id = v_user_id WHERE id = v_emp.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. CON12 Sadashiv Soddy — role fixed 'member' -> 'manager'. He's the
-- Quality group's real allocator per the CSV; his role was a PATCH_35
-- blanket-default oversight, not a deliberate decision (confirmed by
-- Yash: "hes consultant and quality manager"). Decision: fix now, full
-- ripple accepted (manager approval chain, team.tsx, mrm.tsx).
-- ---------------------------------------------------------------------------
UPDATE employees SET role = 'manager', updated_at = now()
WHERE emp_code = 'CON12' AND role <> 'manager';

-- ---------------------------------------------------------------------------
-- 4. Populate shift_allocator_id for every person in the CSV, grouped by
-- their department's allocator. Verified live against employees before
-- writing this — all 78 codes (allocators + team members) resolved to a
-- real, active row; CON24 above is the only one that didn't exist yet.
-- ---------------------------------------------------------------------------

-- Group 1: Maintenance — allocator VFL1560 Shaikh Majeed
UPDATE employees SET shift_allocator_id = (SELECT id FROM employees WHERE emp_code = 'VFL1560')
WHERE emp_code IN ('VFL4012','VFL4057','VFL1391','VFL5324','VFL5302','VFL5405','VFL1446','VFL5463','VFL5318','VFL5457','VFL5448','CON24');

-- Group 2: Forge & Cutting — allocator VFL5079 Sudeep Singh
UPDATE employees SET shift_allocator_id = (SELECT id FROM employees WHERE emp_code = 'VFL5079')
WHERE emp_code IN ('VFL4065','VFL4026','VFL4025','VFL4045','VFL4024','VFL4068','VFL4036','VFL4033','VFL4041','VFL4042','VFL4011','VFL4043','VFL1516','VFL5458','VFL5237','VFL1453','VFL5465','VFL5466');

-- Group 3: Press shop — allocator VFL1463 Dinkar Landge
UPDATE employees SET shift_allocator_id = (SELECT id FROM employees WHERE emp_code = 'VFL1463')
WHERE emp_code IN ('VFL1556','VFL5459','VFL5400');

-- Group 4: DIE & VMC Shop — allocator VFL1566 Abhimanyu Kakde
UPDATE employees SET shift_allocator_id = (SELECT id FROM employees WHERE emp_code = 'VFL1566')
WHERE emp_code IN ('VFL5397','VFL5430','VFL5450','VFL1450','VFL5347','VFL5413','VFL4032','VFL4008','VFL5409','CON09','CON01','CON20');

-- Group 5: Machine shop — allocator VFL1528 Bhupendra Kashinath Bharude
UPDATE employees SET shift_allocator_id = (SELECT id FROM employees WHERE emp_code = 'VFL1528')
WHERE emp_code IN ('VFL1272','VFL1290','VFL1327','VFL1543','VFL5303','VFL5273','VFL5272','VFL5321','VFL1549','VFL5382');

-- Group 6: HT Shop — allocator VFL1064 Balasaheb Shivaji Todmal
UPDATE employees SET shift_allocator_id = (SELECT id FROM employees WHERE emp_code = 'VFL1064')
WHERE emp_code IN ('VFL1066','VFL4066','VFL4071','VFL4072');

-- Group 7: Quality — allocator CON12 Sadashiv Nitalaksha Soddy
UPDATE employees SET shift_allocator_id = (SELECT id FROM employees WHERE emp_code = 'CON12')
WHERE emp_code IN ('VFL1562','VFL5449','VFL5452','VFL5461','VFL5433','VFL5399');

-- Group 8: HR — allocator VFL5440 Pallavi Vishnu Khade
UPDATE employees SET shift_allocator_id = (SELECT id FROM employees WHERE emp_code = 'VFL5440')
WHERE emp_code IN ('VFL1482','VFL1520','VFL1527','VFL5322','VFL5439','VFL5444','VFL5460','VFL4063');

-- ---------------------------------------------------------------------------
-- 5. allocate_team_shift_week() — the real security boundary. SECURITY
-- DEFINER, checks the caller is the TARGET employee's shift_allocator_id
-- before writing. Needed because is_management() (role in manager/
-- plant_head/hr_admin/owner) does NOT include 'supervisor' — Sudeep
-- Singh (Forge & Cutting's allocator) would be flatly blocked by the
-- existing employee_shifts_write RLS policy otherwise — and because even
-- for managers, that policy is unscoped (any manager could write shifts
-- for any employee company-wide), which this must not allow.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.allocate_team_shift_week(
  p_employee_id uuid,
  p_shift_id uuid,
  p_week_start date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := public.current_employee_id();
  v_allocator uuid;
  v_day date;
  v_i int;
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

  FOR v_i IN 0..5 LOOP
    v_day := p_week_start + v_i;
    INSERT INTO employee_shifts (employee_id, shift_id, date)
    VALUES (p_employee_id, p_shift_id, v_day)
    ON CONFLICT (employee_id, date) DO UPDATE SET shift_id = EXCLUDED.shift_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_team_shift_week(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_team_shift_week(uuid, uuid, date) TO authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICATION — run after applying
-- ---------------------------------------------------------------------------
-- select emp_code, name, role from employees where emp_code in ('CON12','CON24');
-- select count(*) from employees where shift_allocator_id is not null; -- expect ~78
-- select e.emp_code, e.name, a.emp_code as allocator
--   from employees e join employees a on a.id = e.shift_allocator_id
--   order by a.emp_code, e.emp_code;
