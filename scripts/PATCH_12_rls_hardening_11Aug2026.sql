-- ============================================================================
-- PATCH_12 — close the open RLS holes listed in CLAUDE.md
-- 11 Aug 2026
--
-- These were all flagged as "known RLS issues (not yet fixed)". They matter
-- now rather than later because PIN login (PATCH_10) means 129 real people
-- hold real authenticated sessions — every one of these holes is reachable by
-- any of them from the app, since the anon key ships inside the APK and can
-- be used to call the API directly.
--
-- Every policy below was checked against actual client code first, so none of
-- these break a working feature. The specific writes the app performs are:
--   employees        — no client insert/update at all (new-employee-flow only
--                      SELECTs is_active=false rows)
--   notifications    — no client insert; edge functions write them with the
--                      service role, which bypasses RLS entirely
--   fraud_alerts     — supervisor/team.tsx inserts with employee_id = self
--   fraud_flags      — worker/home.tsx inserts with employee_id = self
--   attendance_records — supervisor/team.tsx upserts only for its own team
--   leave_requests   — supervisor/approvals.tsx updates its own team's rows
--
-- ⚠ RUN IN THE SUPABASE SQL EDITOR. Safe to re-run (drop if exists + create).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. employees INSERT — was: is_management() OR auth.role() = 'authenticated'
--
-- The second branch is true for every signed-in user, making the policy
-- trivially open: any employee could create employee rows (and, since role is
-- just a column, create one with role='owner'). No client code inserts
-- employees at all, so this only ever needed to be management.
-- ---------------------------------------------------------------------------
drop policy if exists "employees_insert_management" on employees;
create policy "employees_insert_management" on employees for insert
  with check (is_management());

-- ---------------------------------------------------------------------------
-- 2. notifications INSERT — was: with check (true)
--
-- Literally anyone could write a notification to anyone. Edge functions use
-- the service role and bypass RLS, so they are unaffected; no client path
-- writes notifications today.
-- ---------------------------------------------------------------------------
drop policy if exists "notifications_insert" on notifications;
create policy "notifications_insert" on notifications for insert
  with check (is_management());

-- Employees must be able to mark their own notifications read. There was no
-- UPDATE policy at all, so the notification bell could never be cleared.
drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own" on notifications for update
  using (user_id = current_employee_id())
  with check (user_id = current_employee_id());

-- ---------------------------------------------------------------------------
-- 3. fraud_alerts / fraud_flags INSERT — were: auth.uid() is not null
--
-- Any authenticated user could fabricate a fraud record against any colleague.
-- Both client call sites insert with employee_id = their own id, so scoping to
-- self (plus management) preserves them exactly.
-- ---------------------------------------------------------------------------
drop policy if exists "fraud_alerts_insert" on fraud_alerts;
create policy "fraud_alerts_insert" on fraud_alerts for insert
  with check (employee_id = current_employee_id() or is_management());

drop policy if exists "fraud_flags_insert" on fraud_flags;
create policy "fraud_flags_insert" on fraud_flags for insert
  with check (employee_id = current_employee_id() or is_management());

-- ---------------------------------------------------------------------------
-- 4. attendance_records write — supervisors were not scoped to their team
--
-- Any supervisor could mark attendance for ANY employee in the company. Now a
-- supervisor may only write rows for their own direct reports (which is all
-- supervisor/team.tsx ever does — it upserts over employees where
-- supervisor_id = self).
--
-- security_guard intentionally stays plant-wide: checkpoint-2 confirmation
-- happens at the gate for everyone, not per team.
-- ---------------------------------------------------------------------------
drop policy if exists "attendance_records_write" on attendance_records;
create policy "attendance_records_write" on attendance_records for all
  using (
    employee_id = current_employee_id()
    or is_management()
    or get_current_employee_role() = 'security_guard'
    or (
      get_current_employee_role() = 'supervisor'
      and employee_id in (select id from employees where supervisor_id = current_employee_id())
    )
  )
  with check (
    employee_id = current_employee_id()
    or is_management()
    or get_current_employee_role() = 'security_guard'
    or (
      get_current_employee_role() = 'supervisor'
      and employee_id in (select id from employees where supervisor_id = current_employee_id())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. leave_requests UPDATE — supervisors were not scoped to their team
--
-- Any supervisor could approve or reject any employee's leave company-wide.
-- ---------------------------------------------------------------------------
drop policy if exists "leave_requests_update" on leave_requests;
create policy "leave_requests_update" on leave_requests for update
  using (
    is_management()
    or (
      get_current_employee_role() = 'supervisor'
      and employee_id in (select id from employees where supervisor_id = current_employee_id())
    )
  )
  with check (
    is_management()
    or (
      get_current_employee_role() = 'supervisor'
      and employee_id in (select id from employees where supervisor_id = current_employee_id())
    )
  );

-- Same hole on advance_requests, which CLAUDE.md's list missed: approvals are
-- money, so scope it identically rather than leaving it wider than leave.
drop policy if exists "advance_requests_update" on advance_requests;
create policy "advance_requests_update" on advance_requests for update
  using (
    is_management()
    or (
      get_current_employee_role() = 'supervisor'
      and employee_id in (select id from employees where supervisor_id = current_employee_id())
    )
  )
  with check (
    is_management()
    or (
      get_current_employee_role() = 'supervisor'
      and employee_id in (select id from employees where supervisor_id = current_employee_id())
    )
  );

-- ---------------------------------------------------------------------------
-- 6. mrm_reviews SELECT — was readable by every authenticated user
--
-- Management review content is not shop-floor-readable. is_management()
-- already covers manager/plant_head/hr_admin/owner, which is exactly the
-- intended audience.
-- ---------------------------------------------------------------------------
drop policy if exists "mrm_reviews_select" on mrm_reviews;
create policy "mrm_reviews_select" on mrm_reviews for select
  using (is_management());

-- ---------------------------------------------------------------------------
-- 7. email_tasks / payroll — spot-check note
--
-- email_tasks_select is already is_management(). payroll_records policies are
-- self-or-management. Both are correct; no change.
--
-- DELETE policies are still deliberately absent everywhere: with no DELETE
-- policy and RLS enabled, deletes are denied by default, which is the audit
-- trail behaviour this system wants. Left as-is on purpose.
-- ---------------------------------------------------------------------------

commit;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- List the policies this patch rewrote and eyeball their expressions:
--   select tablename, policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public'
--     and policyname in (
--       'employees_insert_management','notifications_insert',
--       'notifications_update_own','fraud_alerts_insert','fraud_flags_insert',
--       'attendance_records_write','leave_requests_update',
--       'advance_requests_update','mrm_reviews_select')
--   order by tablename, policyname;
-- ============================================================================
