-- PATCH_79_fix_new_hire_pin_formula_06Oct2026.sql
--
-- approve_salary_change_request() had the SAME PIN-formula bug PATCH_73
-- fixed in reset_employee_pin() -- it only ever used the VFL-style 6-digit
-- formula for a brand-new hire's starting PIN, never checking for a
-- CON-prefixed emp_code. Never actually fired yet (every consultant to
-- date was added via direct SQL, not this approval RPC -- no in-app flow
-- currently submits an is_new_hire salary_change_request at all), but
-- this is the function a new consultant hired THROUGH the app would hit,
-- so it would have silently set the wrong starting PIN the first time
-- that happened. Found while answering Yash's question "is the CON24 fix
-- applicable to all new additions HR makes through the app" -- the
-- honest answer was "not fully," so this closes that gap.

create or replace function public.approve_salary_change_request(p_request_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

    -- Same CON%-branch as reset_employee_pin() (PATCH_73).
    if upper((select emp_code from employees where id = req.employee_id)) like 'CON%' then
      starting_pin := '20' || lpad(regexp_replace(
        (select emp_code from employees where id = req.employee_id), '\D', '', 'g'
      ), 4, '0');
    else
      starting_pin := lpad(regexp_replace(
        (select emp_code from employees where id = req.employee_id), '\D', '', 'g'
      ), 6, '0');
    end if;

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
$function$;

-- ---------------------------------------------------------------------------
-- VERIFICATION
-- ---------------------------------------------------------------------------
-- select pg_get_functiondef(oid) from pg_proc where proname = 'approve_salary_change_request';
-- Confirmed 6 Oct 2026: function body now contains the CON% branch.
