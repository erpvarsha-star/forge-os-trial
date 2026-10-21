-- PATCH_100 — payroll tables: owner + hr_admin only (21 Oct 2026)
-- Purpose: pay runs, pay run items, pay periods, feeds (canteen, society,
-- adjustments, monthly rates), the audit log and documents were readable AND
-- writable (policies are cmd ALL) by every manager, plant_head, hr_admin and
-- owner, because each policy was `is_management()` = role in (manager,
-- plant_head, hr_admin, owner). That included consultants with role=manager
-- (e.g. CON12). Decision from Yash (owner), 21 Oct 2026: restrict to owner +
-- hr_admin, with two carve-outs below.
--
-- Pattern: same as PATCH_99 (employee_salary_structure). ALTER POLICY only,
-- no DROP, so each policy keeps its command scope and roles ({public}).
-- For cmd ALL policies both USING and WITH CHECK are set so writes are closed.
-- coalesce(..., false): a NULL role (no employee row) denies.
--
-- Carve-outs:
--   * payroll_efficiency_entries: plant_head keeps read/write — the plant head
--     enters and reads efficiency % from app/(plant-head)/efficiency.tsx.
--   * payroll_records SELECT: each employee keeps their OWN row — the installed
--     apk-95 Payslip tab reads this table directly.
-- Untouched on purpose: pay_run_items.items_self, documents.docs_self,
-- pt_slabs, employee_status_history, employee_salary_structure (PATCH_99),
-- advance_requests, salary_change_requests. Service-role code (payroll-run)
-- and SECURITY DEFINER functions bypass RLS and are unaffected.

-- A. owner + hr_admin only
alter policy periods_mgmt on public.pay_periods
  using (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false))
  with check (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false));
alter policy pay_mgmt on public.pay_runs
  using (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false))
  with check (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false));
alter policy items_mgmt on public.pay_run_items
  using (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false))
  with check (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false));
alter policy canteen_mgmt on public.payroll_canteen_entries
  using (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false))
  with check (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false));
alter policy society_mgmt on public.payroll_society_recoveries
  using (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false))
  with check (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false));
alter policy adjustments_mgmt on public.payroll_adjustments
  using (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false))
  with check (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false));
alter policy payroll_monthly_rates_select on public.payroll_monthly_rates
  using (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false));
alter policy audit_mgmt on public.audit_log
  using (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false));
alter policy docs_mgmt on public.documents
  using (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false))
  with check (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false));

-- B. carve-out: plant_head keeps efficiency entry
alter policy efficiency_mgmt on public.payroll_efficiency_entries
  using (coalesce(public.get_current_employee_role() in ('owner','hr_admin','plant_head'), false))
  with check (coalesce(public.get_current_employee_role() in ('owner','hr_admin','plant_head'), false));

-- C. carve-out: employees keep their own payroll_records row
alter policy payroll_records_select on public.payroll_records
  using ((employee_id = public.current_employee_id())
         or coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false));

-- Rollback (ORIGINAL text; ALL policies originally had with_check NULL, i.e.
-- USING doubles as WITH CHECK, so re-setting USING only restores that):
--   alter policy periods_mgmt on public.pay_periods using (is_management());
--   alter policy pay_mgmt on public.pay_runs using (is_management());
--   alter policy items_mgmt on public.pay_run_items using (is_management());
--   alter policy canteen_mgmt on public.payroll_canteen_entries using (is_management());
--   alter policy society_mgmt on public.payroll_society_recoveries using (is_management());
--   alter policy adjustments_mgmt on public.payroll_adjustments using (is_management());
--   alter policy payroll_monthly_rates_select on public.payroll_monthly_rates using (is_management());
--   alter policy audit_mgmt on public.audit_log using (is_management());
--   alter policy docs_mgmt on public.documents using (is_management());
--   alter policy efficiency_mgmt on public.payroll_efficiency_entries using (is_management());
--   alter policy payroll_records_select on public.payroll_records
--     using (((employee_id = current_employee_id()) OR is_management()));
--   NOTE: ALTER POLICY cannot null out a WITH CHECK; after rollback the ALL
--   policies keep an explicit WITH CHECK, so also run, for each ALL policy
--   above, `... with check (is_management())` (equivalent to the original).

-- Verification (counts only):
--   select tablename, policyname, cmd, qual, with_check from pg_policies
--     where tablename in ('pay_periods','pay_runs','pay_run_items','audit_log',
--       'payroll_records','payroll_efficiency_entries','documents');
--   -- Impersonate inside a DO block ending in RAISE EXCEPTION (see PATCH_99).
--   -- Expected: hr_admin/owner see all rows; manager, plant_head, member see 0
--   -- of pay_periods/pay_runs/audit_log, only own rows of pay_run_items and
--   -- payroll_records; plant_head can insert payroll_efficiency_entries,
--   -- manager cannot.
