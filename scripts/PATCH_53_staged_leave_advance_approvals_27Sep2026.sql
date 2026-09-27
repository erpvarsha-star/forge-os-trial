-- PATCH_53 — staged multi-role approval chains for leave_requests and
-- advance_requests (27 Sep 2026, session continuation)
--
-- Replaces the old flat pending/approved/rejected model (any single
-- management-role person could approve, and every approval screen queried
-- unscoped "all pending") with a per-requester-category ordered chain,
-- mirroring the already-proven salary_change_requests staged pattern.
--
-- Design frozen in CLAUDE.md ("Leave & Advance approval chains — frozen
-- 27 Sep 2026"). Confirmed with a live query before writing this: zero
-- pending leave_requests, zero pending advance_requests exist right now —
-- this migration has no in-flight requests to disrupt.
--
-- Chains by requester's own role/department (computed in
-- compute_approval_chain() below):
--   member/supervisor/security_guard  leave: manager -> hr_admin -> plant_head
--                                     advance: manager -> hr_admin -> accounts -> plant_head -> owner
--   hr_admin (own)                    leave: plant_head
--                                     advance: accounts -> plant_head -> owner
--   manager (own, not Accounts dept)  leave: hr_admin -> plant_head
--                                     advance: hr_admin -> accounts -> plant_head -> owner
--   manager in Accounts dept (own)    leave: hr_admin -> plant_head
--                                     advance: hr_admin -> plant_head -> owner  (accounts stage skipped — they ARE accounts)
--   plant_head (own)                  leave: owner       advance: owner
--   owner (own)                       leave: none (auto) advance: none (auto)
--
-- "accounts" stage is a dynamic role+department match (role='manager' AND
-- department='Accounts'), not a hardcoded employee id — decided 27 Sep 2026,
-- so it keeps working if that seat changes hands.

-- ============================================================================
-- SECTION A — schema: chain columns on both request tables
-- ============================================================================

alter table leave_requests
  add column if not exists approval_chain text[],
  add column if not exists current_stage integer not null default 0;

alter table advance_requests
  add column if not exists approval_chain text[],
  add column if not exists current_stage integer not null default 0;

-- ============================================================================
-- SECTION B — audit trail for every stage action (approve or reject)
-- ============================================================================

create table if not exists request_stage_actions (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('leave', 'advance')),
  request_id uuid not null,
  stage_role text not null,
  actor_id uuid references employees(id),
  action text not null check (action in ('approved', 'rejected')),
  note text,
  acted_at timestamptz default now()
);

create index if not exists idx_request_stage_actions_request on request_stage_actions(request_type, request_id);

alter table request_stage_actions enable row level security;

drop policy if exists request_stage_actions_select on request_stage_actions;
create policy request_stage_actions_select on request_stage_actions
  for select using (is_management());
-- No insert/update/delete policy for regular clients — only the
-- SECURITY DEFINER review RPCs below write to this table (they run as the
-- function owner and bypass RLS), matching this project's convention of
-- never letting the client write audit/approval state directly.

-- ============================================================================
-- SECTION C — compute_approval_chain(): the one place the chain rules live
-- ============================================================================

create or replace function compute_approval_chain(p_employee_id uuid, p_kind text)
returns text[]
language plpgsql
stable
as $$
declare
  v_role text;
  v_dept text;
begin
  select role, department into v_role, v_dept from employees where id = p_employee_id;

  if v_role = 'owner' then
    return array[]::text[];
  elsif v_role = 'plant_head' then
    return array['owner'];
  elsif v_role = 'hr_admin' then
    if p_kind = 'leave' then
      return array['plant_head'];
    else
      return array['accounts', 'plant_head', 'owner'];
    end if;
  elsif v_role = 'manager' then
    if p_kind = 'leave' then
      return array['hr_admin', 'plant_head'];
    elsif v_dept = 'Accounts' then
      return array['hr_admin', 'plant_head', 'owner'];
    else
      return array['hr_admin', 'accounts', 'plant_head', 'owner'];
    end if;
  else
    -- member, supervisor, security_guard
    if p_kind = 'leave' then
      return array['manager', 'hr_admin', 'plant_head'];
    else
      return array['manager', 'hr_admin', 'accounts', 'plant_head', 'owner'];
    end if;
  end if;
end;
$$;

-- ============================================================================
-- SECTION D — insert triggers: auto-populate the chain on every new request
-- ============================================================================

create or replace function leave_requests_set_chain()
returns trigger
language plpgsql
as $$
begin
  if new.approval_chain is null then
    new.approval_chain := compute_approval_chain(new.employee_id, 'leave');
    new.current_stage := 0;
    if array_length(new.approval_chain, 1) is null then
      -- Owner's own request — no gate, auto-recorded.
      new.status := 'approved';
      new.approved_by := new.employee_id;
      new.approved_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leave_requests_set_chain on leave_requests;
create trigger trg_leave_requests_set_chain
  before insert on leave_requests
  for each row execute function leave_requests_set_chain();

create or replace function advance_requests_set_chain()
returns trigger
language plpgsql
as $$
begin
  if new.approval_chain is null then
    new.approval_chain := compute_approval_chain(new.employee_id, 'advance');
    new.current_stage := 0;
    if array_length(new.approval_chain, 1) is null then
      -- Owner's own request — no gate, auto-recorded.
      new.status := 'approved';
      new.approved_by := new.employee_id;
      new.approved_at := now();
      new.outstanding_balance := new.amount;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_advance_requests_set_chain on advance_requests;
create trigger trg_advance_requests_set_chain
  before insert on advance_requests
  for each row execute function advance_requests_set_chain();

-- ============================================================================
-- SECTION E — "my turn" read functions: one place the stage-matching logic
-- lives, so every approval screen queries the same way instead of each
-- re-implementing who's authorized right now (the ambiguous-embed bug's
-- lesson: duplicated query logic across screens drifts and breaks silently).
-- SECURITY DEFINER so they can join employees or the target for
-- manager_id-comparisons even though the caller's own SELECT grant on
-- employees is limited to what RLS otherwise exposes.
-- ============================================================================

create or replace function my_turn_leave_requests()
returns table (
  id uuid,
  employee_id uuid,
  emp_code text,
  name text,
  department text,
  type text,
  start_date date,
  end_date date,
  days numeric,
  reason text,
  created_at timestamptz,
  current_stage integer,
  approval_chain text[],
  stage_role text
)
language sql
security definer
stable
as $$
  select
    lr.id, lr.employee_id, e.emp_code, e.name, e.department,
    lr.type, lr.start_date, lr.end_date, lr.days, lr.reason,
    lr.created_at, lr.current_stage, lr.approval_chain,
    lr.approval_chain[lr.current_stage + 1] as stage_role
  from leave_requests lr
  join employees e on e.id = lr.employee_id
  where lr.status = 'pending'
    and lr.current_stage < coalesce(array_length(lr.approval_chain, 1), 0)
    and (
      (lr.approval_chain[lr.current_stage + 1] = 'manager' and e.manager_id = current_employee_id())
      or (lr.approval_chain[lr.current_stage + 1] = 'hr_admin' and get_current_employee_role() = 'hr_admin')
      or (lr.approval_chain[lr.current_stage + 1] = 'plant_head' and get_current_employee_role() = 'plant_head')
      or (lr.approval_chain[lr.current_stage + 1] = 'owner' and get_current_employee_role() = 'owner')
    )
  order by lr.created_at asc;
$$;

create or replace function my_turn_advance_requests()
returns table (
  id uuid,
  employee_id uuid,
  emp_code text,
  name text,
  department text,
  amount numeric,
  reason text,
  repayment_months integer,
  created_at timestamptz,
  current_stage integer,
  approval_chain text[],
  stage_role text
)
language sql
security definer
stable
as $$
  select
    ar.id, ar.employee_id, e.emp_code, e.name, e.department,
    ar.amount, ar.reason, ar.repayment_months,
    ar.created_at, ar.current_stage, ar.approval_chain,
    ar.approval_chain[ar.current_stage + 1] as stage_role
  from advance_requests ar
  join employees e on e.id = ar.employee_id
  where ar.status = 'pending'
    and ar.current_stage < coalesce(array_length(ar.approval_chain, 1), 0)
    and (
      (ar.approval_chain[ar.current_stage + 1] = 'manager' and e.manager_id = current_employee_id())
      or (ar.approval_chain[ar.current_stage + 1] = 'hr_admin' and get_current_employee_role() = 'hr_admin')
      or (
        ar.approval_chain[ar.current_stage + 1] = 'accounts'
        and get_current_employee_role() = 'manager'
        and (select department from employees where id = current_employee_id()) = 'Accounts'
      )
      or (ar.approval_chain[ar.current_stage + 1] = 'plant_head' and get_current_employee_role() = 'plant_head')
      or (ar.approval_chain[ar.current_stage + 1] = 'owner' and get_current_employee_role() = 'owner')
    )
  order by ar.created_at asc;
$$;

-- ============================================================================
-- SECTION F — review RPCs: the only way a stage can be advanced/rejected.
-- Re-derives authorization server-side (never trusts that a row merely
-- appeared in my_turn_* — a stale client list is not an authorization
-- check), so these are safe to call directly.
-- ============================================================================

create or replace function review_leave_request(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_chain text[];
  v_stage integer;
  v_employee_id uuid;
  v_stage_role text;
  v_authorized boolean := false;
  v_manager_id uuid;
  v_my_role text;
begin
  select approval_chain, current_stage, employee_id
    into v_chain, v_stage, v_employee_id
    from leave_requests
    where id = p_id and status = 'pending'
    for update;

  if v_chain is null or v_stage >= coalesce(array_length(v_chain, 1), 0) then
    raise exception 'Request is not awaiting approval';
  end if;

  v_stage_role := v_chain[v_stage + 1];
  v_my_role := get_current_employee_role();

  if v_stage_role = 'manager' then
    select manager_id into v_manager_id from employees where id = v_employee_id;
    v_authorized := (v_manager_id = current_employee_id());
  elsif v_stage_role = 'hr_admin' then
    v_authorized := (v_my_role = 'hr_admin');
  elsif v_stage_role = 'plant_head' then
    v_authorized := (v_my_role = 'plant_head');
  elsif v_stage_role = 'owner' then
    v_authorized := (v_my_role = 'owner');
  end if;

  if not v_authorized then
    raise exception 'Not authorized to act on this request at its current stage';
  end if;

  insert into request_stage_actions (request_type, request_id, stage_role, actor_id, action, note)
  values ('leave', p_id, v_stage_role, current_employee_id(), case when p_approve then 'approved' else 'rejected' end, p_note);

  if not p_approve then
    update leave_requests
      set status = 'rejected', approved_by = current_employee_id(), approved_at = now(), rejection_reason = p_note
      where id = p_id;
  elsif v_stage + 1 >= array_length(v_chain, 1) then
    update leave_requests
      set status = 'approved', current_stage = v_stage + 1, approved_by = current_employee_id(), approved_at = now()
      where id = p_id;
  else
    update leave_requests set current_stage = v_stage + 1 where id = p_id;
  end if;
end;
$$;

create or replace function review_advance_request(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
as $$
declare
  v_chain text[];
  v_stage integer;
  v_employee_id uuid;
  v_amount numeric;
  v_stage_role text;
  v_authorized boolean := false;
  v_manager_id uuid;
  v_my_role text;
  v_my_dept text;
begin
  select approval_chain, current_stage, employee_id, amount
    into v_chain, v_stage, v_employee_id, v_amount
    from advance_requests
    where id = p_id and status = 'pending'
    for update;

  if v_chain is null or v_stage >= coalesce(array_length(v_chain, 1), 0) then
    raise exception 'Request is not awaiting approval';
  end if;

  v_stage_role := v_chain[v_stage + 1];
  v_my_role := get_current_employee_role();

  if v_stage_role = 'manager' then
    select manager_id into v_manager_id from employees where id = v_employee_id;
    v_authorized := (v_manager_id = current_employee_id());
  elsif v_stage_role = 'hr_admin' then
    v_authorized := (v_my_role = 'hr_admin');
  elsif v_stage_role = 'accounts' then
    select department into v_my_dept from employees where id = current_employee_id();
    v_authorized := (v_my_role = 'manager' and v_my_dept = 'Accounts');
  elsif v_stage_role = 'plant_head' then
    v_authorized := (v_my_role = 'plant_head');
  elsif v_stage_role = 'owner' then
    v_authorized := (v_my_role = 'owner');
  end if;

  if not v_authorized then
    raise exception 'Not authorized to act on this request at its current stage';
  end if;

  insert into request_stage_actions (request_type, request_id, stage_role, actor_id, action, note)
  values ('advance', p_id, v_stage_role, current_employee_id(), case when p_approve then 'approved' else 'rejected' end, p_note);

  if not p_approve then
    update advance_requests
      set status = 'rejected', approved_by = current_employee_id(), approved_at = now()
      where id = p_id;
  elsif v_stage + 1 >= array_length(v_chain, 1) then
    -- Final stage — matches the old single-shot approveAdvance's effect:
    -- outstanding_balance starts at the full amount, drawn down by payroll.
    update advance_requests
      set status = 'approved', current_stage = v_stage + 1, approved_by = current_employee_id(),
          approved_at = now(), outstanding_balance = v_amount
      where id = p_id;
  else
    update advance_requests set current_stage = v_stage + 1 where id = p_id;
  end if;
end;
$$;
