-- PATCH_92 — Pay run runner support functions (20 Oct 2026)
-- Applied: 2026-10-20 (live, via SQL, outside supabase_migrations)
-- Additive only. House rules: no DELETEs, no changes to engine math.

-- attach_arrears_sep26_30(item_id, amount):
-- Adds the one-time 26–30 Sep 2026 bridge amount to a pay_run_item while its
-- run is still mutable (the PATCH_89 lock trigger already blocks mutation once
-- finalized; this function additionally refuses approved+ states so arrears
-- can only attach in draft/calculating/calculated/in_review). The amount is
-- recorded in snapshot.arrears_sep26_30 and net_pay is topped up by the same
-- figure so the row total stays consistent. The payslip renders the arrears
-- as its own line with the EN+HI bridge note.
create or replace function public.attach_arrears_sep26_30(
  p_item_id uuid,
  p_amount  numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select pr.status into v_status
  from pay_run_items pri
  join pay_runs pr on pr.id = pri.pay_run_id
  where pri.id = p_item_id;

  if v_status is null then
    raise exception 'pay_run_item % not found', p_item_id;
  end if;
  if v_status not in ('draft','calculating','calculated','in_review') then
    raise exception 'run is %, arrears can only attach before approval', v_status;
  end if;

  update pay_run_items
  set snapshot = coalesce(snapshot, '{}'::jsonb)
                 || jsonb_build_object('arrears_sep26_30', p_amount),
      net_pay = net_pay + p_amount
  where id = p_item_id;
end;
$$;

comment on function public.attach_arrears_sep26_30(uuid, numeric) is
  'One-time Oct 2026 helper: adds the 26–30 Sep bridge arrears to a pay_run_item (PATCH_89/90 lineage).';

-- Audit trail: the calling edge function writes an audit_log row
-- (table_name=pay_runs, event=arrears_sep26_30) per invocation.
