-- PATCH_115: my_action_counts() gains `halfday_coff` (29 Oct 2026).
-- Count of leave_consumption rows with source = 'half_day_pending_decision'
-- (what More -> Half-day Comp-off lists for HR). Returned ONLY when the caller's
-- role is 'hr_admin'; for every other role (and the v_me-null early return) the
-- key is absent. All existing keys/behaviour are unchanged from PATCH_84.
-- create or replace only (same jsonb signature); no DROP.
create or replace function public.my_action_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me   uuid := current_employee_id();
  v_role text := get_current_employee_role();
  v_todo int := 0;
  v_conf int := 0;
  v_appr int := 0;
  v_salary int := 0;
  v_nyc  int := 0;
  v_fraud int := 0;
  v_halfday int := 0;
  v_out jsonb;
begin
  if v_me is null then
    return jsonb_build_object('tasks_todo',0,'tasks_to_confirm',0,'approvals',0,'needs_your_call',0,'fraud_alerts',0);
  end if;

  select count(*)::int into v_todo from assigned_tasks
   where assigned_to = v_me and status in ('open','in_progress');
  select count(*)::int into v_conf from assigned_tasks
   where assigned_by = v_me and status = 'submitted';

  select (select count(*) from my_turn_leave_requests())
       + (select count(*) from my_turn_advance_requests()) into v_appr;

  if v_role = 'owner' then
    select count(*)::int into v_salary from salary_change_requests where status = 'pending_owner';
    select count(*)::int into v_nyc from needs_your_call_shifts;
    select count(*)::int into v_fraud from fraud_alerts where status = 'open';
  elsif v_role = 'plant_head' then
    select count(*)::int into v_salary from salary_change_requests where status = 'pending_plant_head';
  end if;

  v_out := jsonb_build_object(
    'tasks_todo', v_todo,
    'tasks_to_confirm', v_conf,
    'approvals', v_appr + v_salary,
    'needs_your_call', v_nyc,
    'fraud_alerts', v_fraud
  );

  if v_role = 'hr_admin' then
    select count(*)::int into v_halfday from leave_consumption
     where source = 'half_day_pending_decision';
    v_out := v_out || jsonb_build_object('halfday_coff', v_halfday);
  end if;

  return v_out;
end;
$$;

revoke all on function public.my_action_counts() from public, anon;
grant execute on function public.my_action_counts() to authenticated;
