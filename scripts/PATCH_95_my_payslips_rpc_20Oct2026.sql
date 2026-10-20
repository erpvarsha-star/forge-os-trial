-- PATCH_95 — my_payslips(): the logged-in employee's own payslips from the new payroll tables.
-- NOT YET APPLIED — needs owner approval.
--
-- Purpose: the employee Payslip tab used to read payroll_records (old, imported
-- Apr-Aug 2026 data) and showed blank for anything produced by the new pay-run
-- flow. This RPC returns the caller's own pay_run_items (snapshot jsonb) for
-- runs in status archived / paid / finalized, with the month/year of the run.
--
-- Why SECURITY DEFINER: pay_run_items has a self-SELECT policy (items_self), but
-- pay_runs and pay_periods are management-only, so an employee cannot join to
-- them from the client to learn the month/year. The function does the join with
-- owner rights but filters strictly on pay_run_items.employee_id = auth_employee_id()
-- (auth_employee_id() = select id from employees where auth_user_id = auth.uid()),
-- so a caller can only ever see their own rows.

create or replace function public.my_payslips()
returns table (
  pay_run_item_id uuid,
  month text,
  year text,
  run_status text,
  net_pay numeric,
  snapshot jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, pp.month, pp.year, r.status, i.net_pay, i.snapshot
  from pay_run_items i
  join pay_runs r on r.id = i.pay_run_id
  join pay_periods pp on pp.id = r.pay_period_id
  where i.employee_id = auth_employee_id()
    and r.status in ('archived', 'paid', 'finalized')
  order by pp.year desc, pp.month desc;
$$;

revoke all on function public.my_payslips() from public, anon;
grant execute on function public.my_payslips() to authenticated;
