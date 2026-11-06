-- PATCH_134_security_hardening_06Nov2026.sql
-- Scope: EXACTLY the 3 changes explicitly approved by the owner on 6 Nov 2026.
-- No other table, function, or payroll-related object was touched. No SELECT
-- or ALTER was run against pay_runs, pay_run_items, pay_periods,
-- payroll_adjustments, attendance_records, employees, or any employee/payroll
-- data table.
--
-- Applied live via mcp__Supabase__execute_sql on project odfwtdpvpfzdrznvurru.
-- This file is a record of exactly what ran, for the patch history in
-- CLAUDE.md. Re-running it is safe/idempotent (ALTER FUNCTION ... SET is
-- idempotent; the departments policy uses a plain CREATE POLICY so a re-run
-- would error "already exists" -- that is expected and fine, it means the
-- patch is already applied).

-- ============================================================
-- 1. ALTER FUNCTION ... SET search_path on 17 functions
--    (fixes "function_search_path_mutable" WARN from get_advisors)
--    Exact argument signatures resolved first via:
--      select proname, pg_get_function_identity_arguments(oid) as args
--      from pg_proc
--      where proname = ANY(ARRAY['server_now','auth_employee_id',
--        'auth_department_id','auth_is_management','auth_is_dept_lead',
--        'set_updated_at','auth_role','leave_requests_set_chain',
--        'advance_requests_set_chain','my_turn_leave_requests',
--        'my_turn_advance_requests','review_advance_request',
--        'get_quote_of_the_day','task_role_rank','enforce_pay_run_transition',
--        'lock_finalized_pay_run_items','compute_approval_chain'])
--        and pronamespace = 'public'::regnamespace;
--    -> all 17 are no-arg except review_advance_request(p_id uuid,
--       p_approve boolean, p_note text), task_role_rank(p_role text),
--       compute_approval_chain(p_employee_id uuid, p_kind text) -- no
--       overloads found for any of the 17.
-- ============================================================

ALTER FUNCTION public.server_now() SET search_path = public, pg_temp;
ALTER FUNCTION public.auth_employee_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.auth_department_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.auth_is_management() SET search_path = public, pg_temp;
ALTER FUNCTION public.auth_is_dept_lead() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.auth_role() SET search_path = public, pg_temp;
ALTER FUNCTION public.leave_requests_set_chain() SET search_path = public, pg_temp;
ALTER FUNCTION public.advance_requests_set_chain() SET search_path = public, pg_temp;
ALTER FUNCTION public.my_turn_leave_requests() SET search_path = public, pg_temp;
ALTER FUNCTION public.my_turn_advance_requests() SET search_path = public, pg_temp;
ALTER FUNCTION public.review_advance_request(p_id uuid, p_approve boolean, p_note text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_quote_of_the_day() SET search_path = public, pg_temp;
ALTER FUNCTION public.task_role_rank(p_role text) SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_pay_run_transition() SET search_path = public, pg_temp;
ALTER FUNCTION public.lock_finalized_pay_run_items() SET search_path = public, pg_temp;
ALTER FUNCTION public.compute_approval_chain(p_employee_id uuid, p_kind text) SET search_path = public, pg_temp;

-- ============================================================
-- 2. SELECT-only RLS policy on public.departments
--    Confirmed before adding: 18 rows (small reference table, not empty but
--    low-sensitivity -- department names only), had RLS enabled with ZERO
--    policies (unreadable by anyone, including the app). Repo search
--    (`grep -rn "from('departments')" app/ hooks/ components/ supabase/`)
--    found only 2 references, both in edge functions
--    (mrm-reminder/index.ts, nightly-scoring/index.ts) which use the
--    service-role client and therefore bypass RLS regardless -- no app/
--    hooks/components client-side query depends on this table being
--    readable under a user JWT today, so this is a pure net addition of
--    read access, not a behavior change for any existing code path.
-- ============================================================

create policy departments_select on public.departments for select using (auth.role() = 'authenticated');

-- ============================================================
-- 3. Revoke direct RPC execution of the audit trigger function(s)
--    Confirmed via pg_get_functiondef first that both audit_row_change()
--    and audit_row_change_salary_masked() are trigger functions (body
--    references OLD/NEW/TG_OP via the old/new/TG_TABLE_NAME/TG_OP implicit
--    trigger variables, no normal input parameters) -- safe to revoke
--    direct EXECUTE without affecting their firing AS triggers (which runs
--    regardless of EXECUTE grants).
--
--    NOTE: revoking EXECUTE from anon/authenticated alone is NOT sufficient
--    -- every function also has an implicit EXECUTE grant to PUBLIC, and
--    anon/authenticated inherit PUBLIC's grants. Confirmed live: after
--    revoking from anon/authenticated only, has_function_privilege(...)
--    still returned true for anon on audit_row_change(). The PUBLIC grant
--    had to be revoked too to actually close the direct RPC path.
--    audit_row_change_salary_masked() apparently never had an explicit
--    PUBLIC grant exposed the same way (its anon/authenticated revoke alone
--    already returned false on verification), but both functions get the
--    same explicit PUBLIC revoke here for consistency and to be certain.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_row_change_salary_masked() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_row_change_salary_masked() FROM PUBLIC;

-- ============================================================
-- Verification run after applying (recorded in the session report, not
-- re-run here):
--   select has_function_privilege('anon', 'public.audit_row_change()', 'execute');            -- false
--   select has_function_privilege('authenticated', 'public.audit_row_change()', 'execute');    -- false
--   select has_function_privilege('anon', 'public.audit_row_change_salary_masked()', 'execute');          -- false
--   select has_function_privilege('authenticated', 'public.audit_row_change_salary_masked()', 'execute'); -- false
--   mcp__Supabase__get_advisors(type="security") re-run: the 17
--   function_search_path_mutable WARN findings are gone, the departments
--   rls_enabled_no_policy INFO finding is gone, and audit_row_change is no
--   longer listed under anon_security_definer_function_executable /
--   authenticated_security_definer_function_executable.
-- ============================================================
