-- PATCH_93 -- lock attach_arrears_sep26_30 to service_role only (20 Oct 2026)
--
-- Why: public.attach_arrears_sep26_30(uuid, numeric) is SECURITY DEFINER with
-- no role check and was executable by PUBLIC/anon/authenticated, so anyone
-- holding the public app key could call it and change pay_run_items net pay.
-- Its only caller is the payroll-run edge function, which uses the
-- service-role key. Decision from Yash, 20 Oct 2026.

revoke all on function public.attach_arrears_sep26_30(uuid, numeric) from public;
revoke all on function public.attach_arrears_sep26_30(uuid, numeric) from anon;
revoke all on function public.attach_arrears_sep26_30(uuid, numeric) from authenticated;
grant execute on function public.attach_arrears_sep26_30(uuid, numeric) to service_role;
