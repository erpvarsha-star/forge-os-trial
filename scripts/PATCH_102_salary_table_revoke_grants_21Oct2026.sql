-- PATCH_102 — employee_salary_structure: revoke excess table privileges (21 Oct 2026)
-- Decision from owner. RLS already blocked these (PATCH_99 limits SELECT rows to owner/hr_admin);
-- this removes the privileges themselves as defence in depth.
--   anon          : ALL privileges revoked
--   authenticated : everything revoked except SELECT
--   postgres / service_role : untouched (payroll-run, run-payroll, payroll-feed-sync use service role;
--     approve_salary_change_request and bulk_apply_salary_changes are SECURITY DEFINER, owner postgres)
-- Only user-JWT access in the app: SELECT in app/(owner)/bulk-salary.tsx (still permitted).
-- Applied live 21 Oct 2026. Plain REVOKEs, no DROP.

revoke all privileges on table public.employee_salary_structure from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.employee_salary_structure from authenticated;

-- Verify:
-- select grantee, string_agg(privilege_type, ',' order by privilege_type)
--   from information_schema.role_table_grants
--  where table_schema='public' and table_name='employee_salary_structure' group by grantee;

-- ROLLBACK (restores the original grants):
-- grant delete, insert, references, select, trigger, truncate, update
--   on table public.employee_salary_structure to anon;
-- grant delete, insert, references, trigger, truncate, update
--   on table public.employee_salary_structure to authenticated;
