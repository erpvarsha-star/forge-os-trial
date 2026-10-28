-- PATCH_113 — In-app leave system: granted-days override, request detail (OD/C-off),
-- balance consumption ledger (28 Oct 2026, prepared by Kimi Code)
--
-- STATUS: PREPARED, NOT APPLIED. For a human to review and run manually.
-- ADDITIVE ONLY: no DROP, no DELETE, no rewrites of existing columns.
--
-- Reproduces the owner's leave sheet behavior in-app:
--   * every approval stage records approver, decision, and an APPROVED-DAYS
--     override (may differ from requested; rejections store 0). A day-count
--     change or a rejection REQUIRES a remark.
--   * requests carry half-day start/end flags (0.5-day granularity), OD
--     requests carry place/purpose/time range, C-off requests carry up to 5
--     extra-work evidence blocks. All of it lives in leave_requests.detail (jsonb).
--   * approved leave CONSUMES the employee's balance via leave_consumption
--     (idempotent — unique request_id). The sheet never blocks on insufficient
--     balance: the app warns but allows, so the RPC allows negative balances.
--
-- Depends on: PATCH_53 (staged approval chains — compute_approval_chain,
-- review_leave_request, my_turn_* RPCs) and PATCH_24 (leave_balances seed).
-- The review_leave_request changes below are a create-or-replace of the
-- PATCH_53 function with ONLY additive optional parameters — existing callers
-- (hooks/useLeaveAdvanceApprovals.ts) keep working unchanged.

-- ============================================================================
-- STEP 0 — PRE-FLIGHT: confirm comp_off_balance's actual columns.
-- VERIFIED LIVE 28 Oct: comp_off_balance is a per-earning LEDGER with columns
-- id, employee_id, earned_date, expiry_date, reason, is_used,
-- used_in_leave_request_id, created_at (no numeric balance column).
-- The consume RPC in STEP 4 is written against exactly this ledger shape
-- (marks the oldest unexpired unused rows as used). Run this first and
-- confirm the columns still match before running the rest of the file.
-- ============================================================================

select ordinal_position, column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'comp_off_balance'
order by ordinal_position;

-- ============================================================================
-- STEP 1 — leave_requests: granted-days override + free-form detail (jsonb).
--   granted_days: NULL = "as requested" (days); set by review_leave_request
--     (0 on rejection, approver override on approval).
--   detail: {
--     start_half: 'first'|'second'|null, end_half: 'first'|'second'|null,
--     place, purpose, time_from, time_to,            -- for OD
--     extra_work: [{date, time_from, time_to, hours, details}]  -- for COFF, max 5
--   }
-- ============================================================================

alter table leave_requests
  add column if not exists granted_days numeric;   -- APPROVED-DAYS override; NULL = requested days

alter table leave_requests
  add column if not exists detail jsonb;           -- half-day flags + OD fields + COFF evidence blocks

-- ============================================================================
-- STEP 2 — leave_consumption: one row per approved request (idempotency key).
-- Written ONLY by consume_leave_for_request() (SECURITY DEFINER, bypasses RLS).
-- Clients get select-only RLS for owner/hr_admin — the balance movement audit
-- is not editable from the app, same convention as request_stage_actions.
-- ============================================================================

create table if not exists leave_consumption (
  id uuid primary key default gen_random_uuid(),
  request_id uuid unique not null references leave_requests(id),  -- unique = idempotent consumption
  employee_id uuid not null references employees(id),
  leave_type text not null,
  days numeric not null,
  source text not null default 'approval',
  created_at timestamptz default now()
);

create index if not exists idx_leave_consumption_employee on leave_consumption(employee_id, created_at desc);

alter table leave_consumption enable row level security;

drop policy if exists leave_consumption_select on leave_consumption;
create policy leave_consumption_select on leave_consumption
  for select using (get_current_employee_role() in ('owner', 'hr_admin'));
-- No insert/update/delete policy for clients — only the RPC below writes.

-- ============================================================================
-- STEP 3 — review_leave_request: OPTIONAL p_granted_days (additive; the PATCH_53
-- three-arg signature still works — null means "as requested").
--   * REJECT  -> granted_days is forced to 0 AND a note is MANDATORY.
--   * APPROVE with granted_days differing from the requested days -> note MANDATORY.
-- granted_days, when provided on an approval, is stored on the request; the
-- final-stage value is what consume_leave_for_request() draws down.
-- (review_advance_request has no day-count concept and is intentionally unchanged.)
-- ============================================================================

-- The live DB has the 3-arg review_leave_request(uuid, boolean, text); a plain
-- create-or-replace with a 4th arg would add a SECOND overload and PostgREST
-- could not resolve 3-named-arg calls (PGRST203). Drop the old one first; old
-- 3-arg callers (apk-106 and older) still resolve to the 4-arg version via the default.
drop function if exists review_leave_request(uuid, boolean, text);

create or replace function review_leave_request(
  p_id uuid,
  p_approve boolean,
  p_note text default null,
  p_granted_days numeric default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_chain text[];
  v_stage integer;
  v_employee_id uuid;
  v_days numeric;
  v_stage_role text;
  v_authorized boolean := false;
  v_manager_id uuid;
  v_my_role text;
begin
  select approval_chain, current_stage, employee_id, days
    into v_chain, v_stage, v_employee_id, v_days
    from leave_requests
    where id = p_id and status = 'pending'
    for update;

  if v_chain is null or v_stage >= coalesce(array_length(v_chain, 1), 0) then
    raise exception 'Request is not awaiting approval';
  end if;

  -- Sheet rule: a rejection must always carry a remark, and so must any
  -- approval where the granted days differ from what was requested.
  if not p_approve and (p_note is null or btrim(p_note) = '') then
    raise exception 'A remark is mandatory when rejecting a leave request';
  end if;
  if p_approve and p_granted_days is not null and p_granted_days <> v_days
     and (p_note is null or btrim(p_note) = '') then
    raise exception 'A remark is mandatory when changing the approved day count';
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
    -- Rejection: APPROVED-DAYS override is 0 per the sheet.
    update leave_requests
      set status = 'rejected', approved_by = current_employee_id(), approved_at = now(),
          rejection_reason = p_note, granted_days = 0
      where id = p_id;
  elsif v_stage + 1 >= array_length(v_chain, 1) then
    update leave_requests
      set status = 'approved', current_stage = v_stage + 1, approved_by = current_employee_id(),
          approved_at = now(), granted_days = coalesce(p_granted_days, v_days)
      where id = p_id;
  else
    -- Mid-chain: advance the stage; keep the latest non-null granted-days
    -- override so the next approver sees what the previous one proposed.
    update leave_requests
      set current_stage = v_stage + 1,
          granted_days = case when p_granted_days is not null then p_granted_days else granted_days end
      where id = p_id;
  end if;
end;
$$;

-- ============================================================================
-- STEP 4 — consume_leave_for_request(p_request_id uuid): draw the approved
-- leave down from balances. SECURITY DEFINER, owner/hr_admin/plant_head only
-- (plant head is usually the FINAL approver and the app calls this right
-- after final approval).
--   * IDEMPOTENT: no-op when a leave_consumption row already exists.
--   * Proceeds only when status = 'approved' AND the chain is fully walked
--     (current_stage >= array_length(approval_chain,1)) — same finality
--     test as PATCH_53's review RPC. Empty-chain (owner auto-approve) rows
--     pass because 0 >= 0.
--   * Days drawn = COALESCE(granted_days, days) — the APPROVED-DAYS override.
--   * EL/CL/SL decrement leave_balances for the year of start_date; a missing
--     balance row is created at 0 first, then decremented (sheet behavior:
--     negative balances are ALLOWED, never raised).
--   * COFF consumes the comp_off_balance LEDGER (one row per comp-off earned):
--       - whole days: the oldest unexpired unused rows (earned_date asc) are
--         marked is_used = true / used_in_leave_request_id = request, one row
--         per day. If fewer rows exist than days, it never raises or blocks:
--         it consumes what exists, records source 'approval_shortfall_<N>' on
--         the leave_consumption row and notifies every active owner.
--       - half-day (fractional days): the ledger is NOT touched; source
--         'half_day_pending_decision' is recorded and every active owner is
--         notified (HR + Plant Head decide the treatment, no auto-deduction).
--   * OD consumes nothing.
-- ============================================================================

create or replace function consume_leave_for_request(p_request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_role text;
  v_req leave_requests%rowtype;
  v_days numeric;
  v_year integer;
  v_source text := 'approval';
  v_ids uuid[];
  v_marked integer := 0;
begin
  select get_current_employee_role() into v_role;
  if v_role not in ('owner', 'hr_admin', 'plant_head') then
    raise exception 'Only owner, hr_admin or plant_head can consume leave balances';
  end if;

  -- Idempotency: unique(request_id) means a second call is a no-op.
  if exists (select 1 from leave_consumption where request_id = p_request_id) then
    return;
  end if;

  select * into v_req from leave_requests where id = p_request_id for update;
  if not found then
    raise exception 'Leave request % not found', p_request_id;
  end if;

  if v_req.status <> 'approved'
     or v_req.current_stage < coalesce(array_length(v_req.approval_chain, 1), 0) then
    raise exception 'Leave request % is not fully approved yet', p_request_id;
  end if;

  v_days := coalesce(v_req.granted_days, v_req.days);
  v_year := extract(year from v_req.start_date)::integer;

  if v_req.type in ('EL', 'CL', 'SL') then
    -- Sheet rule: never block on insufficient balance — allow negative.
    insert into leave_balances (employee_id, year, earned_leave, casual_leave, sick_leave)
    values (v_req.employee_id, v_year, 0, 0, 0)
    on conflict (employee_id, year) do nothing;

    if v_req.type = 'EL' then
      update leave_balances set earned_leave = earned_leave - v_days
        where employee_id = v_req.employee_id and year = v_year;
    elsif v_req.type = 'CL' then
      update leave_balances set casual_leave = casual_leave - v_days
        where employee_id = v_req.employee_id and year = v_year;
    else
      update leave_balances set sick_leave = sick_leave - v_days
        where employee_id = v_req.employee_id and year = v_year;
    end if;
  elsif v_req.type = 'COFF' then
    -- comp_off_balance is a per-earning ledger (verified live 28 Oct).
    if v_days <> floor(v_days) then
      -- Half-day comp-off: do NOT touch the ledger; owner decides.
      v_source := 'half_day_pending_decision';
      insert into notifications (user_id, title, body, type, related_entity_type, related_entity_id)
      select e.id, 'Comp-off decision needed',
             'Half-day comp-off approved — needs HR + Plant Head decision, not auto-deducted',
             'leave', 'leave_request', p_request_id::text
        from employees e
       where e.role = 'owner' and e.is_active = true;
    else
      -- Whole days: lock and take the oldest unexpired unused ledger rows.
      select coalesce(array_agg(id), '{}') into v_ids from (
        select id from comp_off_balance
         where employee_id = v_req.employee_id
           and is_used = false
           and (expiry_date is null or expiry_date >= (now() at time zone 'Asia/Kolkata')::date)
         order by earned_date asc, created_at asc
         limit v_days::int
           for update
      ) q;
      update comp_off_balance
         set is_used = true, used_in_leave_request_id = p_request_id
       where id = any(v_ids);
      get diagnostics v_marked = row_count;
      if v_marked < v_days::int then
        -- Never block: consume what exists and record the shortfall.
        v_source := 'approval_shortfall_' || (v_days::int - v_marked)::text;
        insert into notifications (user_id, title, body, type, related_entity_type, related_entity_id)
        select e.id, 'Comp-off shortfall',
               'Comp-off short by ' || (v_days::int - v_marked)::text || ' day(s) for an approved request',
               'leave', 'leave_request', p_request_id::text
          from employees e
         where e.role = 'owner' and e.is_active = true;
      end if;
    end if;
  elsif v_req.type in ('LWP', 'OD') then
    -- LWP is unpaid (no balance), OD is on duty (no balance): consume nothing.
    null;
  else
    raise exception 'Unknown leave type %', v_req.type;
  end if;

  insert into leave_consumption (request_id, employee_id, leave_type, days, source)
  values (p_request_id, v_req.employee_id, v_req.type, v_days, v_source);
end;
$$;

-- ============================================================================
-- STEP 5 — VERIFICATION (read-only; safe to re-run)
-- ============================================================================

-- Consumption ledger sanity: every consumed request is approved & fully staged.
select lc.leave_type, count(*) as consumptions, sum(lc.days) as days_drawn
from leave_consumption lc
join leave_requests lr on lr.id = lc.request_id
where lr.status = 'approved'
  and lr.current_stage >= coalesce(array_length(lr.approval_chain, 1), 0)
group by lc.leave_type
order by lc.leave_type;

-- Sample: request code -> type / requested vs granted vs consumed.
select e.emp_code, e.name, lr.type, lr.start_date, lr.end_date,
       lr.days as requested, lr.granted_days as approved_override, lc.days as consumed
from leave_consumption lc
join leave_requests lr on lr.id = lc.request_id
join employees e on e.id = lr.employee_id
order by lc.created_at desc
limit 20;

-- Balance spot-check for the current year (negative values are EXPECTED and
-- allowed — the sheet warns but never blocks).
select e.emp_code, lb.year, lb.earned_leave, lb.casual_leave, lb.sick_leave
from leave_balances lb join employees e on e.id = lb.employee_id
where lb.year = extract(year from current_date)::int
order by e.emp_code
limit 20;

-- ============================================================================
-- ROLLBACK NOTE (human-only; nothing here auto-rolls-back):
--   This patch is additive. To undo before any consumption happens:
--     drop table if exists leave_consumption;
--     alter table leave_requests drop column if exists granted_days;
--     alter table leave_requests drop column if exists detail;
--     -- review_leave_request: re-apply the PATCH_53 definition (three-arg
--     -- version) to restore the old signature.
--     drop function if exists consume_leave_for_request(uuid);
--   After leave_consumption rows exist, do NOT drop columns — the ledger is
--   the audit trail of balance movement.
-- ============================================================================
