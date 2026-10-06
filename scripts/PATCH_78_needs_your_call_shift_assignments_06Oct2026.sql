-- PATCH_78_needs_your_call_shift_assignments_06Oct2026.sql
--
-- Second half of "Needs Your Call": owner resolves employee_shifts rows
-- the system guessed on (inferred for an unassigned check-in, or
-- reclassified for 12h+ overtime) rather than HR allocating. Fraud alert
-- resolution (PATCH_76) was the first half; this is the shift-assignment
-- half, fully designed and reviewed before writing, per Yash's "build it
-- to work without any bugs" instruction.
--
-- Unlike fraud_alerts (which already had a status column to resolve),
-- employee_shifts has never recorded WHO/WHAT set a given row -- HR
-- allocation and system inference/reclassification all look identical.
-- This adds that provenance, a review-outcome trail, and the RPCs to act
-- on it.
--
-- NOTE ON HOW THIS WAS APPLIED: the Supabase MCP deploy tool timed out
-- repeatedly on a single large transaction and on any statement containing
-- DROP FUNCTION (apparently treated as destructive and silently
-- cancelled) -- applied instead as several smaller statements, and the
-- old set_my_shift_for_date(date, uuid) 2-arg overload was left in place
-- but repointed to delegate to the 3-arg version with 'system_inferred',
-- rather than dropped, so no caller can bypass provenance tracking. This
-- file captures the final, intended state as one script for the record.

-- ============================================================================
-- SECTION A -- employee_shifts provenance + review columns
-- ============================================================================

alter table employee_shifts
  add column if not exists assignment_source text not null default 'hr_allocated'
    check (assignment_source in ('hr_allocated', 'system_inferred', 'system_reclassified', 'employee_override')),
  add column if not exists review_outcome text
    check (review_outcome in ('confirmed_correct', 'corrected', 'flagged_for_logic_review')),
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references employees(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists logic_reviewed_at timestamptz;

-- Every existing row (all history to date) becomes 'hr_allocated' by the
-- column default -- including a handful of rows from the last few days
-- that were actually system-inferred/reclassified before this migration
-- existed. Accepted, not fixed: the read view below windows to the last
-- 7 days, so this blind spot ages itself out within a week.

-- ============================================================================
-- SECTION B -- set_my_shift_for_date(): the 3-arg version is the real
-- function; the original 2-arg signature is kept (not dropped) and now
-- delegates to it with 'system_inferred', so every existing caller still
-- gets provenance tracking even before being updated to pass p_source
-- explicitly.
-- ============================================================================

create or replace function public.set_my_shift_for_date(p_date date, p_shift_id uuid, p_source text default 'system_inferred')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp uuid := public.current_employee_id();
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if v_emp is null then
    raise exception 'not an employee';
  end if;
  if p_date not in (v_today, v_today - 1) then
    raise exception 'date out of range';
  end if;
  if not exists (select 1 from shifts where id = p_shift_id) then
    raise exception 'unknown shift';
  end if;
  if p_source not in ('system_inferred', 'system_reclassified', 'employee_override') then
    raise exception 'unknown source: %', p_source;
  end if;
  insert into employee_shifts (employee_id, shift_id, date, assignment_source)
  values (v_emp, p_shift_id, p_date, p_source)
  on conflict (employee_id, date) do update set
    shift_id = excluded.shift_id,
    assignment_source = excluded.assignment_source,
    -- a fresh system decision supersedes any pending owner review of the
    -- old value -- don't leave a stale flagged/corrected row behind a
    -- shift_id that has since moved on.
    review_outcome = null, review_note = null, reviewed_by = null, reviewed_at = null;
end;
$$;

revoke all on function public.set_my_shift_for_date(date, uuid, text) from public, anon;
grant execute on function public.set_my_shift_for_date(date, uuid, text) to authenticated;

create or replace function public.set_my_shift_for_date(p_date date, p_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.set_my_shift_for_date(p_date, p_shift_id, 'system_inferred');
end;
$$;

revoke all on function public.set_my_shift_for_date(date, uuid) from public, anon;
grant execute on function public.set_my_shift_for_date(date, uuid) to authenticated;

-- ============================================================================
-- SECTION C -- allocate_team_shift_week(): same fix on its conflict
-- branch. HR re-allocating a week must explicitly reassert
-- 'hr_allocated' and clear any pending review, or a week HR just
-- re-set could still carry a stale source/flag from before.
-- ============================================================================

create or replace function public.allocate_team_shift_week(
  p_employee_id uuid,
  p_shift_id uuid,
  p_week_start date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := public.current_employee_id();
  v_allocator uuid;
  v_day date;
  v_i int;
begin
  if v_caller is null then
    raise exception 'not an employee';
  end if;

  select shift_allocator_id into v_allocator from employees where id = p_employee_id;
  if v_allocator is null or v_allocator <> v_caller then
    raise exception 'not this employee''s shift allocator';
  end if;

  if not exists (select 1 from shifts where id = p_shift_id) then
    raise exception 'unknown shift';
  end if;

  for v_i in 0..5 loop
    v_day := p_week_start + v_i;
    insert into employee_shifts (employee_id, shift_id, date, assignment_source)
    values (p_employee_id, p_shift_id, v_day, 'hr_allocated')
    on conflict (employee_id, date) do update set
      shift_id = excluded.shift_id,
      assignment_source = 'hr_allocated',
      review_outcome = null, review_note = null, reviewed_by = null, reviewed_at = null;
  end loop;
end;
$$;

-- ============================================================================
-- SECTION D -- resolve_shift_assignment(): the owner's write RPC.
-- ============================================================================

create or replace function public.resolve_shift_assignment(
  p_employee_shift_id uuid,
  p_outcome text,
  p_corrected_shift_id uuid default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if get_current_employee_role() <> 'owner' then
    raise exception 'only the owner can resolve shift assignment flags';
  end if;
  if p_outcome not in ('confirmed_correct', 'corrected', 'flagged_for_logic_review') then
    raise exception 'unknown outcome: %', p_outcome;
  end if;
  if p_outcome = 'corrected' then
    if p_corrected_shift_id is null then
      raise exception 'corrected outcome requires p_corrected_shift_id';
    end if;
    if not exists (select 1 from shifts where id = p_corrected_shift_id) then
      raise exception 'unknown shift';
    end if;
  end if;

  update employee_shifts
    set review_outcome = p_outcome,
        review_note = p_note,
        reviewed_by = current_employee_id(),
        reviewed_at = now(),
        shift_id = case when p_outcome = 'corrected' then p_corrected_shift_id else shift_id end,
        assignment_source = case when p_outcome = 'corrected' then 'employee_override' else assignment_source end
    where id = p_employee_shift_id and review_outcome is null;

  if not found then
    raise exception 'employee_shift row not found, or already reviewed';
  end if;
end;
$$;

revoke all on function public.resolve_shift_assignment(uuid, text, uuid, text) from public, anon;
grant execute on function public.resolve_shift_assignment(uuid, text, uuid, text) to authenticated;

-- ============================================================================
-- SECTION E -- read surface. A service_role/SQL-Editor-only VIEW (same
-- revoke pattern as PATCH_74/75/76 -- views run with the OWNER's
-- privileges for RLS purposes, not the caller's, so this must never be
-- granted to authenticated directly or any employee could read every
-- other employee's flagged items) + an owner-gated RPC the app calls.
-- ============================================================================

create or replace view public.needs_your_call_shifts as
select
  es.id as item_id,
  es.employee_id,
  e.emp_code,
  e.name as employee_name,
  es.assignment_source as subtype,
  case es.assignment_source
    when 'system_inferred' then 'No shift was assigned for ' || to_char(es.date, 'DD Mon') || ' -- system guessed ' || s.name || ' from the check-in time'
    when 'system_reclassified' then 'Reclassified to ' || s.name || ' for ' || to_char(es.date, 'DD Mon') || ' after 12+ hours worked'
    else es.assignment_source
  end as description,
  es.date as occurred_date,
  es.shift_id
from employee_shifts es
join employees e on e.id = es.employee_id
join shifts s on s.id = es.shift_id
where es.assignment_source <> 'hr_allocated'
  and es.review_outcome is null
  and es.date >= (((now() at time zone 'Asia/Kolkata')::date) - 7)
order by es.date desc;

revoke all on public.needs_your_call_shifts from public, anon, authenticated;

create or replace function public.needs_your_call_shifts_for_me()
returns setof public.needs_your_call_shifts
language sql
security definer
stable
set search_path = public
as $$
  select * from public.needs_your_call_shifts
  where get_current_employee_role() = 'owner';
$$;

revoke all on function public.needs_your_call_shifts_for_me() from public, anon;
grant execute on function public.needs_your_call_shifts_for_me() to authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICATION -- all run live 6 Oct 2026 before shipping the UI
-- ---------------------------------------------------------------------------
-- select proname, pronargs from pg_proc where proname in
--   ('resolve_shift_assignment','needs_your_call_shifts_for_me','set_my_shift_for_date','allocate_team_shift_week');
--   -> set_my_shift_for_date exists as BOTH (date,uuid) and (date,uuid,text) -- intentional, see note above.
--
-- Disposable positive + negative test against a real employee_shifts row
-- (reverted after):
--   1. Flipped a real row to assignment_source='system_inferred' ->
--      confirmed it appeared in needs_your_call_shifts with a correct
--      human-readable description ("No shift was assigned for 05 Oct --
--      system guessed Shift 5 from the check-in time").
--   2. Called resolve_shift_assignment(id, 'confirmed_correct', null,
--      'test resolution') -> review_outcome/review_note/reviewed_at set
--      correctly.
--   3. Confirmed the row dropped out of needs_your_call_shifts.
--   4. Re-called resolve_shift_assignment on the same id -> correctly
--      raised "employee_shift row not found, or already reviewed" (the
--      double-resolve guard).
--   5. Reverted the row to its original state (assignment_source=
--      'hr_allocated', review_outcome/review_note/reviewed_by/reviewed_at
--      = null) -- no real data left altered.
