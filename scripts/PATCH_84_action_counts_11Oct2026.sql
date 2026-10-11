-- PATCH_84: my_action_counts() -- one RPC feeding every red-dot / count badge.
-- Yash, 11 Oct 2026: missed 4 days of pending "Needs Your Call" because no count
-- showed on More. Each key mirrors exactly what the matching screen lists:
--   tasks_todo        my-tasks: assigned to me, open/in_progress
--   tasks_to_confirm  team-tasks "awaiting your confirmation": assigned by me, submitted
--   approvals         my_turn_leave_requests() + my_turn_advance_requests() (every role's
--                     approvals screen) + salary_change_requests: owner -> 'pending_owner',
--                     plant_head -> 'pending_plant_head' (what each screen filters on)
--   needs_your_call   owner only: rows of needs_your_call_shifts (what the screen lists)
--   fraud_alerts      owner only: fraud_alerts where status = 'open' (alerts.tsx filter)
-- Read-only; no DROP statements.
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

  return jsonb_build_object(
    'tasks_todo', v_todo,
    'tasks_to_confirm', v_conf,
    'approvals', v_appr + v_salary,
    'needs_your_call', v_nyc,
    'fraud_alerts', v_fraud
  );
end;
$$;

revoke all on function public.my_action_counts() from public, anon;
grant execute on function public.my_action_counts() to authenticated;
