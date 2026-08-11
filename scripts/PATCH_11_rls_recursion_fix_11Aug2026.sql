-- ============================================================================
-- PATCH_11 — fix infinite recursion in the employees RLS policies
-- 11 Aug 2026
--
-- SYMPTOM: after a successful PIN login the app sits on the login screen
-- forever with no error. Sign-in itself works (the push-permission prompt
-- appears, which only happens after signInWithPassword returns), but the very
-- next step — loading the employee row — fails.
--
-- CAUSE: FINAL_SCHEMA's RLS helpers
--   current_employee_id()      -> select id   from employees where auth_user_id = auth.uid()
--   get_current_employee_role()-> select role from employees where auth_user_id = auth.uid()
--   is_management()            -> wraps get_current_employee_role()
-- are plain `language sql stable` functions with NO security definer, and they
-- are called from inside the `employees_select` policy ON employees. So:
--
--   select from employees
--     -> employees_select policy
--        -> is_management()
--           -> select from employees
--              -> employees_select policy
--                 -> ... forever
--
-- Postgres aborts with "stack depth limit exceeded" (reproduced locally
-- against these exact definitions). Every employee hits it on every login;
-- it was never noticed earlier only because nobody had ever completed a
-- login before PATCH_10.
--
-- FIX: mark the three helpers SECURITY DEFINER so they read employees with
-- the definer's rights, bypassing RLS and breaking the cycle. This is the
-- standard Supabase pattern for policy helper functions.
--
-- Is that safe? Yes — each function is keyed strictly on auth.uid() and
-- returns only the CALLER's own id/role. A caller learns nothing about anyone
-- else. search_path is pinned on each to prevent search_path hijacking, which
-- matters more for SECURITY DEFINER than for a normal function.
--
-- ⚠ RUN THIS IN THE SUPABASE SQL EDITOR, after PATCH_10.
-- ⚠ Safe to re-run (create or replace only).
-- ============================================================================

begin;

create or replace function current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from employees where auth_user_id = auth.uid();
$$;

create or replace function get_current_employee_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from employees where auth_user_id = auth.uid();
$$;

create or replace function is_management()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(get_current_employee_role() in ('manager','plant_head','hr_admin','owner'), false);
$$;

commit;

-- ============================================================================
-- VERIFICATION — run after applying
-- ============================================================================
-- All three should report security_definer = true:
--   select p.proname, p.prosecdef as security_definer
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('current_employee_id','get_current_employee_role','is_management');
--
-- And this should now return your own row instead of erroring — run it from
-- the app (or the SQL Editor's "run as authenticated user" if available):
--   select emp_code, name, role from employees where auth_user_id = auth.uid();
-- ============================================================================
