-- PATCH_69_con24_pin_refix_06Oct2026.sql
-- CON24 (Shriram Pawar) was reset AGAIN on 4 Oct 2026 with the wrong
-- (VFL-style) formula -- confirmed matches '000024', not the documented
-- consultant formula '200024' (PATCH_67 had already fixed this once, 30
-- Sep). Restoring again. Root cause of the repeat reset is not yet
-- confirmed -- likely someone running a stale/old copy of
-- scripts/HR_reset_pin.sql rather than the fixed version. Yash has also
-- flagged "HR not able to reset" -- HR Admin has no self-service way to do
-- this at all today (only Yash, via chat + raw SQL, can run this file).
-- A proper in-app PIN-reset tool for HR Admin/Owner/Plant Head is the real
-- fix for that gap -- see chat, 6 Oct 2026.

update auth.users
set encrypted_password = crypt('200024', gen_salt('bf')),
    updated_at = now()
where id = (select auth_user_id from employees where emp_code = 'CON24');

-- VERIFICATION (expect true):
-- select encrypted_password = crypt('200024', encrypted_password) from auth.users
-- where id = (select auth_user_id from employees where emp_code = 'CON24');
