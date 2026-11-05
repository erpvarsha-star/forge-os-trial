-- PATCH_132 — Payroll feeds confirmation gate (5 Nov 2026)
--
-- Owner's own words (5 Nov 2026): "what i was asking is when can it be pushed for salary
-- calculation, how do they say it's good to process, or when they click 'run salary' it
-- considers everything is entered... we could just ask them for confirmation before payroll
-- run function is activated by them to confirm all fields like canteen efficiency are final."
--
-- Adds an explicit "HR confirms the feeds are final" step to a draft pay_runs row, gated into
-- the existing `calculate` action (supabase/functions/payroll-run/index.ts) alongside its other
-- gates (feed-approval pending check, monthly VDA rate, pay_run_ready_to_calculate). Any later
-- edit to one of the 4 feed tables (canteen/society/adjustments/efficiency) for that run's month
-- automatically un-confirms it, since the confirmation is now stale.
--
-- Additive only. Never run against production without review.

-- 1. New columns on pay_runs (nullable; NULL = not confirmed)
alter table public.pay_runs
  add column if not exists feeds_confirmed_by uuid references public.employees(id),
  add column if not exists feeds_confirmed_at timestamptz;

-- 2. confirm_pay_run_feeds(p_run_id) — owner/hr_admin only, draft runs only.
--    Stores a plain UTC now() into feeds_confirmed_at (timestamptz) — never istNow()/its SQL
--    equivalent, per this project's locked IST rule (istNow() must never be written to a
--    timestamptz column).
create or replace function public.confirm_pay_run_feeds(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status text;
  v_confirmed_by uuid;
  v_confirmed_at timestamptz;
begin
  if coalesce(public.get_current_employee_role() in ('owner', 'hr_admin'), false) is not true then
    raise exception 'Only owner or HR admin may confirm payroll feeds';
  end if;

  select status into v_status from public.pay_runs where id = p_run_id;
  if v_status is null then
    raise exception 'Pay run not found';
  end if;
  if v_status <> 'draft' then
    raise exception 'Feeds can only be confirmed while the run is in draft (current status: %)', v_status;
  end if;

  update public.pay_runs
  set feeds_confirmed_by = public.current_employee_id(),
      feeds_confirmed_at = now()
  where id = p_run_id
  returning feeds_confirmed_by, feeds_confirmed_at into v_confirmed_by, v_confirmed_at;

  return jsonb_build_object('payRunId', p_run_id, 'feedsConfirmedBy', v_confirmed_by, 'feedsConfirmedAt', v_confirmed_at);
end;
$function$;

revoke all on function public.confirm_pay_run_feeds(uuid) from public;
revoke all on function public.confirm_pay_run_feeds(uuid) from anon;
grant execute on function public.confirm_pay_run_feeds(uuid) to authenticated;
grant execute on function public.confirm_pay_run_feeds(uuid) to service_role;

-- 3. Auto-unconfirm trigger: any insert/update/delete on one of the 4 feed tables for a given
--    payroll_month un-confirms every still-draft pay_runs row for that same month, because the
--    confirmation ("this is final") is now stale. pay_periods.month/year are stored zero-padded
--    ('09','2026'), exactly matching the feed tables' own 'YYYY-MM' payroll_month key, so a plain
--    string match is exact and needs no date-range containment math.
create or replace function public.reset_feeds_confirmation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_payroll_month text;
begin
  v_payroll_month := coalesce(new.payroll_month, old.payroll_month);
  if v_payroll_month is null then
    return coalesce(new, old);
  end if;

  update public.pay_runs pr
  set feeds_confirmed_by = null,
      feeds_confirmed_at = null
  from public.pay_periods pp
  where pr.pay_period_id = pp.id
    and pp.year || '-' || pp.month = v_payroll_month
    and pr.status = 'draft'
    and pr.feeds_confirmed_at is not null;

  return coalesce(new, old);
end;
$function$;

-- NOTE: no `drop trigger if exists` guards here (nothing exists yet to guard against) — the
-- Supabase MCP tool has repeatedly hung on any DROP/DELETE-shaped statement, even a harmless
-- `if exists` on an object that doesn't exist (see CLAUDE.md, "Needs Your Call" / Quote of the
-- Day sections). Plain CREATE TRIGGER avoids that.
create trigger trg_reset_feeds_confirmation_canteen
  after insert or update or delete on public.payroll_canteen_entries
  for each row execute function public.reset_feeds_confirmation();

create trigger trg_reset_feeds_confirmation_society
  after insert or update or delete on public.payroll_society_recoveries
  for each row execute function public.reset_feeds_confirmation();

create trigger trg_reset_feeds_confirmation_adjustments
  after insert or update or delete on public.payroll_adjustments
  for each row execute function public.reset_feeds_confirmation();

create trigger trg_reset_feeds_confirmation_efficiency
  after insert or update or delete on public.payroll_efficiency_entries
  for each row execute function public.reset_feeds_confirmation();
