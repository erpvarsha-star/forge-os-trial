-- PATCH_67_con24_pin_fix_30Sep2026.sql
-- Fixes CON24 (Shriram Pawar) being unable to log in.
--
-- Root cause: scripts/HR_reset_pin.sql was run against CON24 on 30 Sep 2026
-- (auth.users.updated_at moved to that date) using the script's generic
-- VFL-style PIN formula (digits padded to 6 = '000024'). Every CON-prefixed
-- (consultant) login was actually provisioned by PATCH_35/PATCH_62 with a
-- DIFFERENT formula — '20' + last 4 digits, padded to 4 ('200024') — so the
-- reset silently overwrote his real starting PIN with the wrong value.
-- Yash/HR would have told him the documented '200024' (correct per
-- CLAUDE.md), which no longer matched what was in the DB.
--
-- Fix: restore the password to the documented consultant-formula value.
-- Safe and non-destructive — must_change_pin was still true, so he had
-- never completed a first login; nothing of his own is lost.
--
-- scripts/HR_reset_pin.sql itself is fixed in the same commit so this
-- cannot recur for any other consultant.

update auth.users
set encrypted_password = crypt('200024', gen_salt('bf')),
    updated_at = now()
where id = (select auth_user_id from employees where emp_code = 'CON24');

-- ---------------------------------------------------------------------------
-- VERIFICATION — run after applying (expect true)
-- ---------------------------------------------------------------------------
-- select encrypted_password = crypt('200024', encrypted_password) as fixed
-- from auth.users
-- where id = (select auth_user_id from employees where emp_code = 'CON24');
