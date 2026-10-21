-- PATCH_101 (21 Oct 2026): fix pay_run_items.items_self so employees can read their own released items.
--
-- Root cause: the items_self policy's EXISTS subquery on pay_runs is itself RLS-filtered.
-- pay_runs is visible only to owner/hr_admin (PATCH_100; management-only before that), so for
-- every other employee the subquery saw no runs and items_self returned 0 rows.
-- (my_payslips() is SECURITY DEFINER, so payslips were never affected.)
--
-- Fix: a SECURITY DEFINER helper that returns only a boolean ("is this run released?"),
-- used by the policy instead of the direct subquery. Additive; no DROP.

create or replace function public.pay_run_is_released(p_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pay_runs r
    where r.id = p_run_id
      and r.status in ('finalized','payment_file_generated','paid','archived')
  );
$$;

revoke execute on function public.pay_run_is_released(uuid) from public;
revoke execute on function public.pay_run_is_released(uuid) from anon;
grant execute on function public.pay_run_is_released(uuid) to authenticated;
grant execute on function public.pay_run_is_released(uuid) to service_role;

alter policy items_self on public.pay_run_items
  using (employee_id = auth_employee_id() and public.pay_run_is_released(pay_run_id));

-- ROLLBACK (original policy text):
--   alter policy items_self on public.pay_run_items
--     using ((employee_id = auth_employee_id()) AND (EXISTS (
--       SELECT 1 FROM pay_runs r
--       WHERE ((r.id = pay_run_items.pay_run_id)
--         AND (r.status = ANY (ARRAY['finalized'::text,'payment_file_generated'::text,'paid'::text,'archived'::text]))))));
--   -- then optionally: revoke all on function public.pay_run_is_released(uuid) from authenticated;
