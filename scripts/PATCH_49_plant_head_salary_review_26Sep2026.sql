-- ============================================================================
-- PATCH_49 — Plant Head review stage for salary/new-hire approvals
-- 26 Sep 2026
--
-- Corrects a real gap: this app's own new-employee-flow.tsx has always
-- described a 4-step chain (HR Admin Entry -> Plant Head Approval -> Owner
-- Approval -> Account Activation), but PATCH_46 built a 2-step one (HR ->
-- Owner directly), skipping the Plant Head entirely. Fixed here for BOTH
-- new-hire onboarding and existing-employee salary revisions — confirmed
-- with Yash both go through the same chain, not just new hires.
--
-- salary_change_requests.status now has three live stages instead of one:
--   'pending_plant_head' -> 'pending_owner' -> 'approved' | 'rejected'
-- Rejection can happen at either stage; approval can only happen in order —
-- the owner cannot approve/reject a request the Plant Head hasn't passed on
-- yet (enforced in approve_salary_change_request/reject_salary_change_request
-- by requiring status = 'pending_owner').
--
-- bulk_apply_salary_changes (PATCH_48) is UNCHANGED — that's Yash uploading
-- directly himself, so there is no one above him in the chain to review it;
-- the review chain only applies to what HR submits.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Schema: add Plant Head's own audit columns, widen the status enum,
--    migrate the one real row currently sitting at the old 'pending' value.
-- ---------------------------------------------------------------------------
alter table public.salary_change_requests
  add column if not exists plant_head_reviewed_by uuid references public.employees(id),
  add column if not exists plant_head_reviewed_at timestamptz,
  add column if not exists plant_head_note text;

-- Drop the OLD constraint first — the data migration below writes a value
-- ('pending_plant_head') the old constraint doesn't allow either, so this
-- must come before both the UPDATE and the new constraint.
alter table public.salary_change_requests drop constraint if exists salary_change_requests_status_check;

update public.salary_change_requests set status = 'pending_plant_head' where status = 'pending';

alter table public.salary_change_requests
  add constraint salary_change_requests_status_check
  check (status in ('pending_plant_head', 'pending_owner', 'approved', 'rejected'));

alter table public.salary_change_requests alter column status set default 'pending_plant_head';

-- ---------------------------------------------------------------------------
-- 2. add_employee — insert at pending_plant_head, notify the Plant Head
--    instead of the owner.
-- ---------------------------------------------------------------------------
create or replace function public.add_employee(
  p_emp_code   text,
  p_name       text,
  p_phone      text,
  p_department text,
  p_category   text,
  p_role       text,
  p_gender     text,
  p_breakup    jsonb,
  p_manager_id uuid default null,
  p_plant_head_id uuid default null,
  p_supervisor_id uuid default null,
  p_requires_qr boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_employee_id  uuid;
  new_request_id   uuid;
  requester_id     uuid;
  plant_head_ids   uuid[];
begin
  if get_current_employee_role() <> 'hr_admin' then
    raise exception 'Permission denied: HR admin only';
  end if;

  if p_emp_code is null or trim(p_emp_code) = '' then
    raise exception 'emp_code is required';
  end if;

  if exists (select 1 from employees where upper(emp_code) = upper(p_emp_code)) then
    raise exception '% already exists', p_emp_code;
  end if;

  if p_breakup->>'ctc_annual' is null or p_breakup->>'basic' is null
     or p_breakup->>'hra' is null or p_breakup->>'conveyance' is null then
    raise exception 'ctc_annual, basic, hra and conveyance are required in the breakup';
  end if;

  select id into requester_id from employees where auth_user_id = auth.uid();

  insert into employees (
    emp_code, name, phone, department, category, role, gender,
    manager_id, plant_head_id, supervisor_id, requires_qr,
    auth_user_id, is_active, must_change_pin, language_preference
  ) values (
    upper(p_emp_code), p_name, p_phone, p_department, p_category, p_role, p_gender,
    p_manager_id, p_plant_head_id, p_supervisor_id, p_requires_qr,
    null, false, true, 'en'
  )
  returning id into new_employee_id;

  insert into salary_change_requests (
    employee_id, is_new_hire, ctc_annual, basic, hra, conveyance,
    washing, education, heat_allow, vda, production_allow,
    medical, professional_development, communication, uniform,
    status, requested_by
  ) values (
    new_employee_id, true,
    (p_breakup->>'ctc_annual')::numeric, (p_breakup->>'basic')::numeric,
    (p_breakup->>'hra')::numeric, (p_breakup->>'conveyance')::numeric,
    (p_breakup->>'washing')::numeric, (p_breakup->>'education')::numeric,
    (p_breakup->>'heat_allow')::numeric, (p_breakup->>'vda')::numeric,
    (p_breakup->>'production_allow')::numeric, (p_breakup->>'medical')::numeric,
    (p_breakup->>'professional_development')::numeric, (p_breakup->>'communication')::numeric,
    (p_breakup->>'uniform')::numeric,
    'pending_plant_head', requester_id
  )
  returning id into new_request_id;

  select array_agg(id) into plant_head_ids from employees where role = 'plant_head' and is_active = true;
  perform notify_via_push(
    plant_head_ids, 'salary_change_request', 'New employee awaiting your review',
    p_name || ' (' || upper(p_emp_code) || ', ' || p_department || ') added by HR — review before it goes to the owner.',
    'salary_change_request', new_request_id::text
  );

  return jsonb_build_object('id', new_employee_id, 'emp_code', upper(p_emp_code), 'request_id', new_request_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. request_salary_change — same change: pending_plant_head, notify Plant Head
-- ---------------------------------------------------------------------------
create or replace function public.request_salary_change(p_employee_id uuid, p_breakup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_request_id uuid;
  requester_id    uuid;
  emp_name        text;
  emp_code_val    text;
  plant_head_ids  uuid[];
begin
  if get_current_employee_role() <> 'hr_admin' then
    raise exception 'Permission denied: HR admin only';
  end if;

  select name, emp_code into emp_name, emp_code_val from employees where id = p_employee_id;
  if emp_name is null then
    raise exception 'No employee found for id %', p_employee_id;
  end if;

  if p_breakup->>'ctc_annual' is null or p_breakup->>'basic' is null
     or p_breakup->>'hra' is null or p_breakup->>'conveyance' is null then
    raise exception 'ctc_annual, basic, hra and conveyance are required in the breakup';
  end if;

  select id into requester_id from employees where auth_user_id = auth.uid();

  insert into salary_change_requests (
    employee_id, is_new_hire, ctc_annual, basic, hra, conveyance,
    washing, education, heat_allow, vda, production_allow,
    medical, professional_development, communication, uniform,
    status, requested_by
  ) values (
    p_employee_id, false,
    (p_breakup->>'ctc_annual')::numeric, (p_breakup->>'basic')::numeric,
    (p_breakup->>'hra')::numeric, (p_breakup->>'conveyance')::numeric,
    (p_breakup->>'washing')::numeric, (p_breakup->>'education')::numeric,
    (p_breakup->>'heat_allow')::numeric, (p_breakup->>'vda')::numeric,
    (p_breakup->>'production_allow')::numeric, (p_breakup->>'medical')::numeric,
    (p_breakup->>'professional_development')::numeric, (p_breakup->>'communication')::numeric,
    (p_breakup->>'uniform')::numeric,
    'pending_plant_head', requester_id
  )
  returning id into new_request_id;

  select array_agg(id) into plant_head_ids from employees where role = 'plant_head' and is_active = true;
  perform notify_via_push(
    plant_head_ids, 'salary_change_request', 'Salary change awaiting your review',
    emp_name || ' (' || emp_code_val || ') — revised salary submitted by HR, review before it goes to the owner.',
    'salary_change_request', new_request_id::text
  );

  return jsonb_build_object('request_id', new_request_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. plant_head_review_salary_change_request — new. plant_head only.
--    Approve moves it to pending_owner and notifies the owner(s); reject
--    ends it there and notifies HR back. Can only act on pending_plant_head.
-- ---------------------------------------------------------------------------
create or replace function public.plant_head_review_salary_change_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  req         record;
  reviewer_id uuid;
  owner_ids   uuid[];
begin
  if get_current_employee_role() <> 'plant_head' then
    raise exception 'Permission denied: plant head only';
  end if;

  select * into req from salary_change_requests where id = p_request_id for update;
  if req.id is null then
    raise exception 'No request found for id %', p_request_id;
  end if;
  if req.status <> 'pending_plant_head' then
    raise exception 'Request % is not awaiting plant head review (status: %)', p_request_id, req.status;
  end if;

  select id into reviewer_id from employees where auth_user_id = auth.uid();

  if p_approve then
    update salary_change_requests
       set status = 'pending_owner', plant_head_reviewed_by = reviewer_id,
           plant_head_reviewed_at = now(), plant_head_note = p_note
     where id = p_request_id;

    select array_agg(id) into owner_ids from employees where role = 'owner' and is_active = true;
    perform notify_via_push(
      owner_ids, 'salary_change_request',
      case when req.is_new_hire then 'New employee ready for your approval' else 'Salary change ready for your approval' end,
      (select name || ' (' || emp_code || ')' from employees where id = req.employee_id) || ' — approved by the plant head, needs your final sign-off.',
      'salary_change_request', p_request_id::text
    );

    return jsonb_build_object('request_id', p_request_id, 'status', 'pending_owner');
  else
    update salary_change_requests
       set status = 'rejected', plant_head_reviewed_by = reviewer_id,
           plant_head_reviewed_at = now(), plant_head_note = p_note
     where id = p_request_id;

    if req.requested_by is not null then
      perform notify_via_push(
        array[req.requested_by], 'salary_change_request',
        case when req.is_new_hire then 'New employee rejected' else 'Salary change rejected' end,
        (select name || ' (' || emp_code || ')' from employees where id = req.employee_id) ||
          ' — rejected by the plant head' || coalesce(': ' || p_note, '.'),
        'salary_change_request', p_request_id::text
      );
    end if;

    return jsonb_build_object('request_id', p_request_id, 'status', 'rejected');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. approve_salary_change_request — now only reachable once the plant head
--    has passed it on (status = 'pending_owner').
-- ---------------------------------------------------------------------------
create or replace function public.approve_salary_change_request(p_request_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  req              record;
  reviewer_id      uuid;
  new_user_id      uuid;
  synthetic_email  text;
  starting_pin     text;
  has_provider_id  boolean;
  result           jsonb;
begin
  if get_current_employee_role() <> 'owner' then
    raise exception 'Permission denied: owner only';
  end if;

  select * into req from salary_change_requests where id = p_request_id for update;
  if req.id is null then
    raise exception 'No request found for id %', p_request_id;
  end if;
  if req.status <> 'pending_owner' then
    raise exception 'Request % is not awaiting owner approval (status: %)', p_request_id, req.status;
  end if;

  select id into reviewer_id from employees where auth_user_id = auth.uid();

  update employee_salary_structure
     set is_active = false
   where employee_id = req.employee_id and is_active = true;

  insert into employee_salary_structure (
    employee_id, ctc_annual, basic, hra, conveyance, washing, education,
    heat_allow, vda, production_allow, medical, professional_development,
    communication, uniform, effective_from, is_active
  ) values (
    req.employee_id, req.ctc_annual, req.basic, req.hra, req.conveyance,
    req.washing, req.education, req.heat_allow, req.vda, req.production_allow,
    req.medical, req.professional_development, req.communication, req.uniform,
    current_date, true
  );

  if req.is_new_hire then
    select emp_code into synthetic_email from employees where id = req.employee_id;
    synthetic_email := lower(synthetic_email) || '@forgeos.local';
    starting_pin := lpad(regexp_replace(
      (select emp_code from employees where id = req.employee_id), '\D', '', 'g'
    ), 6, '0');

    if exists (select 1 from auth.users where email = synthetic_email) then
      raise exception 'An auth user for this employee already exists — resolve manually';
    end if;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'identities'
        and column_name = 'provider_id'
    ) into has_provider_id;

    new_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      is_super_admin
    ) values (
      '00000000-0000-0000-0000-000000000000',
      new_user_id, 'authenticated', 'authenticated', synthetic_email,
      extensions.crypt(starting_pin, extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('emp_code', (select emp_code from employees where id = req.employee_id)),
      '', '', '', '', false
    );

    if has_provider_id then
      insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), new_user_id, new_user_id,
        jsonb_build_object('sub', new_user_id::text, 'email', synthetic_email),
        'email', now(), now(), now());
    else
      insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (new_user_id::text, new_user_id,
        jsonb_build_object('sub', new_user_id::text, 'email', synthetic_email),
        'email', now(), now(), now());
    end if;

    update employees
       set auth_user_id = new_user_id, is_active = true, must_change_pin = true, updated_at = now()
     where id = req.employee_id;

    result := jsonb_build_object('starting_pin', starting_pin);
  end if;

  update salary_change_requests
     set status = 'approved', reviewed_by = reviewer_id, reviewed_at = now(), note = p_note
   where id = p_request_id;

  if req.requested_by is not null then
    perform notify_via_push(
      array[req.requested_by],
      'salary_change_request',
      case when req.is_new_hire then 'New employee approved' else 'Salary change approved' end,
      (select name || ' (' || emp_code || ')' from employees where id = req.employee_id) || ' — approved.',
      'salary_change_request', p_request_id::text
    );
  end if;

  return coalesce(result, '{}'::jsonb) || jsonb_build_object('request_id', p_request_id, 'status', 'approved');
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. reject_salary_change_request — same guard: only from pending_owner.
-- ---------------------------------------------------------------------------
create or replace function public.reject_salary_change_request(p_request_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  req record;
  reviewer_id uuid;
begin
  if get_current_employee_role() <> 'owner' then
    raise exception 'Permission denied: owner only';
  end if;

  select * into req from salary_change_requests where id = p_request_id for update;
  if req.id is null then
    raise exception 'No request found for id %', p_request_id;
  end if;
  if req.status <> 'pending_owner' then
    raise exception 'Request % is not awaiting owner review (status: %)', p_request_id, req.status;
  end if;

  select id into reviewer_id from employees where auth_user_id = auth.uid();

  update salary_change_requests
     set status = 'rejected', reviewed_by = reviewer_id, reviewed_at = now(), note = p_note
   where id = p_request_id;

  if req.requested_by is not null then
    perform notify_via_push(
      array[req.requested_by],
      'salary_change_request',
      case when req.is_new_hire then 'New employee rejected' else 'Salary change rejected' end,
      (select name || ' (' || emp_code || ')' from employees where id = req.employee_id) ||
        ' — rejected' || coalesce(': ' || p_note, '.'),
      'salary_change_request', p_request_id::text
    );
  end if;

  return jsonb_build_object('request_id', p_request_id, 'status', 'rejected');
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.plant_head_review_salary_change_request(uuid, boolean, text) from public, anon;
grant execute on function public.plant_head_review_salary_change_request(uuid, boolean, text) to authenticated;

revoke all on function public.add_employee(text, text, text, text, text, text, text, jsonb, uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.add_employee(text, text, text, text, text, text, text, jsonb, uuid, uuid, uuid, boolean) to authenticated;

revoke all on function public.request_salary_change(uuid, jsonb) from public, anon;
grant execute on function public.request_salary_change(uuid, jsonb) to authenticated;

revoke all on function public.approve_salary_change_request(uuid, text) from public, anon;
grant execute on function public.approve_salary_change_request(uuid, text) to authenticated;

revoke all on function public.reject_salary_change_request(uuid, text) from public, anon;
grant execute on function public.reject_salary_change_request(uuid, text) to authenticated;

commit;
