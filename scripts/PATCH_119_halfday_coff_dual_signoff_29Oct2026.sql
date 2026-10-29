-- PATCH_119 (29 Oct 2026) - APPLIED live 29 Oct 2026, statement by statement via the Supabase tool.
-- Owner decision: a half-day comp-off (leave_consumption.source = 'half_day_pending_decision') must be
-- decided by BOTH HR (role hr_admin) AND Kajal (emp_code VFL1567) before any outcome is applied.
-- Same outcome -> applied once (same as the old single decision). Different outcomes -> nothing applied,
-- owner notified (type 'halfday_coff_conflict'); owner may then call decide_halfday_coff as tie-breaker.
-- No personal data. Idempotent where possible. No DROP / DELETE used.

-- A. per-party decisions
create table if not exists public.half_day_coff_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.leave_requests(id),
  decider_employee_id uuid not null references public.employees(id),
  decider_kind text not null check (decider_kind in ('hr','kajal')),
  outcome text not null check (outcome in ('deduct_full_day','no_deduction')),
  note text not null,
  decided_at timestamptz not null default now(),
  unique (request_id, decider_kind)
);
alter table public.half_day_coff_decisions enable row level security;
create policy half_day_coff_decisions_select on public.half_day_coff_decisions for select
  using (coalesce(get_current_employee_role() in ('owner','hr_admin'), false));
revoke all on public.half_day_coff_decisions from anon, authenticated;
grant select on public.half_day_coff_decisions to authenticated;

-- B. who may decide (extend the list inside the function for more clerks)
create or replace function public._halfday_decider_kind()
returns text language sql stable security definer set search_path = public as $$
  select case
           when e.role = 'hr_admin' then 'hr'
           when e.emp_code = any (array['VFL1567']) then 'kajal'
         end
  from employees e where e.id = current_employee_id()
$$;
revoke execute on function public._halfday_decider_kind() from public, anon;
grant execute on function public._halfday_decider_kind() to authenticated;

create or replace function public.my_halfday_coff_decider()
returns boolean language sql stable security definer set search_path = public as $$
  select public._halfday_decider_kind() is not null
$$;
revoke execute on function public.my_halfday_coff_decider() from public, anon;
grant execute on function public.my_halfday_coff_decider() to authenticated;

-- C. internal apply (exactly what the old single decision applied)
create or replace function public._halfday_coff_apply(p_request_id uuid, p_decision text, p_note text, p_decided_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare lc_row leave_consumption%rowtype; v_ledger uuid; v_name text; v_src text; o record;
begin
  select * into lc_row from leave_consumption where request_id = p_request_id for update;
  if not found or lc_row.source <> 'half_day_pending_decision' then
    raise exception 'already decided';
  end if;
  if p_decision = 'deduct_full_day' then
    select id into v_ledger from comp_off_balance
      where employee_id = lc_row.employee_id and is_used = false
        and (expiry_date is null or expiry_date >= (now() at time zone 'Asia/Kolkata')::date)
      order by earned_date, created_at limit 1 for update;
    if v_ledger is null then raise exception 'Comp-off balance insufficient'; end if;
    update comp_off_balance set is_used = true, used_in_leave_request_id = p_request_id where id = v_ledger;
    v_src := 'half_day_decided_deduct';
  else
    v_src := 'half_day_decided_no_deduction';
  end if;
  update leave_consumption set source = v_src, decided_by = p_decided_by, decided_at = now(), decision_note = btrim(p_note)
    where id = lc_row.id;
  select name into v_name from employees where id = lc_row.employee_id;
  for o in select id from employees where role = 'owner' and is_active loop
    insert into notifications(user_id, title, body, type, related_entity_type, related_entity_id)
    values (o.id, 'Half-day comp-off decided',
      'Decision for ' || coalesce(v_name,'employee') || ': ' ||
      case when p_decision = 'deduct_full_day' then 'full day deducted from comp-off balance' else 'no deduction' end ||
      ' - please review.', 'leave', 'leave_request', p_request_id::text);
  end loop;
end $$;
revoke execute on function public._halfday_coff_apply(uuid,text,text,uuid) from public, anon, authenticated;

-- D. decide (HR / Kajal record a decision; owner settles a conflict)
create or replace function public.decide_halfday_coff(p_request_id uuid, p_decision text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  lc_row leave_consumption%rowtype; v_role text := get_current_employee_role(); v_me uuid := current_employee_id();
  v_kind text; v_hr half_day_coff_decisions%rowtype; v_kj half_day_coff_decisions%rowtype;
  v_other half_day_coff_decisions%rowtype; v_name text; o record; v_note text;
begin
  if p_decision is null or p_decision not in ('deduct_full_day','no_deduction') then
    raise exception 'Invalid decision';
  end if;
  if char_length(btrim(coalesce(p_note,''))) = 0 then
    raise exception 'A note is required';
  end if;
  select * into lc_row from leave_consumption where request_id = p_request_id for update;
  if not found or lc_row.source <> 'half_day_pending_decision' then
    raise exception 'already decided';
  end if;
  select * into v_hr from half_day_coff_decisions where request_id = p_request_id and decider_kind = 'hr';
  select * into v_kj from half_day_coff_decisions where request_id = p_request_id and decider_kind = 'kajal';

  if coalesce(v_role = 'owner', false) then
    if v_hr.id is null or v_kj.id is null or v_hr.outcome = v_kj.outcome then
      raise exception 'Owner can only settle a conflict between HR and Kajal';
    end if;
    perform _halfday_coff_apply(p_request_id, p_decision, 'Owner tie-break: ' || btrim(p_note), v_me);
    return;
  end if;

  v_kind := _halfday_decider_kind();
  if v_kind is null then raise exception 'Not permitted'; end if;
  if (v_kind = 'hr' and v_hr.id is not null) or (v_kind = 'kajal' and v_kj.id is not null) then
    raise exception 'You have already decided this request';
  end if;

  insert into half_day_coff_decisions(request_id, decider_employee_id, decider_kind, outcome, note)
  values (p_request_id, v_me, v_kind, p_decision, btrim(p_note));

  v_other := case when v_kind = 'hr' then v_kj else v_hr end;
  if v_other.id is null then
    return; -- waiting for the other party
  end if;

  if v_other.outcome = p_decision then
    v_note := case when v_kind = 'hr'
                   then 'HR: ' || btrim(p_note) || ' | Kajal: ' || v_other.note
                   else 'HR: ' || v_other.note || ' | Kajal: ' || btrim(p_note) end;
    perform _halfday_coff_apply(p_request_id, p_decision, v_note, v_me);
  else
    select name into v_name from employees where id = lc_row.employee_id;
    for o in select id from employees where role = 'owner' and is_active loop
      insert into notifications(user_id, title, body, type, related_entity_type, related_entity_id)
      values (o.id, 'Half-day comp-off: HR and Kajal disagree',
        'HR and Kajal gave different decisions for ' || coalesce(v_name,'employee') || ' - please settle.',
        'halfday_coff_conflict', 'leave_request', p_request_id::text);
    end loop;
  end if;
end $$;
revoke execute on function public.decide_halfday_coff(uuid,text,text) from public, anon;
grant execute on function public.decide_halfday_coff(uuid,text,text) to authenticated;

-- E. list (return type changed -> old function renamed, not dropped, because the tool cannot DROP)
alter function public.list_pending_halfday_coff() rename to list_pending_halfday_coff_v114_old;
revoke execute on function public.list_pending_halfday_coff_v114_old() from public, anon, authenticated;

create or replace function public.list_pending_halfday_coff()
returns table(request_id uuid, emp_code text, name text, department text, leave_date date, days numeric, reason text,
              approved_at timestamptz, unused_ledger_days integer,
              hr_decided boolean, kajal_decided boolean, is_conflict boolean, hr_outcome text, kajal_outcome text)
language plpgsql security definer set search_path = public as $$
declare v_role text := get_current_employee_role(); v_kind text := _halfday_decider_kind();
begin
  if v_kind is null and coalesce(v_role in ('owner','plant_head'), false) is not true then
    raise exception 'Not permitted';
  end if;
  return query
  with p as (
    select lc.request_id, lc.employee_id, lc.days,
      hd.outcome as hr_o, kd.outcome as kj_o
    from leave_consumption lc
    left join half_day_coff_decisions hd on hd.request_id = lc.request_id and hd.decider_kind = 'hr'
    left join half_day_coff_decisions kd on kd.request_id = lc.request_id and kd.decider_kind = 'kajal'
    where lc.source = 'half_day_pending_decision'
  )
  select p.request_id, e.emp_code, e.name, e.department, lr.start_date, p.days, lr.reason, lr.approved_at,
    (select count(*)::int from comp_off_balance c where c.employee_id = p.employee_id and c.is_used = false
       and (c.expiry_date is null or c.expiry_date >= (now() at time zone 'Asia/Kolkata')::date)),
    p.hr_o is not null, p.kj_o is not null,
    (p.hr_o is not null and p.kj_o is not null and p.hr_o <> p.kj_o),
    case when p.hr_o is not null and p.kj_o is not null and p.hr_o <> p.kj_o then p.hr_o end,
    case when p.hr_o is not null and p.kj_o is not null and p.hr_o <> p.kj_o then p.kj_o end
  from p
  join leave_requests lr on lr.id = p.request_id
  join employees e on e.id = p.employee_id
  where case
          when v_role = 'owner' then (p.hr_o is not null and p.kj_o is not null and p.hr_o <> p.kj_o)
          when v_kind = 'hr' then p.hr_o is null
          when v_kind = 'kajal' then p.kj_o is null
          else true -- plant_head: read-only view of all pending
        end
  order by lr.start_date, e.emp_code;
end $$;
revoke execute on function public.list_pending_halfday_coff() from public, anon;
grant execute on function public.list_pending_halfday_coff() to authenticated;

-- F. my_action_counts(): only the half-day key changes (rows awaiting MY decision; HR and Kajal)
create or replace function public.my_action_counts()
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_me   uuid := current_employee_id();
  v_role text := get_current_employee_role();
  v_kind text := _halfday_decider_kind();
  v_todo int := 0;
  v_conf int := 0;
  v_appr int := 0;
  v_salary int := 0;
  v_nyc  int := 0;
  v_fraud int := 0;
  v_halfday int := 0;
  v_review int := 0;
  v_out jsonb;
begin
  if v_me is null then
    return jsonb_build_object('tasks_todo',0,'tasks_to_confirm',0,'approvals',0,'needs_your_call',0,'fraud_alerts',0);
  end if;

  select count(*)::int into v_todo from assigned_tasks
   where assigned_to = v_me and status in ('open','in_progress');
  select count(*)::int into v_conf from assigned_tasks
   where assigned_by = v_me and status = 'submitted';

  select (select count(*) from my_turn_leave_requests())
       + (select count(*) from my_turn_advance_requests()) into v_appr;

  if v_role = 'owner' then
    select count(*)::int into v_salary from salary_change_requests where status = 'pending_owner';
    select count(*)::int into v_nyc from needs_your_call_shifts;
    select count(*)::int into v_fraud from fraud_alerts where status = 'open';
  elsif v_role = 'plant_head' then
    select count(*)::int into v_salary from salary_change_requests where status = 'pending_plant_head';
  end if;

  v_out := jsonb_build_object(
    'tasks_todo', v_todo,
    'tasks_to_confirm', v_conf,
    'approvals', v_appr + v_salary,
    'needs_your_call', v_nyc,
    'fraud_alerts', v_fraud
  );

  if v_kind is not null then
    select count(*)::int into v_halfday from leave_consumption lc
     where lc.source = 'half_day_pending_decision'
       and not exists (select 1 from half_day_coff_decisions d
                        where d.request_id = lc.request_id and d.decider_kind = v_kind);
    v_out := v_out || jsonb_build_object('halfday_coff', v_halfday);
  end if;

  if v_role = 'owner' then
    select count(*)::int into v_review from leave_consumption
     where source in ('half_day_decided_deduct','half_day_decided_no_deduction')
       and owner_reviewed_at is null;
    v_out := v_out || jsonb_build_object('halfday_review', v_review);
  end if;

  return v_out;
end;
$function$;
revoke execute on function public.my_action_counts() from public, anon;
grant execute on function public.my_action_counts() to authenticated;

-- G. Live rolled-back test (29 Oct 2026, impersonating HR / Kajal / owner / member / plant head chain), all passed, zero residue:
-- HR first -> still pending, HR list 3->2, Kajal list 3; Kajal same outcome -> half_day_decided_deduct, 1 ledger row,
-- 1 owner notification, note 'HR: .. | Kajal: ..'; differing -> pending + 1 'halfday_coff_conflict' notification, ledger untouched,
-- owner list shows it, owner tie-break -> half_day_decided_no_deduction; member refused ('Not permitted'), HR double decision
-- refused, owner on a non-conflict refused, decided request refused ('already decided'); member's my_action_counts has no halfday_coff key.
-- Old function kept as list_pending_halfday_coff_v114_old (execute revoked; drop later from the SQL Editor).
