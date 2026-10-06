-- PATCH_76_fraud_alert_resolution_and_dedup_06Oct2026.sql
--
-- Yash: "you have not given me option to resolve or escalate the alert. so
-- what is it for?" -- correct, there has never been one. alerts.tsx is
-- 100% read-only; the only resolution ever done was a one-off manual SQL
-- UPDATE (PATCH_52), never through the app, because fraud_alerts has no
-- UPDATE RLS policy at all.
--
-- Second problem, same message: "if the alert is of same person it needs
-- to be clubbed as one alert rather than different ones bringing the
-- count high." Confirmed real -- VFL5442 alone had 20 separate rows from
-- a single 10-minute window. fraud-detector's gps_check inserted a brand
-- new row on every single flagged check-in, with no dedup at all.

begin;

-- ============================================================================
-- SECTION A -- resolution columns + occurrence tracking
-- ============================================================================

alter table fraud_alerts
  add column if not exists resolution text check (resolution in ('confirmed', 'false_positive', 'needs_investigation')),
  add column if not exists resolution_note text,
  add column if not exists resolved_by uuid references employees(id),
  add column if not exists resolved_at timestamptz,
  add column if not exists occurrence_count integer not null default 1,
  add column if not exists last_occurred_at timestamptz;

update fraud_alerts set last_occurred_at = created_at where last_occurred_at is null;
alter table fraud_alerts alter column last_occurred_at set not null;

-- ============================================================================
-- SECTION B -- one-time cleanup: collapse existing same-person/same-day
-- duplicate OPEN alerts into one row with the real occurrence count.
-- ============================================================================

with keepers as (
  select distinct on (fa.employee_id, fa.type, (fa.created_at at time zone 'Asia/Kolkata')::date)
    fa.id as keep_id,
    fa.employee_id,
    fa.type,
    (fa.created_at at time zone 'Asia/Kolkata')::date as alert_day,
    count(*) over (partition by fa.employee_id, fa.type, (fa.created_at at time zone 'Asia/Kolkata')::date) as cnt,
    max(fa.created_at) over (partition by fa.employee_id, fa.type, (fa.created_at at time zone 'Asia/Kolkata')::date) as last_at
  from fraud_alerts fa
  where fa.status = 'open'
  order by fa.employee_id, fa.type, (fa.created_at at time zone 'Asia/Kolkata')::date, fa.created_at asc
)
update fraud_alerts fa
  set occurrence_count = k.cnt,
      last_occurred_at = k.last_at
  from keepers k
  where fa.id = k.keep_id and k.cnt > 1;

with keepers as (
  select distinct on (fa.employee_id, fa.type, (fa.created_at at time zone 'Asia/Kolkata')::date)
    fa.id as keep_id,
    fa.employee_id,
    fa.type,
    (fa.created_at at time zone 'Asia/Kolkata')::date as alert_day
  from fraud_alerts fa
  where fa.status = 'open'
  order by fa.employee_id, fa.type, (fa.created_at at time zone 'Asia/Kolkata')::date, fa.created_at asc
)
delete from fraud_alerts fa
  using keepers k
  where fa.status = 'open'
    and fa.employee_id = k.employee_id
    and fa.type = k.type
    and (fa.created_at at time zone 'Asia/Kolkata')::date = k.alert_day
    and fa.id <> k.keep_id;

-- Safety net for future same-day duplicates even if the app-side dedup in
-- fraud-detector/index.ts is ever bypassed (direct insert, a different
-- caller, etc.) -- partial unique index, open rows only, so a day that
-- later resolves and recurs correctly opens a fresh row.
create unique index if not exists fraud_alerts_open_daily_dedup
  on fraud_alerts (employee_id, type, ((created_at at time zone 'Asia/Kolkata')::date))
  where status = 'open';

-- ============================================================================
-- SECTION C -- resolve_fraud_alert() RPC. Owner-only (matches alerts.tsx's
-- existing placement -- only the owner has this screen today). RPC-only,
-- no UPDATE RLS policy, consistent with this project's pattern of keeping
-- sensitive writes behind a narrow SECURITY DEFINER function rather than a
-- broad client-writable policy.
-- ============================================================================

create or replace function public.resolve_fraud_alert(p_id uuid, p_resolution text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_status text;
begin
  if get_current_employee_role() <> 'owner' then
    raise exception 'only the owner can resolve fraud alerts';
  end if;
  if p_resolution not in ('confirmed', 'false_positive', 'needs_investigation') then
    raise exception 'unknown resolution: %', p_resolution;
  end if;

  v_new_status := case p_resolution
    when 'confirmed' then 'resolved'
    when 'false_positive' then 'resolved'
    when 'needs_investigation' then 'investigating'
  end;

  update fraud_alerts
    set resolution = p_resolution,
        resolution_note = p_note,
        resolved_by = current_employee_id(),
        resolved_at = now(),
        status = v_new_status
    where id = p_id and resolution is null;

  if not found then
    raise exception 'fraud alert not found, or already resolved';
  end if;
end;
$$;

revoke all on function public.resolve_fraud_alert(uuid, text, text) from public, anon;
grant execute on function public.resolve_fraud_alert(uuid, text, text) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- VERIFICATION
-- ---------------------------------------------------------------------------
-- select type, employee_id, occurrence_count, status from fraud_alerts where status = 'open' order by occurrence_count desc;
-- select count(*) from fraud_alerts where status = 'open';  -- should be ~3-4 (one per affected employee/day), not 39
-- select proname from pg_proc where proname = 'resolve_fraud_alert';
--
-- Confirmed live 6 Oct 2026: 39 open rows collapsed to 4 (3 employees,
-- VFL4036 correctly kept as 2 separate rows since his alerts spanned two
-- different IST calendar days -- VFL5442 occurrence_count=20,
-- VFL4036 occurrence_count=13 (26 Sep) + 1 (27 Sep), VFL5446 occurrence_count=5.
