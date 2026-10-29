-- PATCH_117 - leave: atomic consumption at final approval, approved-days validation,
-- search_path hardening (29 Oct 2026). Record file (no personal data).
--   STATUS: ALL sections 1-5 APPLIED live 29 Oct 2026 and TESTED (rolled back, zero residue) by Claude.
--   Tests passed: 2-day EL manager>HR 1.5>plant head => granted 1.5, balance -1.5, 1 consumption row, no explicit consume; granted 0/-1/2.3/over-request rejected; whole-day COFF marks 1 ledger row; over-ledger COFF blocked; half-day COFF => half_day_pending_decision, ledger untouched; 2nd consume idempotent; owner auto-approved request consumes at insert (trigger), pending request does not.
--
--
--   A2: review_leave_request now consumes the balance in the SAME transaction as the final
--       approval (via private _consume_leave); consume_leave_for_request stays as a
--       role-checked, idempotent wrapper (the existing app call becomes a no-op).
--       COFF availability pre-check and draw lock comp_off_balance rows (FOR UPDATE) so
--       concurrent approvals serialize.
--   A3: p_granted_days (on approve) must be >0, <= requested days, multiple of 0.5.
--   A5: all three functions set search_path = public.
--   Execute revoked from public/anon (authenticated keeps review/consume; helper is private).

-- 1) private helper (body of the previous consume_leave_for_request, minus the role check)
create or replace function public._consume_leave(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req leave_requests%rowtype;
  v_days numeric;
  v_year integer;
  v_source text := 'approval';
  v_ids uuid[];
  v_marked integer := 0;
begin
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
    if v_days <> floor(v_days) then
      v_source := 'half_day_pending_decision';
      insert into notifications (user_id, title, body, type, related_entity_type, related_entity_id)
      select e.id, 'Comp-off decision needed',
             'Half-day comp-off approved — needs HR + Plant Head decision, not auto-deducted',
             'leave', 'leave_request', p_request_id::text
        from employees e
       where e.role = 'owner' and e.is_active = true;
    else
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
        raise exception 'Comp-off balance insufficient: % day(s) short', (v_days::int - v_marked);
      end if;
    end if;
  elsif v_req.type in ('LWP', 'OD') then
    null;
  else
    raise exception 'Unknown leave type %', v_req.type;
  end if;

  insert into leave_consumption (request_id, employee_id, leave_type, days, source)
  values (p_request_id, v_req.employee_id, v_req.type, v_days, v_source);
end;
$$;

-- 2) public wrapper: role-checked, idempotent
create or replace function public.consume_leave_for_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select get_current_employee_role() into v_role;
  if v_role not in ('owner', 'hr_admin', 'plant_head') then
    raise exception 'Only owner, hr_admin or plant_head can consume leave balances';
  end if;
  perform public._consume_leave(p_request_id);
end;
$$;

-- 3) review_leave_request
create or replace function public.review_leave_request(
  p_id uuid,
  p_approve boolean,
  p_note text default null,
  p_granted_days numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
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
  v_type text;
  v_grant numeric;
  v_unused integer;
  v_prev_grant numeric;
begin
  select approval_chain, current_stage, employee_id, days, type, granted_days
    into v_chain, v_stage, v_employee_id, v_days, v_type, v_prev_grant
    from leave_requests
    where id = p_id and status = 'pending'
    for update;

  if v_chain is null or v_stage >= coalesce(array_length(v_chain, 1), 0) then
    raise exception 'Request is not awaiting approval';
  end if;

  if not p_approve and (p_note is null or btrim(p_note) = '') then
    raise exception 'A remark is mandatory when rejecting a leave request';
  end if;
  if p_approve and p_granted_days is not null
     and (p_granted_days <= 0 or p_granted_days > v_days or (p_granted_days * 2) <> floor(p_granted_days * 2)) then
    raise exception 'Approved days must be between 0.5 and the requested days in 0.5 steps';
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
    update leave_requests
      set status = 'rejected', approved_by = current_employee_id(), approved_at = now(),
          rejection_reason = p_note, granted_days = 0
      where id = p_id;
  elsif v_stage + 1 >= array_length(v_chain, 1) then
    v_grant := coalesce(p_granted_days, v_prev_grant, v_days);
    if v_type = 'COFF' and v_grant = floor(v_grant) then
      -- lock the candidate ledger rows so concurrent approvals serialize
      select count(*) into v_unused from (
        select id from comp_off_balance
         where employee_id = v_employee_id
           and is_used = false
           and (expiry_date is null or expiry_date >= (now() at time zone 'Asia/Kolkata')::date)
           for update
      ) q;
      if v_unused < v_grant::int then
        raise exception 'Comp-off balance insufficient: employee has % unused day(s), % requested', v_unused, v_grant::int;
      end if;
    end if;
    update leave_requests
      set status = 'approved', current_stage = v_stage + 1, approved_by = current_employee_id(),
          approved_at = now(), granted_days = v_grant
      where id = p_id;
    -- atomic balance consumption (idempotent via leave_consumption unique(request_id))
    perform public._consume_leave(p_id);
  else
    update leave_requests
      set current_stage = v_stage + 1,
          granted_days = case when p_granted_days is not null then p_granted_days else granted_days end
      where id = p_id;
  end if;
end;
$$;

-- 4) privileges (re-run after every create or replace)
revoke execute on function public._consume_leave(uuid) from public, anon, authenticated;
revoke execute on function public.consume_leave_for_request(uuid) from public, anon;
revoke execute on function public.review_leave_request(uuid, boolean, text, numeric) from public, anon;


-- 5) owner / no-chain requests are inserted already 'approved' (leave_requests_set_chain) and never pass
--    through review_leave_request, so consume at insert time. NOT CONFIRMED APPLIED (see header).
create or replace function public.leave_requests_autoconsume()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'approved' and coalesce(array_length(new.approval_chain, 1), 0) = 0 then
    perform public._consume_leave(new.id);
  end if;
  return null;
end;
$$;
revoke execute on function public.leave_requests_autoconsume() from public, anon, authenticated;
-- (run once; if the trigger already exists, skip) :
create trigger trg_leave_requests_autoconsume after insert on public.leave_requests
  for each row execute function public.leave_requests_autoconsume();
