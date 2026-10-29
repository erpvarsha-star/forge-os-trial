-- PATCH_120 (29 Oct 2026) - APPLIED live 29 Oct 2026, statement by statement via the Supabase tool.
-- Owner decision: when HR and Kajal disagree on a half-day comp-off, the conflict goes to the plant head
-- FIRST. He can settle it (applied immediately, note 'Plant head tie-break: ...') or escalate to the owner.
-- The owner can settle a conflict at ANY stage ('Owner tie-break: ...') but only SEES it once escalated.
-- Additive: new table, new functions, CREATE OR REPLACE on decide_halfday_coff and my_action_counts.
-- No personal data. No DROP / DELETE used. Stage is derived: no row in half_day_coff_conflicts = 'plant_head'.

-- A. escalation record (written only by escalate_halfday_coff_conflict)
create table if not exists public.half_day_coff_conflicts (
  request_id uuid primary key references public.leave_requests(id),
  stage text not null default 'owner' check (stage in ('plant_head','owner')),
  escalated_at timestamptz not null default now(),
  escalated_by uuid references public.employees(id),
  escalation_note text
);
alter table public.half_day_coff_conflicts enable row level security;
create policy half_day_coff_conflicts_select on public.half_day_coff_conflicts for select
  using (coalesce(get_current_employee_role() in ('owner','plant_head'), false));
revoke all on public.half_day_coff_conflicts from anon, authenticated;
grant select on public.half_day_coff_conflicts to authenticated;

-- B. decide: only the conflict branch changes (plant head added; conflict notification goes to plant head)
create or replace function public.decide_halfday_coff(p_request_id uuid, p_decision text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  lc_row leave_consumption%rowtype; v_role text := get_current_employee_role(); v_me uuid := current_employee_id();
  v_kind text; v_hr half_day_coff_decisions%rowtype; v_kj half_day_coff_decisions%rowtype;
  v_other half_day_coff_decisions%rowtype; v_name text; o record; v_note text; v_stage text;
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

  if coalesce(v_role in ('owner','plant_head'), false) then
    if v_hr.id is null or v_kj.id is null or v_hr.outcome = v_kj.outcome then
      raise exception 'Only a conflict between HR and Kajal can be settled here';
    end if;
    select stage into v_stage from half_day_coff_conflicts where request_id = p_request_id;
    v_stage := coalesce(v_stage, 'plant_head');
    if v_role = 'plant_head' then
      if v_stage <> 'plant_head' then
        raise exception 'This conflict was escalated to the owner';
      end if;
      perform _halfday_coff_apply(p_request_id, p_decision, 'Plant head tie-break: ' || btrim(p_note), v_me);
    else
      perform _halfday_coff_apply(p_request_id, p_decision, 'Owner tie-break: ' || btrim(p_note), v_me);
    end if;
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
    return;
  end if;

  if v_other.outcome = p_decision then
    v_note := case when v_kind = 'hr'
                   then 'HR: ' || btrim(p_note) || ' | Kajal: ' || v_other.note
                   else 'HR: ' || v_other.note || ' | Kajal: ' || btrim(p_note) end;
    perform _halfday_coff_apply(p_request_id, p_decision, v_note, v_me);
  else
    select name into v_name from employees where id = lc_row.employee_id;
    for o in select id from employees where role = 'plant_head' and is_active loop
      insert into notifications(user_id, title, body, type, related_entity_type, related_entity_id)
      values (o.id, 'Half-day comp-off: HR and Kajal disagree',
        'HR and Kajal gave different decisions for ' || coalesce(v_name,'employee') || ' - please settle or escalate to the owner.',
        'halfday_coff_conflict', 'leave_request', p_request_id::text);
    end loop;
  end if;
end $$;
revoke execute on function public.decide_halfday_coff(uuid,text,text) from public, anon;
grant execute on function public.decide_halfday_coff(uuid,text,text) to authenticated;

-- C. escalate (plant head only)
create or replace function public.escalate_halfday_coff_conflict(p_request_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  lc_row leave_consumption%rowtype; v_me uuid := current_employee_id();
  v_hr half_day_coff_decisions%rowtype; v_kj half_day_coff_decisions%rowtype; v_name text; o record; v_stage text;
begin
  if not coalesce(get_current_employee_role() = 'plant_head', false) then
    raise exception 'Not permitted';
  end if;
  select * into lc_row from leave_consumption where request_id = p_request_id for update;
  if not found or lc_row.source <> 'half_day_pending_decision' then
    raise exception 'already decided';
  end if;
  select * into v_hr from half_day_coff_decisions where request_id = p_request_id and decider_kind = 'hr';
  select * into v_kj from half_day_coff_decisions where request_id = p_request_id and decider_kind = 'kajal';
  if v_hr.id is null or v_kj.id is null or v_hr.outcome = v_kj.outcome then
    raise exception 'Not a conflict';
  end if;
  select stage into v_stage from half_day_coff_conflicts where request_id = p_request_id;
  if v_stage = 'owner' then raise exception 'Already escalated'; end if;
  insert into half_day_coff_conflicts(request_id, stage, escalated_at, escalated_by, escalation_note)
  values (p_request_id, 'owner', now(), v_me, nullif(btrim(coalesce(p_note,'')),''));
  select name into v_name from employees where id = lc_row.employee_id;
  for o in select id from employees where role = 'owner' and is_active loop
    insert into notifications(user_id, title, body, type, related_entity_type, related_entity_id)
    values (o.id, 'Half-day comp-off escalated to you',
      'HR and Kajal disagree on ' || coalesce(v_name,'employee') || ' and the plant head escalated it - please settle.',
      'halfday_coff_conflict', 'leave_request', p_request_id::text);
  end loop;
end $$;
revoke execute on function public.escalate_halfday_coff_conflict(uuid,text) from public, anon;
grant execute on function public.escalate_halfday_coff_conflict(uuid,text) to authenticated;

-- D. conflicts visible to ME (plant head: stage plant_head; owner: escalated only)
create or replace function public.list_halfday_coff_conflicts()
returns table(request_id uuid, emp_code text, name text, department text, leave_date date, days numeric, reason text,
              hr_outcome text, hr_note text, kajal_outcome text, kajal_note text, stage text,
              escalated_at timestamptz, escalation_note text, unused_ledger_days integer)
language plpgsql security definer set search_path = public as $$
declare v_role text := get_current_employee_role();
begin
  if coalesce(v_role in ('owner','plant_head'), false) is not true then
    raise exception 'Not permitted';
  end if;
  return query
  select lc.request_id, e.emp_code, e.name, e.department, lr.start_date, lc.days, lr.reason,
    hd.outcome, hd.note, kd.outcome, kd.note,
    coalesce(cf.stage, 'plant_head'), cf.escalated_at, cf.escalation_note,
    (select count(*)::int from comp_off_balance c where c.employee_id = lc.employee_id and c.is_used = false
       and (c.expiry_date is null or c.expiry_date >= (now() at time zone 'Asia/Kolkata')::date))
  from leave_consumption lc
  join half_day_coff_decisions hd on hd.request_id = lc.request_id and hd.decider_kind = 'hr'
  join half_day_coff_decisions kd on kd.request_id = lc.request_id and kd.decider_kind = 'kajal'
  left join half_day_coff_conflicts cf on cf.request_id = lc.request_id
  join leave_requests lr on lr.id = lc.request_id
  join employees e on e.id = lc.employee_id
  where lc.source = 'half_day_pending_decision'
    and hd.outcome <> kd.outcome
    and coalesce(cf.stage, 'plant_head') = case when v_role = 'owner' then 'owner' else 'plant_head' end
  order by lr.start_date, e.emp_code;
end $$;
revoke execute on function public.list_halfday_coff_conflicts() from public, anon;
grant execute on function public.list_halfday_coff_conflicts() to authenticated;

-- E. my_action_counts(): adds 'halfday_conflicts' (plant head at stage plant_head; owner at stage owner); all else identical
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
  v_conflicts int := 0;
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

  if v_role in ('owner','plant_head') then
    select count(*)::int into v_conflicts from leave_consumption lc
      join half_day_coff_decisions hd on hd.request_id = lc.request_id and hd.decider_kind = 'hr'
      join half_day_coff_decisions kd on kd.request_id = lc.request_id and kd.decider_kind = 'kajal'
      left join half_day_coff_conflicts cf on cf.request_id = lc.request_id
     where lc.source = 'half_day_pending_decision'
       and hd.outcome <> kd.outcome
       and coalesce(cf.stage, 'plant_head') = case when v_role = 'owner' then 'owner' else 'plant_head' end;
    v_out := v_out || jsonb_build_object('halfday_conflicts', v_conflicts);
  end if;

  return v_out;
end;
$function$;
revoke execute on function public.my_action_counts() from public, anon;
grant execute on function public.my_action_counts() to authenticated;

-- F. Live rolled-back tests: see the report in the commit / PENDING.md (results recorded after application).
