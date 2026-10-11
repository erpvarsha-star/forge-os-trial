-- PATCH_83 — Task delegation (11 Oct 2026, decisions from Yash).
-- New tables assigned_tasks + assigned_task_events (the orphan public.tasks is
-- left untouched). All writes go through SECURITY DEFINER RPCs; RLS is
-- SELECT-only. Assignment is "down the chain"; assigner confirms completion.
-- Push: notify_task_event() writes the in-app row itself, then calls the
-- send-push-notification edge function with skipInApp=true (push only), so
-- there is never a duplicate notifications row. Requires that edge function
-- (shared/push.ts skipInApp flag) to be deployed first; until then the HTTP
-- call would create a duplicate row, so deploy the function BEFORE applying.

create table if not exists public.assigned_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text,
  assigned_by uuid not null references public.employees(id),
  assigned_to uuid not null references public.employees(id),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_date date,
  status text not null default 'open' check (status in ('open','in_progress','submitted','completed','cancelled')),
  completion_note text,
  submitted_at timestamptz,
  review_note text,
  reviewed_at timestamptz,
  completed_at timestamptz,
  returned_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (assigned_by <> assigned_to)
);
create index if not exists assigned_tasks_assigned_to_idx on public.assigned_tasks(assigned_to);
create index if not exists assigned_tasks_assigned_by_idx on public.assigned_tasks(assigned_by);
create index if not exists assigned_tasks_status_idx on public.assigned_tasks(status);

create table if not exists public.assigned_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.assigned_tasks(id),
  actor_id uuid not null references public.employees(id),
  action text not null check (action in ('created','started','submitted','approved','sent_back','cancelled')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists assigned_task_events_task_idx on public.assigned_task_events(task_id);

alter table public.assigned_tasks enable row level security;
alter table public.assigned_task_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assigned_tasks' and policyname='assigned_tasks_select') then
    create policy assigned_tasks_select on public.assigned_tasks for select to authenticated
      using (
        assigned_to = public.current_employee_id()
        or assigned_by = public.current_employee_id()
        or public.get_current_employee_role() in ('owner','plant_head')
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assigned_task_events' and policyname='assigned_task_events_select') then
    create policy assigned_task_events_select on public.assigned_task_events for select to authenticated
      using (exists (select 1 from public.assigned_tasks t where t.id = task_id));
  end if;
end $$;
-- (the subquery runs under assigned_tasks' own RLS, so it applies the same visibility rule)

-- ---------------------------------------------------------------- helpers
create or replace function public.task_role_rank(p_role text) returns int
language sql immutable as $$
  select case p_role
    when 'owner' then 6 when 'plant_head' then 5 when 'hr_admin' then 4
    when 'manager' then 4 when 'supervisor' then 3
    when 'security_guard' then 1 when 'member' then 1 else 0 end;
$$;

create or replace function public.can_assign_task(p_assigner uuid, p_assignee uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare a employees%rowtype; e employees%rowtype; er int;
begin
  if p_assigner is null or p_assignee is null or p_assigner = p_assignee then return false; end if;
  select * into a from employees where id = p_assigner;
  select * into e from employees where id = p_assignee;
  if a.id is null or e.id is null or not coalesce(e.is_active, false) then return false; end if;
  er := task_role_rank(e.role);
  if a.role = 'owner' then return true;
  elsif a.role = 'plant_head' then return er < 5;
  elsif a.role = 'hr_admin' then return er < 4;
  -- coalesce: an unset manager_id/department makes the comparison NULL, and
  -- `not NULL` in the caller would silently ALLOW the assignment.
  elsif a.role = 'manager' then
    return coalesce(er < 4 and (
      (e.department is not null and e.department = a.department)
      or e.manager_id = a.id or e.shift_allocator_id = a.id), false);
  elsif a.role = 'supervisor' then
    return coalesce(er < 3 and (e.supervisor_id = a.id or e.shift_allocator_id = a.id), false);
  end if;
  return false;
end $$;
revoke execute on function public.can_assign_task(uuid, uuid) from public, anon, authenticated;

create or replace function public.notify_task_event(p_recipient uuid, p_title text, p_body text, p_task_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_recipient is null then return; end if;
  insert into public.notifications(user_id, title, body, type, related_entity_type, related_entity_id)
  values (p_recipient, p_title, p_body, 'task', 'assigned_task', p_task_id::text);
  -- Best-effort phone push; push only (skipInApp) because the row is written above.
  begin
    perform net.http_post(
      url := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/send-push-notification',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object(
        'employeeIds', jsonb_build_array(p_recipient),
        'type', 'task', 'title', p_title, 'body', p_body,
        'relatedEntityType', 'assigned_task', 'relatedEntityId', p_task_id::text,
        'skipInApp', true));
  exception when others then null;
  end;
end $$;
revoke execute on function public.notify_task_event(uuid, text, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- RPCs
create or replace function public.list_assignable_employees()
returns table(id uuid, emp_code text, name text, department text, role text)
language sql stable security definer set search_path = public as $$
  select e.id, e.emp_code, e.name, e.department, e.role
  from employees e
  where e.is_active and can_assign_task(current_employee_id(), e.id)
  order by e.department, e.name;
$$;
revoke execute on function public.list_assignable_employees() from public, anon;
grant execute on function public.list_assignable_employees() to authenticated;

create or replace function public.create_assigned_task(
  p_assigned_to uuid, p_title text, p_description text, p_due_date date, p_priority text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := current_employee_id(); v_id uuid; v_name text; v_title text := btrim(coalesce(p_title,''));
begin
  if me is null then raise exception 'Caller is not a registered employee'; end if;
  if not coalesce(can_assign_task(me, p_assigned_to), false) then raise exception 'You cannot assign a task to this person'; end if;
  if char_length(v_title) = 0 or char_length(v_title) > 200 then raise exception 'Title must be 1-200 characters'; end if;
  if coalesce(p_priority,'normal') not in ('low','normal','high','urgent') then raise exception 'Invalid priority'; end if;
  if p_due_date is not null and p_due_date < (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'Due date cannot be in the past';
  end if;
  insert into assigned_tasks(title, description, assigned_by, assigned_to, priority, due_date)
  values (v_title, nullif(btrim(coalesce(p_description,'')),''), me, p_assigned_to, coalesce(p_priority,'normal'), p_due_date)
  returning id into v_id;
  insert into assigned_task_events(task_id, actor_id, action) values (v_id, me, 'created');
  select name into v_name from employees where id = me;
  perform notify_task_event(p_assigned_to, 'New task assigned', v_name || ': ' || v_title, v_id);
  return v_id;
end $$;
revoke execute on function public.create_assigned_task(uuid, text, text, date, text) from public, anon;
grant execute on function public.create_assigned_task(uuid, text, text, date, text) to authenticated;

create or replace function public.update_assigned_task(p_task_id uuid, p_action text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := current_employee_id(); my_role text := get_current_employee_role();
        t assigned_tasks%rowtype; v_name text; v_note text := nullif(btrim(coalesce(p_note,'')),'');
        is_assignee boolean; is_reviewer boolean;
begin
  if me is null then raise exception 'Caller is not a registered employee'; end if;
  select * into t from assigned_tasks where id = p_task_id for update;
  if t.id is null then raise exception 'Task not found'; end if;
  is_assignee := (t.assigned_to = me);
  is_reviewer := (t.assigned_by = me or my_role = 'owner');
  select name into v_name from employees where id = me;

  if p_action = 'start' then
    if not is_assignee then raise exception 'Only the assignee can start a task'; end if;
    if t.status <> 'open' then raise exception 'Task is not open'; end if;
    update assigned_tasks set status='in_progress', updated_at=now() where id = t.id;
    insert into assigned_task_events(task_id, actor_id, action) values (t.id, me, 'started');

  elsif p_action = 'submit' then
    if not is_assignee then raise exception 'Only the assignee can submit a task'; end if;
    if t.status not in ('open','in_progress') then raise exception 'Task cannot be submitted from status %', t.status; end if;
    update assigned_tasks set status='submitted', submitted_at=now(), completion_note=v_note, updated_at=now() where id = t.id;
    insert into assigned_task_events(task_id, actor_id, action, note) values (t.id, me, 'submitted', v_note);
    perform notify_task_event(t.assigned_by, 'Task awaiting confirmation', v_name || ': ' || t.title, t.id);

  elsif p_action = 'approve' then
    if not is_reviewer then raise exception 'Only the assigner or owner can approve'; end if;
    if t.status <> 'submitted' then raise exception 'Task is not awaiting confirmation'; end if;
    update assigned_tasks set status='completed', completed_at=now(), reviewed_at=now(), review_note=v_note, updated_at=now() where id = t.id;
    insert into assigned_task_events(task_id, actor_id, action, note) values (t.id, me, 'approved', v_note);
    perform notify_task_event(t.assigned_to, 'Task approved', t.title, t.id);

  elsif p_action = 'send_back' then
    if not is_reviewer then raise exception 'Only the assigner or owner can send a task back'; end if;
    if t.status <> 'submitted' then raise exception 'Task is not awaiting confirmation'; end if;
    if v_note is null then raise exception 'A note is required when sending a task back'; end if;
    update assigned_tasks set status='in_progress', review_note=v_note, reviewed_at=now(),
      returned_count = returned_count + 1, submitted_at=null, updated_at=now() where id = t.id;
    insert into assigned_task_events(task_id, actor_id, action, note) values (t.id, me, 'sent_back', v_note);
    perform notify_task_event(t.assigned_to, 'Task sent back', t.title || ': ' || v_note, t.id);

  elsif p_action = 'cancel' then
    if not is_reviewer then raise exception 'Only the assigner or owner can cancel'; end if;
    if t.status not in ('open','in_progress','submitted') then raise exception 'Task cannot be cancelled from status %', t.status; end if;
    update assigned_tasks set status='cancelled', updated_at=now() where id = t.id;
    insert into assigned_task_events(task_id, actor_id, action, note) values (t.id, me, 'cancelled', v_note);
    perform notify_task_event(t.assigned_to, 'Task cancelled', t.title, t.id);

  else
    raise exception 'Unknown action %', p_action;
  end if;
end $$;
revoke execute on function public.update_assigned_task(uuid, text, text) from public, anon;
grant execute on function public.update_assigned_task(uuid, text, text) to authenticated;

create or replace function public.team_task_summary()
returns table(employee_id uuid, emp_code text, name text, department text,
  open_count int, in_progress_count int, awaiting_count int, completed_count int,
  overdue_count int, completed_on_time_count int, last_completed_at timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (select current_employee_id() as id, get_current_employee_role() as role),
  scoped as (
    select t.* from assigned_tasks t, me
    where t.status <> 'cancelled'
      and (me.role in ('owner','plant_head') or t.assigned_by = me.id)
  ),
  today as (select (now() at time zone 'Asia/Kolkata')::date as d)
  select e.id, e.emp_code, e.name, e.department,
    (count(*) filter (where s.status = 'open'))::int,
    (count(*) filter (where s.status = 'in_progress'))::int,
    (count(*) filter (where s.status = 'submitted'))::int,
    (count(*) filter (where s.status = 'completed'))::int,
    (count(*) filter (where s.status in ('open','in_progress') and s.due_date < today.d))::int,
    (count(*) filter (where s.status = 'completed' and (s.due_date is null
        or (s.submitted_at at time zone 'Asia/Kolkata')::date <= s.due_date)))::int,
    max(s.completed_at)
  from scoped s join employees e on e.id = s.assigned_to, today
  group by e.id, e.emp_code, e.name, e.department
  order by e.department, e.name;
$$;
revoke execute on function public.team_task_summary() from public, anon;
grant execute on function public.team_task_summary() to authenticated;

create or replace function public.my_task_action_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from assigned_tasks t
  where (t.assigned_to = current_employee_id() and t.status in ('open','in_progress'))
     or (t.assigned_by = current_employee_id() and t.status = 'submitted');
$$;
revoke execute on function public.my_task_action_count() from public, anon;
grant execute on function public.my_task_action_count() to authenticated;
