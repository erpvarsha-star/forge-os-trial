-- ============================================================================
-- PATCH_45 — GPS geofence tightening + HR self-service RPCs
-- 26 Sep 2026
--
-- Three independent changes, requested directly by Yash:
--
-- 1. GPS check-in radius reduced 100m -> 15m on the 12 real campus points in
--    plant_locations. The whole campus spans only 134.7m end to end (checked
--    directly against the live coordinates), so the old 100m radius on every
--    point pushed the effective check-in boundary well past the property
--    line — reachable from a public street corner, exactly what was
--    reported. "Pune Office" (200m, not part of the original 12-point seed)
--    is deliberately left untouched — it's a different kind of location
--    (VFL1567's remote office, requires_qr already false for her) and wasn't
--    part of what was reported as a problem.
--
-- 2. reset_employee_pin() — the SQL Editor block in HR_reset_pin.sql, as a
--    callable RPC so it can be a button on missing-data.tsx instead of a
--    manual per-incident SQL run. Same exact logic, same starting-PIN
--    derivation, same must_change_pin re-arm.
--
-- 3. add_employee() — the single-employee version of PATCH_10's
--    auth-provisioning loop, as a callable RPC so HR can onboard someone new
--    from an in-app form instead of a hand-written INSERT + a re-run of
--    PATCH_10's whole loop. Inserts the employees row AND provisions their
--    synthetic-email/PIN-as-password auth user in one transaction, so HR can
--    never end up with an employee who has no way to log in.
--
-- Safe to re-run: RPCs are CREATE OR REPLACE; the radius UPDATE is
-- idempotent (just re-sets the same value).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. GPS radius
-- ---------------------------------------------------------------------------
update plant_locations
   set radius_meters = 15
 where name <> 'Pune Office';

update plant_config
   set config_value = '15'::jsonb,
       updated_at = now()
 where config_key = 'geofence_radius_meters';

-- ---------------------------------------------------------------------------
-- 2. reset_employee_pin — HR self-service "forgot PIN" fix
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
  if not is_management() then
    raise exception 'Permission denied: management only';
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

  -- pgcrypto (crypt/gen_salt) lives in the `extensions` schema on this
  -- project, not `public` — must be schema-qualified since this function's
  -- search_path is deliberately narrowed to (public, pg_temp).
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

-- This project grants EXECUTE on every new public-schema function to
-- anon+authenticated by default (ALTER DEFAULT PRIVILEGES) — revoke from
-- anon explicitly, not just `public`, or it silently comes back on any
-- future CREATE OR REPLACE of this function.
revoke all on function public.reset_employee_pin(uuid) from public, anon;
grant execute on function public.reset_employee_pin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. add_employee — HR self-service onboarding
-- ---------------------------------------------------------------------------
create or replace function public.add_employee(
  p_emp_code   text,
  p_name       text,
  p_phone      text,
  p_department text,
  p_category   text,
  p_role       text,
  p_gender     text default null,
  p_salary     numeric default null,
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
  new_employee_id uuid;
  new_user_id     uuid;
  synthetic_email text;
  starting_pin    text;
  has_provider_id boolean;
begin
  if not is_management() then
    raise exception 'Permission denied: management only';
  end if;

  if p_emp_code is null or trim(p_emp_code) = '' then
    raise exception 'emp_code is required';
  end if;

  if exists (select 1 from employees where upper(emp_code) = upper(p_emp_code)) then
    raise exception '% already exists', p_emp_code;
  end if;

  synthetic_email := lower(p_emp_code) || '@forgeos.local';
  starting_pin    := lpad(regexp_replace(p_emp_code, '\D', '', 'g'), 6, '0');

  if exists (select 1 from auth.users where email = synthetic_email) then
    raise exception 'An auth user for % already exists (partial add?) — resolve manually', p_emp_code;
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
    new_user_id,
    'authenticated',
    'authenticated',
    synthetic_email,
    extensions.crypt(starting_pin, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('emp_code', p_emp_code),
    '', '', '', '',
    false
  );

  if has_provider_id then
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), new_user_id, new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', synthetic_email),
      'email', now(), now(), now()
    );
  else
    insert into auth.identities (
      id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      new_user_id::text, new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', synthetic_email),
      'email', now(), now(), now()
    );
  end if;

  insert into employees (
    emp_code, name, phone, department, category, role, gender, salary,
    manager_id, plant_head_id, supervisor_id, requires_qr,
    auth_user_id, is_active, must_change_pin, language_preference
  ) values (
    upper(p_emp_code), p_name, p_phone, p_department, p_category, p_role, p_gender, p_salary,
    p_manager_id, p_plant_head_id, p_supervisor_id, p_requires_qr,
    new_user_id, true, true, 'en'
  )
  returning id into new_employee_id;

  return jsonb_build_object(
    'id', new_employee_id,
    'emp_code', upper(p_emp_code),
    'starting_pin', starting_pin
  );
end;
$$;

revoke all on function public.add_employee(text, text, text, text, text, text, text, numeric, uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.add_employee(text, text, text, text, text, text, text, numeric, uuid, uuid, uuid, boolean) to authenticated;

commit;

-- ============================================================================
-- VERIFICATION — done 26 Sep 2026, this session
-- ============================================================================
-- select name, radius_meters from plant_locations order by name;
--   -> every row 15 except "Pune Office" (200)  ✅ confirmed
--
-- select config_value from plant_config where config_key = 'geofence_radius_meters';
--   -> 15  ✅ confirmed
--
-- add_employee / reset_employee_pin tested inside a transaction impersonating
-- a real hr_admin (Pallavi, VFL5440) via `set local request.jwt.claims`, then
-- rolled back — confirmed both the permission gate and the happy path work
-- before either was wired to a button. Also confirmed both are back to
-- authenticated-only after the pgcrypto fix (this project's default
-- privileges silently re-grant anon EXECUTE on every CREATE OR REPLACE —
-- see the comment above each revoke).
--
-- Real usage, same session: VFL5464 (Nidhi Kumari, Quality, staff, female —
-- gender already confirmed by Yash in PATCH_33, just never had a row) added
-- for real via add_employee(). Starting PIN 005464, must_change_pin=true.
-- VFL5465/VFL5466 deliberately NOT added — PATCH_29 already found and
-- excluded these two as placeholder/test rows (email "aaaaa"/"aaaaaa", IFSC
-- "000000", PAN "asdfgh") when seeding employee_salary_structure; the phone
-- list Yash just sent carries the same placeholder emails for them, so
-- treating them as still-not-real rather than re-litigating that finding.
-- ============================================================================
