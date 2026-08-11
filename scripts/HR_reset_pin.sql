-- ============================================================================
-- HR utility — reset one employee back to their starting PIN
--
-- WHY YOU NEED THIS
-- Logging in as someone else (e.g. to check what a supervisor sees) forces a
-- PIN change, because must_change_pin gates every screen. Once you set a new
-- PIN, that employee's starting PIN no longer works and they cannot get in.
-- Run this afterwards to put their account back exactly as it was.
--
-- It is also the everyday "I forgot my PIN" fix for HR.
--
-- HOW TO USE
--   1. Edit the emp_code on the line marked  <<< CHANGE THIS
--   2. Run the whole block in the Supabase SQL Editor
--   3. Tell the employee their PIN is their code padded to 6 digits
--      (VFL1066 -> 001066) and that the app will ask them to set a new one
--
-- Requires pgcrypto, already enabled by PATCH_10.
-- ============================================================================

do $$
declare
  target_code text := 'VFL1066';   -- <<< CHANGE THIS to the employee's code
  starting_pin text;
  target_auth_id uuid;
begin
  select auth_user_id into target_auth_id
  from employees
  where upper(emp_code) = upper(target_code);

  if target_auth_id is null then
    raise exception
      'No auth user for %. Either the code is wrong, the employee is inactive, or PATCH_10 has not been run for them.',
      target_code;
  end if;

  -- Same derivation PATCH_10 used: digits of emp_code, left-padded to 6.
  starting_pin := lpad(regexp_replace(target_code, '\D', '', 'g'), 6, '0');

  update auth.users
     set encrypted_password = crypt(starting_pin, gen_salt('bf')),
         updated_at = now()
   where id = target_auth_id;

  -- Re-arm the forced change, so they are pushed off the derived PIN again
  -- rather than being left sitting on a guessable one.
  update employees
     set must_change_pin = true,
         updated_at = now()
   where auth_user_id = target_auth_id;

  raise notice 'Reset % — starting PIN is now %', target_code, starting_pin;
end $$;

-- ----------------------------------------------------------------------------
-- Handy lookup: starting PIN for every active employee (does NOT reset
-- anything — read-only). Useful for HR when onboarding people to the app.
-- Note this only tells you the STARTING pin; once someone sets their own,
-- it cannot be read back, only reset with the block above.
-- ----------------------------------------------------------------------------
-- select emp_code, name, role,
--        lpad(regexp_replace(emp_code,'\D','','g'),6,'0') as starting_pin,
--        must_change_pin as still_on_starting_pin
-- from employees
-- where is_active = true
-- order by role, emp_code;
