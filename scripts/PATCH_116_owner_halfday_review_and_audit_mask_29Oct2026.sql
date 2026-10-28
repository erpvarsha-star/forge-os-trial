-- PATCH_116 (29 Oct 2026) - record of what was applied live, statement by statement. No personal data.
-- A. Owner review of HR-decided half-day comp-offs.  B. Mask bank/PAN/UAN in salary-structure audit rows.

-- A1
alter table public.leave_consumption add column if not exists owner_reviewed_at timestamptz;
alter table public.leave_consumption add column if not exists owner_reviewed_by uuid references public.employees(id);

-- A2
create or replace function public.list_decided_halfday_coff()
returns table(request_id uuid, emp_code text, name text, department text, leave_date date,
              decision text, decision_note text, decided_by_name text, decided_at timestamptz,
              owner_reviewed_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(get_current_employee_role() = 'owner', false) is not true then
    raise exception 'Not permitted';
  end if;
  return query
    select lc.request_id, e.emp_code, e.name, e.department, lr.start_date,
           case when lc.source = 'half_day_decided_deduct' then 'Deducted 1 full comp-off day'
                else 'Approved without deduction' end,
           lc.decision_note, d.name, lc.decided_at, lc.owner_reviewed_at
      from leave_consumption lc
      join employees e on e.id = lc.employee_id
      left join leave_requests lr on lr.id = lc.request_id
      left join employees d on d.id = lc.decided_by
     where lc.source in ('half_day_decided_deduct','half_day_decided_no_deduction')
     order by lc.decided_at desc nulls last
     limit 100;
end $$;

-- A3
create or replace function public.mark_halfday_coff_reviewed(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_row leave_consumption%rowtype;
begin
  if coalesce(get_current_employee_role() = 'owner', false) is not true then
    raise exception 'Not permitted';
  end if;
  select * into v_row from leave_consumption where request_id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_row.source not in ('half_day_decided_deduct','half_day_decided_no_deduction') then
    raise exception 'Request not decided';
  end if;
  update leave_consumption
     set owner_reviewed_at = coalesce(owner_reviewed_at, now()),
         owner_reviewed_by = coalesce(owner_reviewed_by, current_employee_id())
   where id = v_row.id;
end $$;

-- A4: my_action_counts() = live definition + owner-only key halfday_review
create or replace function public.my_action_counts()
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_me   uuid := current_employee_id();
  v_role text := get_current_employee_role();
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

  if v_role = 'hr_admin' then
    select count(*)::int into v_halfday from leave_consumption
     where source = 'half_day_pending_decision';
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

-- A5
revoke execute on function public.list_decided_halfday_coff() from public, anon;
revoke execute on function public.mark_halfday_coff_reviewed(uuid) from public, anon;

-- B: masked audit trigger function for employee_salary_structure only (shared audit_row_change untouched)
create or replace function public.audit_row_change_salary_masked()
returns trigger
language plpgsql security definer set search_path = public as $function$
declare
  k text;
  v_old jsonb := case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_changed text[] := '{}';
  v_keys text[] := array['bank_name','account_no','ifsc','uan','pan'];
begin
  foreach k in array v_keys loop
    if (v_old -> k) is distinct from (v_new -> k) then
      v_changed := v_changed || k;
    end if;
    v_old := v_old - k;
    v_new := v_new - k;
  end loop;
  if v_new is not null then
    v_new := v_new || jsonb_build_object('masked_fields', to_jsonb(v_changed));
  elsif v_old is not null then
    v_old := v_old || jsonb_build_object('masked_fields', to_jsonb(v_changed));
  end if;
  insert into audit_log (actor_employee_id, table_name, row_id, action, old_values, new_values)
  values (
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'employee_id','')::uuid,
    TG_TABLE_NAME,
    coalesce(new.id::text, old.id::text),
    lower(TG_OP),
    v_old,
    v_new
  );
  return coalesce(new, old);
end $function$;

revoke execute on function public.audit_row_change_salary_masked() from public, anon, authenticated;

create or replace trigger trg_audit_salary
  after insert or update or delete on public.employee_salary_structure
  for each row execute function public.audit_row_change_salary_masked();
