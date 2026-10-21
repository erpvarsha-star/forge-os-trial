-- PATCH_103 — Payroll gaps: advance recovery, employee exit RPC, monthly VDA rate.
-- 21 Oct 2026. ADDITIVE ONLY (create table/function if-not-exists / or replace; no DROP).
-- (Section D, top-up runs, needs no SQL: pay_runs.adjustment_of already exists —
--  it lives entirely in supabase/functions/payroll-run/index.ts.)
--
-- Conventions: SECURITY DEFINER + search_path = public; user-callable functions check
-- public.get_current_employee_role() in ('owner','hr_admin'); every function has execute
-- revoked from public/anon. 'Today' = IST date.
--
-- ============================================================================
-- A. ADVANCE RECOVERY ON FINALIZE
-- feedSync deducts min(monthly_deduction, outstanding_balance) per approved advance every
-- month, but nothing ever reduced outstanding_balance. payroll-run now calls
-- apply_advance_recoveries(run) when a run moves to 'finalized'.
-- ============================================================================
create table if not exists public.advance_recoveries (
  id uuid primary key default gen_random_uuid(),
  pay_run_id uuid not null references public.pay_runs(id),
  advance_id uuid not null references public.advance_requests(id),
  employee_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz default now(),
  unique (pay_run_id, advance_id)
);

alter table public.advance_recoveries enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public'
                 and tablename='advance_recoveries' and policyname='advance_recoveries_select') then
    create policy advance_recoveries_select on public.advance_recoveries
      for select to authenticated
      using (coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false));
  end if;
end $$;

revoke all on public.advance_recoveries from anon;
revoke insert, update, delete, truncate, references, trigger on public.advance_recoveries from authenticated;

create or replace function public.apply_advance_recoveries(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  a record;
  v_deduct numeric;
  v_remaining numeric;
  v_take numeric;
  v_rows int;
  v_total numeric := 0;
  v_employees int := 0;
  v_unmatched jsonb := '[]'::jsonb;
  v_skipped_done int := 0;
begin
  for r in
    select employee_id, (snapshot->'deductions'->>'advance')::numeric as d
    from public.pay_run_items
    where pay_run_id = p_run_id
  loop
    v_deduct := coalesce(r.d, 0);
    if v_deduct <= 0 then continue; end if;

    -- Idempotency: this run already recovered for this employee -> leave untouched.
    if exists (select 1 from public.advance_recoveries
               where pay_run_id = p_run_id and employee_id = r.employee_id) then
      v_skipped_done := v_skipped_done + 1;
      continue;
    end if;

    v_remaining := v_deduct;
    for a in
      select id, outstanding_balance, monthly_deduction
      from public.advance_requests
      where employee_id = r.employee_id
        and status = 'approved'
        and coalesce(outstanding_balance, 0) > 0
      order by created_at, id
      for update
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, coalesce(a.monthly_deduction, 0), a.outstanding_balance);
      if v_take <= 0 then continue; end if;

      insert into public.advance_recoveries (pay_run_id, advance_id, employee_id, amount)
      values (p_run_id, a.id, r.employee_id, v_take)
      on conflict (pay_run_id, advance_id) do nothing;
      get diagnostics v_rows = row_count;

      if v_rows > 0 then
        update public.advance_requests
           set outstanding_balance = outstanding_balance - v_take
         where id = a.id;
        v_remaining := v_remaining - v_take;
        v_total := v_total + v_take;
      end if;
    end loop;

    if v_remaining < v_deduct then v_employees := v_employees + 1; end if;
    if v_remaining > 0 then
      v_unmatched := v_unmatched || jsonb_build_array(
        jsonb_build_object('employee_id', r.employee_id, 'shortfall', v_remaining));
    end if;
  end loop;

  return jsonb_build_object(
    'recovered_total', v_total,
    'employees', v_employees,
    'already_applied_employees', v_skipped_done,
    'unmatched', v_unmatched);
end $$;

revoke execute on function public.apply_advance_recoveries(uuid) from public, anon, authenticated;
grant execute on function public.apply_advance_recoveries(uuid) to service_role;

-- ============================================================================
-- B. EMPLOYEE EXIT / STATUS RPC
-- employee_status_history is read by feedSync (isPayrollEligible): an exit row's
-- effective_from is the day AFTER the last working day. People deactivated earlier by a plain
-- is_active=false with NO history row are skipped by payroll entirely (feedSync ~line 141) —
-- unchanged behaviour.
-- ============================================================================
create or replace function public.record_employee_status(
  p_employee_id uuid, p_status text, p_date date, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_current text;
  v_eff date;
  v_allowed text[];
  v_is_active boolean;
begin
  if coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false) is not true then
    raise exception 'Only owner or HR admin may record employee status';
  end if;
  if p_status is null or p_status not in ('active','on_leave','left','terminated','retired','rehired') then
    raise exception 'Invalid status %', p_status;
  end if;
  if p_date is null then
    raise exception 'Date is required';
  end if;
  if not exists (select 1 from public.employees where id = p_employee_id) then
    raise exception 'Employee not found';
  end if;

  -- last working day for exits -> stored effective_from is the day after
  v_eff := case when p_status in ('left','terminated','retired') then p_date + 1 else p_date end;

  select h.status into v_current
  from public.employee_status_history h
  where h.employee_id = p_employee_id and h.effective_from <= v_today
  order by h.effective_from desc, h.created_at desc
  limit 1;
  v_current := coalesce(nullif(v_current, 'draft'), 'active');

  v_allowed := case v_current
    when 'active'     then array['on_leave','left','terminated','retired']
    when 'on_leave'   then array['active','left','terminated','retired']
    when 'left'       then array['rehired']
    when 'retired'    then array['rehired']
    when 'terminated' then array[]::text[]
    when 'rehired'    then array['active']
    else array[]::text[]
  end;
  if not (p_status = any(v_allowed)) then
    raise exception 'Illegal employee status change: % -> %', v_current, p_status;
  end if;

  if exists (select 1 from public.employee_status_history
             where employee_id = p_employee_id and effective_from = v_eff and status = p_status) then
    raise exception 'Status % already recorded effective %', p_status, v_eff;
  end if;

  insert into public.employee_status_history (employee_id, status, effective_from, note, recorded_by)
  values (p_employee_id, p_status, v_eff, p_note, public.current_employee_id());

  if v_eff <= v_today then
    if p_status in ('left','terminated','retired') then
      update public.employees set is_active = false where id = p_employee_id;
    elsif p_status in ('active','rehired') then
      update public.employees set is_active = true where id = p_employee_id;
    end if;
  end if;

  select is_active into v_is_active from public.employees where id = p_employee_id;
  return jsonb_build_object('employee_id', p_employee_id, 'from', v_current, 'to', p_status,
                            'effective_from', v_eff, 'is_active', v_is_active);
end $$;

revoke execute on function public.record_employee_status(uuid, text, date, text) from public, anon;
grant execute on function public.record_employee_status(uuid, text, date, text) to authenticated;

-- Future-dated exits: flips is_active=false once the exit date arrives.
create or replace function public.apply_due_exits()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_n int;
begin
  with latest as (
    select distinct on (employee_id) employee_id, status
    from public.employee_status_history
    where effective_from <= v_today
    order by employee_id, effective_from desc, created_at desc
  )
  update public.employees e set is_active = false
  from latest l
  where l.employee_id = e.id
    and l.status in ('left','terminated','retired')
    and e.is_active;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function public.apply_due_exits() from public, anon, authenticated;
grant execute on function public.apply_due_exits() to service_role;

-- 00:10 IST daily (18:40 UTC). Plain SQL: no http, no keys.
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'apply-due-exits') then
    perform cron.schedule('apply-due-exits', '40 18 * * *', 'select public.apply_due_exits()');
  end if;
end $$;

-- ============================================================================
-- C. MONTHLY VDA RATE
-- payroll_monthly_rates (month 'MM', year int, vda_per_day_rate, unique(month,year)).
-- payroll-run 'calculate' reads it and refuses to run without it (unless force:true).
-- ============================================================================
create or replace function public.set_monthly_vda_rate(p_month text, p_year int, p_rate numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if coalesce(public.get_current_employee_role() in ('owner','hr_admin'), false) is not true then
    raise exception 'Only owner or HR admin may set the VDA rate';
  end if;
  if p_month is null or p_month !~ '^(0[1-9]|1[0-2])$' then
    raise exception 'Month must be 01..12';
  end if;
  if p_year is null or p_year < 2020 or p_year > 2100 then
    raise exception 'Year must be 2020..2100';
  end if;
  if p_rate is null or p_rate <= 0 or p_rate > 1000 then
    raise exception 'VDA per-day rate must be > 0 and <= 1000';
  end if;

  insert into public.payroll_monthly_rates (month, year, vda_per_day_rate)
  values (p_month, p_year, p_rate)
  on conflict (month, year) do update set vda_per_day_rate = excluded.vda_per_day_rate
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'month', p_month, 'year', p_year, 'vda_per_day_rate', p_rate);
end $$;

revoke execute on function public.set_monthly_vda_rate(text, int, numeric) from public, anon;
grant execute on function public.set_monthly_vda_rate(text, int, numeric) to authenticated;

-- ============================================================================
-- ROLLBACK (manual, if ever needed):
--   select cron.unschedule('apply-due-exits');
--   drop function public.set_monthly_vda_rate(text, int, numeric);
--   drop function public.apply_due_exits();
--   drop function public.record_employee_status(uuid, text, date, text);
--   drop function public.apply_advance_recoveries(uuid);
--   drop table public.advance_recoveries;   -- only if no recoveries have been applied;
--     otherwise first restore advance_requests.outstanding_balance from the recovery rows.
-- ============================================================================
