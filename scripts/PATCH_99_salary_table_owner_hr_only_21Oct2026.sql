-- PATCH_99 — employee_salary_structure SELECT: owner + hr_admin only (21 Oct 2026)
-- Purpose: bank account, IFSC, PAN, UAN and salary amounts in this table were
-- readable by every manager, plant_head, hr_admin and owner, because the only
-- SELECT policy was `employee_id = current_employee_id() OR is_management()`
-- and is_management() = role in (manager, plant_head, hr_admin, owner). That
-- included consultants with role=manager (e.g. CON12). Decision from Yash
-- (owner), 21 Oct 2026: restrict to owner + hr_admin.
--
-- Notes:
--   * The "employee reads own row" branch is intentionally dropped: no shipped
--     screen reads the signed-in user's own row from this table.
--   * The only user-JWT reader is the owner-only app/(owner)/bulk-salary.tsx
--     (still allowed). payroll-run / run-payroll use the service role, and
--     approve_salary_change_request / bulk_apply_salary_changes are SECURITY
--     DEFINER (owned by postgres) — all bypass RLS and are unaffected.
--   * coalesce(..., false): a NULL role (no employee row) denies.
--   * ALTER POLICY is re-runnable; roles are left as-is ({public}).
--
-- Rollback:
--   alter policy employee_salary_structure_select on public.employee_salary_structure
--     using (((employee_id = current_employee_id()) OR is_management()));

alter policy employee_salary_structure_select on public.employee_salary_structure
  using (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false));

-- Verification (run in SQL Editor; counts only, never select sensitive columns):
--   select policyname, cmd, qual from pg_policies
--     where tablename = 'employee_salary_structure';
--   -- Impersonate each role inside a DO block that ends in RAISE EXCEPTION
--   -- (rolls back), e.g.:
--   -- do $$ declare uid uuid; n int; begin
--   --   select auth_user_id into uid from employees where emp_code = 'VFL1545';
--   --   perform set_config('request.jwt.claims',
--   --     json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
--   --   set local role authenticated;
--   --   select count(*) into n from public.employee_salary_structure;
--   --   raise exception 'RESULT rows=%', n; end $$;
--   -- Expected: owner (VFL1001) and hr_admin (VFL5440) = all rows;
--   -- manager (VFL1545, CON12), plant_head (VFL1386), member = 0.
