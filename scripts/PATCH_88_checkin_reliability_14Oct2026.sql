-- PATCH_88: check-in reliability (decision from Yash, 14 Oct 2026)
-- 1. Store the phone-reported GPS accuracy (metres) on check-in/out, so a
--    future "can't check in" complaint can be answered from data.
-- 2. server_now(): the app takes QR buckets and check-in timestamps from the
--    server clock, so a phone with a wrong clock can't break QR or lateness.
alter table public.attendance_records add column if not exists check_in_accuracy_m numeric;
alter table public.attendance_records add column if not exists check_out_accuracy_m numeric;

create or replace function public.server_now() returns timestamptz
language sql stable as $$ select now() $$;
revoke all on function public.server_now() from public, anon;
grant execute on function public.server_now() to authenticated;
