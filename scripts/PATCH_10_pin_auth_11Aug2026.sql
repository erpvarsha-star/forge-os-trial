-- ============================================================================
-- PATCH_10 — PIN authentication (replaces Phone OTP as the login mechanism)
-- 11 Aug 2026
--
-- WHY: Supabase Phone OTP needs a configured SMS provider. In India that also
-- means TRAI DLT registration (company docs, days-to-weeks approval) plus a
-- per-message cost for 129 employees. Sending OTP without a provider fails
-- with "Unsupported phone provider", which is what the trial hit.
--
-- This patch switches login to employee code (or mobile number) + a 6-digit
-- PIN, which needs no external provider, no DLT registration and no per-login
-- cost.
--
-- The OTP path is deliberately NOT removed — app/(auth)/login-otp.tsx.bak and
-- the phone-based RLS claim policy below are both left intact so OTP can be
-- restored if PIN sharing turns out to be a problem in practice.
--
-- HOW IT WORKS: Supabase Auth has no native "PIN" mode, so each employee gets
-- a real Supabase auth user whose email is synthetic (<empcode>@forgeos.local)
-- and whose password IS the PIN. That keeps us on supported, battle-tested
-- Supabase Auth (real JWTs, real sessions, refresh handling) instead of
-- hand-rolled auth, and every existing RLS policy keyed on
-- employees.auth_user_id = auth.uid() keeps working unchanged.
--
-- ⚠ RUN THIS IN THE SUPABASE SQL EDITOR (needs privileges the app never has).
-- ⚠ Safe to re-run: every step is guarded and skips already-provisioned rows.
--
-- ⚠⚠ DASHBOARD PREREQUISITE — CHECK THIS FIRST, IT WILL SILENTLY BLOCK LOGIN
-- Because this project was set up for Phone OTP, the Email auth provider may
-- be switched off. PIN login signs in with email+password under the hood, so
-- if Email is disabled every login fails no matter what this patch does —
-- the same shape of problem as "Unsupported phone provider".
--
--   Supabase dashboard -> Authentication -> Providers -> Email -> ENABLED
--   "Confirm email" can stay off; this patch sets email_confirmed_at itself.
--
-- Also check Authentication -> Policies (or Providers -> Email) for a minimum
-- password length above 6 — PINs are exactly 6 digits and a higher minimum
-- would reject them at the change-PIN step. If "leaked password protection"
-- is enabled it may also reject very common 6-digit PINs; the app already
-- blocks the obvious ones (see WEAK_PINS in app/(auth)/change-pin.tsx) and
-- shows a "choose another PIN" error if Supabase rejects one.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Extensions + schema
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- Forces every employee off their derived starting PIN at first login.
alter table employees
  add column if not exists must_change_pin boolean not null default true;

comment on column employees.must_change_pin is
  'True until the employee sets their own PIN. Starting PINs are derived from '
  'emp_code and are therefore guessable, so the app routes to the change-PIN '
  'screen while this is true.';

-- ---------------------------------------------------------------------------
-- 2. Provision a Supabase auth user for every active employee
--
--    Starting PIN = the digits of emp_code, left-padded to 6.
--      VFL1001 -> 001001     VFL5440 -> 005440
--    Per-employee (NOT one shared default) on purpose: a single shared
--    starting PIN would let anyone sign in as any colleague who had not yet
--    logged in for the first time.
-- ---------------------------------------------------------------------------
do $$
declare
  emp            record;
  new_user_id    uuid;
  synthetic_email text;
  starting_pin   text;
  has_provider_id boolean;
begin
  -- auth.identities gained a separate provider_id column in later GoTrue
  -- versions; detect rather than assume so this runs on either.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities'
      and column_name = 'provider_id'
  ) into has_provider_id;

  for emp in
    select id, emp_code
    from employees
    where is_active = true
      and auth_user_id is null
      and emp_code is not null
  loop
    synthetic_email := lower(emp.emp_code) || '@forgeos.local';
    starting_pin    := lpad(regexp_replace(emp.emp_code, '\D', '', 'g'), 6, '0');

    -- Skip if this synthetic email somehow already exists (partial re-run).
    if exists (select 1 from auth.users u where u.email = synthetic_email) then
      update employees e
         set auth_user_id = (select u.id from auth.users u where u.email = synthetic_email)
       where e.id = emp.id and e.auth_user_id is null;
      continue;
    end if;

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
      crypt(starting_pin, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('emp_code', emp.emp_code),
      '', '', '', '',
      false
    );

    -- GoTrue expects a matching identity row for the email provider.
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

    update employees set auth_user_id = new_user_id where id = emp.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Identifier -> synthetic email resolver
--
--    The login screen must turn "VFL1001" or "9823080707" into the synthetic
--    email before it can call signInWithPassword, but at that point the user
--    is still anonymous and RLS (correctly) hides the employees table. This
--    SECURITY DEFINER function is the narrow, deliberate exception: it returns
--    ONLY the synthetic email string and nothing else about the employee.
--
--    It does reveal whether a given code/number exists. That is an accepted
--    trade-off for an internal app whose employee codes are printed on ID
--    cards; the PIN, not the identifier, is the secret.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_login_identifier(identifier text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select lower(e.emp_code) || '@forgeos.local'
  from employees e
  where e.is_active = true
    and e.auth_user_id is not null
    and trim(identifier) <> ''
    and (
      upper(trim(identifier)) = upper(e.emp_code)
      -- Match a mobile number whether or not the +91 country code is typed.
      --
      -- The digit-count guard is load-bearing, not defensive padding: an
      -- earlier version compared against coalesce(e.phone,'<sentinel>') with
      -- a digit-free sentinel, so stripping non-digits reduced BOTH sides to
      -- '' and any digit-free input (including the empty string) resolved to
      -- the first employee with a NULL phone. Roughly a third of employees
      -- have no phone, so that was always reachable. Requiring >= 10 digits
      -- and a non-null phone closes it.
      or (
        e.phone is not null
        and length(regexp_replace(trim(identifier), '\D', '', 'g')) >= 10
        and (
          regexp_replace(trim(identifier), '\D', '', 'g') =
            regexp_replace(e.phone, '\D', '', 'g')
          or regexp_replace(trim(identifier), '\D', '', 'g') =
            right(regexp_replace(e.phone, '\D', '', 'g'), 10)
        )
      )
    )
  limit 1;
$$;

revoke all on function public.resolve_login_identifier(text) from public;
grant execute on function public.resolve_login_identifier(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Clearing the must_change_pin flag
--
--    Done through a SECURITY DEFINER function rather than an RLS UPDATE policy
--    on purpose: a policy broad enough to let employees update their own row
--    would also let them edit their own role, salary or supervisor_id. This
--    touches exactly one boolean on exactly the caller's own row.
-- ---------------------------------------------------------------------------
create or replace function public.mark_pin_changed()
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update employees
     set must_change_pin = false,
         updated_at = now()
   where auth_user_id = auth.uid();
$$;

revoke all on function public.mark_pin_changed() from public;
grant execute on function public.mark_pin_changed() to authenticated;

commit;

-- ============================================================================
-- VERIFICATION — run these separately after the patch and eyeball the results
-- ============================================================================
-- Every active employee should now have an auth user (expect 0 rows):
--   select emp_code, name from employees where is_active and auth_user_id is null;
--
-- Provisioned count (expect it to match your active employee count):
--   select count(*) from employees where is_active and auth_user_id is not null;
--
-- Yash's starting PIN (VFL1001 -> 001001):
--   select emp_code, lpad(regexp_replace(emp_code,'\D','','g'),6,'0') as starting_pin
--   from employees where emp_code = 'VFL1001';
--
-- Resolver works for both an employee code and a mobile number:
--   select public.resolve_login_identifier('VFL1001');
--   select public.resolve_login_identifier('9823080707');
--
-- ============================================================================
-- ROLLBACK BACK TO OTP (if PIN sharing becomes a problem)
-- ============================================================================
-- The phone-based "employees_self_claim" RLS policy from FINAL_SCHEMA is left
-- in place and still works, and app/(auth)/login-otp.tsx.bak is the original
-- OTP screen. To revert: configure an SMS provider in Supabase, restore that
-- screen over login.tsx, and revert hooks/useAuth.ts. Nothing here needs
-- undoing first — the provisioned auth users are simply no longer used.
-- ============================================================================
