-- PATCH_121 (29 Oct 2026) - APPLIED live 29 Oct 2026 via the Supabase tool.
-- UPDATED 30 Oct 2026: also notifies the plant head (owner decision 30 Oct). Applied live 30 Oct; the
-- rolled-back test for the plant-head notification has NOT been run yet (see end of file).
-- Owner decision: a half-day comp-off conflict (HR vs Kajal) the plant head has not resolved within
-- 2 days (48 hours; Claude's default - owner gave no number) auto-escalates to the owner.
-- The delay lives in ONE place: v_escalate_after inside the function. Additive; no DROP/DELETE.
-- Conflict age = the LATER of the two half_day_coff_decisions.decided_at. Idempotent; only touches
-- conflicts still pending, still without a half_day_coff_conflicts row. Notifies the owner only.

create or replace function public.auto_escalate_halfday_coff_conflicts()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_escalate_after interval := interval '48 hours';  -- the ONE place the auto-escalation delay lives
  r record; o record; ph record; v_n int := 0;
begin
  for r in
    select lc.request_id, lc.employee_id, e.name
      from leave_consumption lc
      join half_day_coff_decisions hd on hd.request_id = lc.request_id and hd.decider_kind = 'hr'
      join half_day_coff_decisions kd on kd.request_id = lc.request_id and kd.decider_kind = 'kajal'
      join employees e on e.id = lc.employee_id
     where lc.source = 'half_day_pending_decision'
       and hd.outcome <> kd.outcome
       and greatest(hd.decided_at, kd.decided_at) <= now() - v_escalate_after
       and not exists (select 1 from half_day_coff_conflicts cf where cf.request_id = lc.request_id)
     for update of lc skip locked
  loop
    insert into half_day_coff_conflicts(request_id, stage, escalated_at, escalated_by, escalation_note)
    values (r.request_id, 'owner', now(), null, 'Auto-escalated after 48h without a plant head decision')
    on conflict (request_id) do nothing;
    if found then
      for o in select id from employees where role = 'owner' and is_active loop
        insert into notifications(user_id, title, body, type, related_entity_type, related_entity_id)
        values (o.id, 'Half-day comp-off escalated to you',
          'HR and Kajal disagree on ' || coalesce(r.name,'employee') || ' and the plant head did not decide within 48 hours - please settle.',
          'halfday_coff_conflict', 'leave_request', r.request_id::text);
      end loop;
      for ph in select id from employees where role = 'plant_head' and is_active loop
        insert into notifications(user_id, title, body, type, related_entity_type, related_entity_id)
        values (ph.id, 'Half-day comp-off conflict auto-escalated to the owner',
          'HR and Kajal disagree on ' || coalesce(r.name,'employee') || ' and nobody decided within 48 hours, so it went to the owner.',
          'halfday_coff_conflict', 'leave_request', r.request_id::text);
      end loop;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;
revoke execute on function public.auto_escalate_halfday_coff_conflicts() from public, anon, authenticated;
grant execute on function public.auto_escalate_halfday_coff_conflicts() to service_role;

-- Hourly schedule (plain SQL call, no HTTP key):
select cron.schedule('halfday-coff-auto-escalate','7 * * * *','select public.auto_escalate_halfday_coff_conflicts()');

-- Live rolled-back test result (29 Oct 2026):
-- run1_returned=1; owner_notifs_for_A=1; A_row=true; B_1h_row=false; C_note_unchanged=true; D_settled_row=false;
-- E_agree_row=false; run2_returned=0; notifs_new_run1=1; notifs_new_run2=0; A_rows=1
-- Residue after rollback: leave_requests 5, leave_consumption 0, comp_off_balance 0, notifications 14042,
-- audit_log 139, half_day_coff_decisions 0, half_day_coff_conflicts 0 (identical to before).

-- 30 Oct 2026: plant-head change applied; privileges re-asserted (anon=false, authenticated=false, service_role=true).
-- Rolled-back test for the plant-head notification: NOT RUN (the test DO block contained cleanup DELETEs, which the tool's
-- confirmation blocked and timed out; to be re-written without DELETE, relying on the final raise exception to roll back).
