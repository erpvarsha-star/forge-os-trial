-- PATCH_73_fix_reset_employee_pin_con_formula_06Oct2026.sql
--
-- The ACTUAL root cause of CON24's repeat PIN breakage, found 6 Oct 2026.
--
-- reset_employee_pin() has existed since PATCH_45/46 (26 Sep 2026), wired
-- into app/(hr-admin)/missing-data.tsx's "type an emp_code, reset their
-- PIN" box -- a real, already-shipped HR self-service tool, not a stale
-- SQL Editor query as earlier sessions wrongly assumed (see CLAUDE.md,
-- "Consultant PIN formula bug", corrected same day as this patch). It
-- only ever implemented the VFL-style formula (digits padded to 6).
-- CON24 was added two days after this tool shipped (PATCH_62, 28 Sep) and
-- is the only consultant who has needed it since -- every other
-- consultant either had a working login before PATCH_45 existed, or
-- logged in before ever needing a reset. Every time HR used this tool on
-- him, it silently set the wrong PIN (000024 instead of 200024).
--
-- Same branch-by-prefix fix already applied to scripts/HR_reset_pin.sql
-- on 30 Sep (PATCH_67's companion fix) -- this is the one that actually
-- matters, since it's the one real humans click, as opposed to a SQL
-- file nobody but Claude ever runs.

create or replace function public.reset_employee_pin(p_employee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

  if upper(target_code) like 'CON%' then
    starting_pin := '20' || lpad(regexp_replace(target_code, '\D', '', 'g'), 4, '0');
  else
    starting_pin := lpad(regexp_replace(target_code, '\D', '', 'g'), 6, '0');
  end if;

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
$function$;

-- ---------------------------------------------------------------------------
-- VERIFICATION
-- ---------------------------------------------------------------------------
-- CON24's PIN was also re-fixed to 200024 directly (he'd been reset to
-- 000024 again before this patch landed):
-- update auth.users set encrypted_password = crypt('200024', gen_salt('bf')), updated_at = now()
-- where id = (select auth_user_id from employees where emp_code = 'CON24');
--
-- select encrypted_password = crypt('200024', encrypted_password) as con24_fixed
-- from auth.users where id = (select auth_user_id from employees where emp_code='CON24');
