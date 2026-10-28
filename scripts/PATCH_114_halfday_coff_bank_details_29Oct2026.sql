-- PATCH_114 (29 Oct 2026) - RECORD of what was applied live statement-by-statement via the Supabase tool.
-- A: fix auth_role(); B: half-day comp-off decisions; C: HR bank-detail completion; D: one delegated task.
-- No values (bank/PAN/UAN) appear here. Idempotent (create or replace / add column if not exists).

-- A. employees.role is TEXT; helper returned role_enum without a cast -> RLS policies using it errored.
create or replace function public.auth_role() returns role_enum language sql stable as $$
  select role::role_enum from employees where auth_user_id = auth.uid()
$$;

-- B1
alter table public.leave_consumption
  add column if not exists decided_by uuid references public.employees(id),
  add column if not exists decided_at timestamptz,
  add column if not exists decision_note text;

-- B2
create or replace function public.list_pending_halfday_coff()
returns table(request_id uuid, emp_code text, name text, department text, leave_date date, days numeric, reason text, approved_at timestamptz, unused_ledger_days integer)
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(get_current_employee_role() in ('hr_admin','owner','plant_head'), false) is not true then
    raise exception 'Not permitted';
  end if;
  return query
  select lc.request_id, e.emp_code, e.name, e.department, lr.start_date, lc.days, lr.reason, lr.approved_at,
    (select count(*)::int from comp_off_balance c where c.employee_id = lc.employee_id and c.is_used = false
       and (c.expiry_date is null or c.expiry_date >= (now() at time zone 'Asia/Kolkata')::date))
  from leave_consumption lc
  join leave_requests lr on lr.id = lc.request_id
  join employees e on e.id = lc.employee_id
  where lc.source = 'half_day_pending_decision'
  order by lr.start_date, e.emp_code;
end $$;

-- B3
create or replace function public.decide_halfday_coff(p_request_id uuid, p_decision text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare lc_row leave_consumption%rowtype; v_ledger uuid; v_name text; v_src text; o record;
begin
  if coalesce(get_current_employee_role() in ('hr_admin','owner'), false) is not true then
    raise exception 'Not permitted';
  end if;
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
  update leave_consumption set source = v_src, decided_by = current_employee_id(), decided_at = now(), decision_note = btrim(p_note)
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

-- C1
create or replace function public.list_missing_bank_details()
returns table(structure_id uuid, emp_code text, name text, department text, bank_name text, account_no text, ifsc text, uan text, pan text, missing text[])
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(get_current_employee_role() in ('hr_admin','owner'), false) is not true then
    raise exception 'Not permitted';
  end if;
  return query
  select s.id, e.emp_code, e.name, e.department, s.bank_name, s.account_no, s.ifsc, s.uan, s.pan,
    array_remove(array[
      case when btrim(coalesce(s.bank_name,''))='' then 'bank_name' end,
      case when btrim(coalesce(s.account_no,''))='' then 'account_no' end,
      case when btrim(coalesce(s.ifsc,''))='' then 'ifsc' end,
      case when btrim(coalesce(s.uan,''))='' then 'uan' end,
      case when btrim(coalesce(s.pan,''))='' then 'pan' end], null)
  from employees e
  join lateral (select x.* from employee_salary_structure x
                where x.employee_id = e.id and x.effective_from <= (now() at time zone 'Asia/Kolkata')::date
                order by x.effective_from desc limit 1) s on true
  where e.is_active
    and (btrim(coalesce(s.bank_name,''))='' or btrim(coalesce(s.account_no,''))='' or btrim(coalesce(s.ifsc,''))='' or btrim(coalesce(s.uan,''))='')
  order by e.emp_code;
end $$;

-- C2 (audit row stores emp_code + field NAMES only; table_name differs from the pre-existing
-- row-trigger on employee_salary_structure, which logs full rows - see report)
create or replace function public.hr_set_bank_details(p_structure_id uuid, p_bank_name text, p_account_no text, p_ifsc text, p_uan text, p_pan text)
returns void language plpgsql security definer set search_path = public as $$
declare v_emp uuid; v_code text; v_bank text; v_acc text; v_ifsc text; v_uan text; v_pan text; v_changed text[] := array[]::text[];
begin
  if coalesce(get_current_employee_role() in ('hr_admin','owner'), false) is not true then
    raise exception 'Not permitted';
  end if;
  select employee_id into v_emp from employee_salary_structure where id = p_structure_id for update;
  if v_emp is null then raise exception 'Salary structure row not found'; end if;
  select emp_code into v_code from employees where id = v_emp;
  v_bank := nullif(btrim(coalesce(p_bank_name,'')),'');
  v_acc  := nullif(btrim(coalesce(p_account_no,'')),'');
  v_ifsc := upper(nullif(btrim(coalesce(p_ifsc,'')),''));
  v_uan  := nullif(btrim(coalesce(p_uan,'')),'');
  v_pan  := upper(nullif(btrim(coalesce(p_pan,'')),''));
  if v_bank is not null and char_length(v_bank) not between 2 and 80 then raise exception 'Invalid bank name (2-80 characters)'; end if;
  if v_acc is not null and v_acc !~ '^[0-9]{6,20}$' then raise exception 'Invalid account number (6-20 digits)'; end if;
  if v_ifsc is not null and v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then raise exception 'Invalid IFSC format'; end if;
  if v_uan is not null and v_uan !~ '^[0-9]{12}$' then raise exception 'Invalid UAN (12 digits)'; end if;
  if v_pan is not null and v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then raise exception 'Invalid PAN format'; end if;
  if v_bank is not null then update employee_salary_structure set bank_name = v_bank where id = p_structure_id; v_changed := array_append(v_changed, 'bank_name'); end if;
  if v_acc  is not null then update employee_salary_structure set account_no = v_acc where id = p_structure_id; v_changed := array_append(v_changed, 'account_no'); end if;
  if v_ifsc is not null then update employee_salary_structure set ifsc = v_ifsc where id = p_structure_id; v_changed := array_append(v_changed, 'ifsc'); end if;
  if v_uan  is not null then update employee_salary_structure set uan = v_uan where id = p_structure_id; v_changed := array_append(v_changed, 'uan'); end if;
  if v_pan  is not null then update employee_salary_structure set pan = v_pan where id = p_structure_id; v_changed := array_append(v_changed, 'pan'); end if;
  if array_length(v_changed,1) is not null then
    insert into audit_log(actor_employee_id, table_name, row_id, action, old_values, new_values)
    values (current_employee_id(), 'employee_salary_structure_hr_edit', p_structure_id::text, 'update', null,
            jsonb_build_object('emp_code', v_code, 'fields_changed', to_jsonb(v_changed)));
  end if;
end $$;

-- B4 / C: lock down
revoke execute on function public.list_pending_halfday_coff(), public.decide_halfday_coff(uuid,text,text),
  public.list_missing_bank_details(), public.hr_set_bank_details(uuid,text,text,text,text,text) from public, anon;

-- D. Task from owner (VFL1001) to HR (VFL5440), created by calling create_assigned_task as the owner
-- (applied once live; task id 0e9f6482-2f20-4d2c-a4a3-0ff7cf4bb590). Do NOT re-run.
-- select create_assigned_task(<hr id>, 'Fill missing bank / UAN details', '<description>', date '2026-11-03', 'normal');
