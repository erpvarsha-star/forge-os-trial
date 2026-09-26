-- ============================================================================
-- PATCH_46 — Owner-approved salary changes + new-hire onboarding
-- 26 Sep 2026
--
-- Requested directly by Yash, correcting PATCH_45's add_employee: salary
-- must never be settable by HR alone, and a new hire's account must not
-- go live the moment HR submits it. Both now go through the same
-- request/approve shape:
--
--   HR submits (hr_admin only) -> owner reviews & approves/rejects (owner
--   only) -> only on approval does anything actually take effect
--   (employee_salary_structure gets written; for a new hire, THAT is also
--   the moment their auth login is provisioned and is_active flips true).
--
-- Two request shapes share one table, `salary_change_requests`:
--   - New hire: add_employee() creates the `employees` row as
--     is_active=false (no auth_user_id yet — nothing to log into) plus a
--     pending request with is_new_hire=true. Reuses new-employee-flow.tsx's
--     existing "Pending Activations" list (already filters is_active=false)
--     with zero changes needed there.
--   - Existing employee salary revision: request_salary_change() just adds
--     a request against an employee who already exists and is active.
--
-- Supersedes PATCH_45's add_employee(...) signature (that version
-- provisioned login immediately and only took a single salary number —
-- both wrong per this session's discussion). Dropped and replaced below.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. reset_employee_pin — narrow from is_management() to hr_admin only.
--    "PIN reset for anyone can be done only by HR. We don't give this
--    feature to anyone else" — manager/plant_head/owner included.
-- ---------------------------------------------------------------------------
create or replace function public.reset_employee_pin(p_employee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_code    text;
  target_auth_id uuid;
  starting_pin   text;
begin
  if get_current_employee_role() <> 'hr_admin' then
    raise exception 'Permission denied: HR admin only';
  end if;

  select emp_code, auth_user_id into target_code, target_auth_id
  from employees
  where id = p_employee_id;

  if target_code is null then
    raise exception 'No employee found for id %', p_employee_id;
  end if;

  if target_auth_id is null then
    raise exception '% has no auth user provisioned yet', target_code;
  end if;

  starting_pin := lpad(regexp_replace(target_code, '\D', '', 'g'), 6, '0');

  update auth.users
     set encrypted_password = extensions.crypt(starting_pin, extensions.gen_salt('bf')),
         updated_at = now()
   where id = target_auth_id;

  update employees
     set must_change_pin = true,
         updated_at = now()
   where id = p_employee_id;

  return jsonb_build_object('emp_code', target_code, 'starting_pin', starting_pin);
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. salary_change_requests — the approval queue
-- ---------------------------------------------------------------------------
create table if not exists public.salary_change_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  is_new_hire   boolean not null default false,
  ctc_annual    numeric not null,
  basic         numeric not null,
  hra           numeric not null,
  conveyance    numeric not null,
  washing       numeric,
  education     numeric,
  heat_allow    numeric,
  vda           numeric,
  production_allow numeric,
  medical       numeric,
  professional_development numeric,
  communication numeric,
  uniform       numeric,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by  uuid not null references public.employees(id),
  requested_at  timestamptz not null default now(),
  reviewed_by   uuid references public.employees(id),
  reviewed_at   timestamptz,
  note          text
);

create index if not exists idx_salary_change_requests_status
  on public.salary_change_requests(status);

alter table public.salary_change_requests enable row level security;

-- Read-only for management via RLS; every write goes through the RPCs below.
create policy salary_change_requests_select on public.salary_change_requests
  for select using (is_management());

-- ---------------------------------------------------------------------------
-- 2. add_employee — rewritten. hr_admin only. Creates the employee row
--    INACTIVE with no auth user (nothing to log into yet) and a pending
--    new-hire salary request. Drops PATCH_45's old signature first since a
--    different parameter list would otherwise sit alongside it as a second
--    overload instead of replacing it.
-- ---------------------------------------------------------------------------
drop function if exists public.add_employee(text, text, text, text, text, text, text, numeric, uuid, uuid, uuid, boolean);

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

  -- INACTIVE, no auth_user_id — there is nothing to log into until an owner
  -- approves the pending request created below.
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

  insert into notifications (user_id, title, body, type, read, related_entity_type, related_entity_id)
  select e.id,
         'New employee awaiting approval',
         p_name || ' (' || upper(p_emp_code) || ', ' || p_department || ') added by HR — approve to activate their login.',
         'salary_change_request', false, 'salary_change_request', new_request_id::text
  from employees e
  where e.role = 'owner' and e.is_active = true;

  return jsonb_build_object('id', new_employee_id, 'emp_code', upper(p_emp_code), 'request_id', new_request_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. request_salary_change — existing employee, hr_admin only.
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

  insert into notifications (user_id, title, body, type, read, related_entity_type, related_entity_id)
  select e.id,
         'Salary change awaiting approval',
         emp_name || ' (' || emp_code_val || ') — revised salary submitted by HR, needs your approval.',
         'salary_change_request', false, 'salary_change_request', new_request_id::text
  from employees e
  where e.role = 'owner' and e.is_active = true;

  return jsonb_build_object('request_id', new_request_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. approve_salary_change_request — owner only.
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

  -- Supersede any previously-active breakup for this employee, then insert
  -- the newly approved one as the live row.
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

  insert into notifications (user_id, title, body, type, read, related_entity_type, related_entity_id)
  select req.requested_by,
         case when req.is_new_hire then 'New employee approved' else 'Salary change approved' end,
         (select name || ' (' || emp_code || ')' from employees where id = req.employee_id) || ' — approved.',
         'salary_change_request', false, 'salary_change_request', p_request_id::text
  where req.requested_by is not null;

  return coalesce(result, '{}'::jsonb) || jsonb_build_object('request_id', p_request_id, 'status', 'approved');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. reject_salary_change_request — owner only.
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

  insert into notifications (user_id, title, body, type, read, related_entity_type, related_entity_id)
  select req.requested_by,
         case when req.is_new_hire then 'New employee rejected' else 'Salary change rejected' end,
         (select name || ' (' || emp_code || ')' from employees where id = req.employee_id) ||
           ' — rejected' || coalesce(': ' || p_note, '.'),
         'salary_change_request', false, 'salary_change_request', p_request_id::text
  where req.requested_by is not null;

  return jsonb_build_object('request_id', p_request_id, 'status', 'rejected');
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Grants — authenticated only, anon explicitly excluded (this project's
--    default privileges silently re-grant anon EXECUTE on every CREATE OR
--    REPLACE — see PATCH_45's note).
-- ---------------------------------------------------------------------------
revoke all on function public.reset_employee_pin(uuid) from public, anon;
grant execute on function public.reset_employee_pin(uuid) to authenticated;

revoke all on function public.add_employee(text, text, text, text, text, text, text, jsonb, uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.add_employee(text, text, text, text, text, text, text, jsonb, uuid, uuid, uuid, boolean) to authenticated;

revoke all on function public.request_salary_change(uuid, jsonb) from public, anon;
grant execute on function public.request_salary_change(uuid, jsonb) to authenticated;

revoke all on function public.approve_salary_change_request(uuid, text) from public, anon;
grant execute on function public.approve_salary_change_request(uuid, text) to authenticated;

revoke all on function public.reject_salary_change_request(uuid, text) from public, anon;
grant execute on function public.reject_salary_change_request(uuid, text) to authenticated;

commit;
