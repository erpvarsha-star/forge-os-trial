-- ============================================================================
-- PATCH_47 — real device push for salary/new-hire approval notifications
-- 26 Sep 2026
--
-- PATCH_46's four functions (add_employee, request_salary_change,
-- approve_salary_change_request, reject_salary_change_request) each wrote a
-- `notifications` row directly, which only ever reached the in-app bell —
-- never an actual phone push, since nothing called the push path.
--
-- Fix: route all four through `send-push-notification` instead, the same
-- edge function every other alert in this app already uses
-- (nightly-scoring, fraud-detector, shift-reminder, mrm-reminder). It writes
-- the notifications row itself (same shape as before) AND sends the real
-- FCM/Expo push — one call replaces the manual insert.
--
-- Called the same way the pg_cron jobs already call it: net.http_post()
-- with a placeholder Authorization header, harmless because this function
-- (like every scheduled one) has verify_jwt=false — confirmed directly via
-- list_edge_functions before relying on it, not assumed from an old note.
--
-- pg_net's net.http_post() is fire-and-forget (queues the request, returns
-- immediately) — it cannot block or fail the calling transaction, so this
-- is strictly additive: nothing about the approval/rejection logic changes,
-- only where the notification goes.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Shared helper — every notify site below calls this instead of
--    inserting into `notifications` directly.
-- ---------------------------------------------------------------------------
create or replace function public.notify_via_push(
  p_employee_ids uuid[],
  p_type text,
  p_title text,
  p_body text,
  p_related_entity_type text default null,
  p_related_entity_id text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_employee_ids is null or array_length(p_employee_ids, 1) is null then
    return;
  end if;

  perform net.http_post(
    url     := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer PASTE_YOUR_KEY_HERE'
               ),
    body    := jsonb_build_object(
                 'employeeIds', to_jsonb(p_employee_ids),
                 'type', p_type,
                 'title', p_title,
                 'body', p_body,
                 'relatedEntityType', p_related_entity_type,
                 'relatedEntityId', p_related_entity_id
               )
  );
end;
$$;

-- Internal only — called by the SECURITY DEFINER functions below, which
-- execute as their owner regardless of the caller's own grants. No public
-- or authenticated grant needed or given.
revoke all on function public.notify_via_push(uuid[], text, text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. add_employee — swap the notifications insert for notify_via_push
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
  owner_ids        uuid[];
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
    requested_by
  ) values (
    new_employee_id, true,
    (p_breakup->>'ctc_annual')::numeric, (p_breakup->>'basic')::numeric,
    (p_breakup->>'hra')::numeric, (p_breakup->>'conveyance')::numeric,
    (p_breakup->>'washing')::numeric, (p_breakup->>'education')::numeric,
    (p_breakup->>'heat_allow')::numeric, (p_breakup->>'vda')::numeric,
    (p_breakup->>'production_allow')::numeric, (p_breakup->>'medical')::numeric,
    (p_breakup->>'professional_development')::numeric, (p_breakup->>'communication')::numeric,
    (p_breakup->>'uniform')::numeric,
    requester_id
  )
  returning id into new_request_id;

  select array_agg(id) into owner_ids from employees where role = 'owner' and is_active = true;
  perform notify_via_push(
    owner_ids, 'salary_change_request', 'New employee awaiting approval',
    p_name || ' (' || upper(p_emp_code) || ', ' || p_department || ') added by HR — approve to activate their login.',
    'salary_change_request', new_request_id::text
  );

  return jsonb_build_object('id', new_employee_id, 'emp_code', upper(p_emp_code), 'request_id', new_request_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. request_salary_change
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
  owner_ids       uuid[];
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
    requested_by
  ) values (
    p_employee_id, false,
    (p_breakup->>'ctc_annual')::numeric, (p_breakup->>'basic')::numeric,
    (p_breakup->>'hra')::numeric, (p_breakup->>'conveyance')::numeric,
    (p_breakup->>'washing')::numeric, (p_breakup->>'education')::numeric,
    (p_breakup->>'heat_allow')::numeric, (p_breakup->>'vda')::numeric,
    (p_breakup->>'production_allow')::numeric, (p_breakup->>'medical')::numeric,
    (p_breakup->>'professional_development')::numeric, (p_breakup->>'communication')::numeric,
    (p_breakup->>'uniform')::numeric,
    requester_id
  )
  returning id into new_request_id;

  select array_agg(id) into owner_ids from employees where role = 'owner' and is_active = true;
  perform notify_via_push(
    owner_ids, 'salary_change_request', 'Salary change awaiting approval',
    emp_name || ' (' || emp_code_val || ') — revised salary submitted by HR, needs your approval.',
    'salary_change_request', new_request_id::text
  );

  return jsonb_build_object('request_id', new_request_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. approve_salary_change_request
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
  if req.status <> 'pending' then
    raise exception 'Request % is already %', p_request_id, req.status;
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
-- 4. reject_salary_change_request
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
  if req.status <> 'pending' then
    raise exception 'Request % is already %', p_request_id, req.status;
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
-- 5. Grants unchanged from PATCH_46 (same signatures) — re-asserted since
--    this project's default privileges silently re-grant anon EXECUTE on
--    every CREATE OR REPLACE.
-- ---------------------------------------------------------------------------
revoke all on function public.add_employee(text, text, text, text, text, text, text, jsonb, uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.add_employee(text, text, text, text, text, text, text, jsonb, uuid, uuid, uuid, boolean) to authenticated;

revoke all on function public.request_salary_change(uuid, jsonb) from public, anon;
grant execute on function public.request_salary_change(uuid, jsonb) to authenticated;

revoke all on function public.approve_salary_change_request(uuid, text) from public, anon;
grant execute on function public.approve_salary_change_request(uuid, text) to authenticated;

revoke all on function public.reject_salary_change_request(uuid, text) from public, anon;
grant execute on function public.reject_salary_change_request(uuid, text) to authenticated;

commit;
