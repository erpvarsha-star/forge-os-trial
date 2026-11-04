-- PATCH_126: fix compute_approval_chain() for employees with manager_id IS NULL
-- Applied LIVE 4 Nov 2026 via the Supabase MCP tool (direct CREATE OR REPLACE,
-- no DROP needed since the function already exists with this signature).
--
-- BUG FOUND 4 Nov 2026, while investigating "leave application + leave
-- balances for worker and staff needs to go live": for any member /
-- supervisor / security_guard employee with employees.manager_id IS NULL,
-- compute_approval_chain() returned ['manager', 'hr_admin', 'plant_head']
-- (leave) or the advance equivalent, inserting a 'manager' stage that can
-- NEVER be satisfied -- my_turn_leave_requests()/my_turn_advance_requests()
-- surface the pending-at-my-stage view by matching
-- e.manager_id = current_employee_id(), which is impossible when
-- manager_id is null. The request sat at current_stage=0 forever, visible
-- to no approver, with no error anywhere.
--
-- Live impact at the time of the fix: 61 active member/supervisor/
-- security_guard employees have manager_id IS NULL (confirmed by direct
-- count); of the 7 real pending leave_requests live that day, all 7 were on
-- this exact chain shape before the fix (same root cause, not necessarily
-- all literally stuck yet depending on their current_stage), and at least
-- 3 (VFL5433, VFL1562, VFL4063) were independently confirmed stuck pre-fix.
--
-- Fix: when v_manager_id is null for a non-manager/hr_admin/plant_head/
-- owner employee, skip straight to the same chain a manager's OWN request
-- uses (no 'manager' stage): ['hr_admin','plant_head'] for leave,
-- ['hr_admin','accounts','plant_head','owner'] for advance. Employees who
-- DO have a manager_id keep the original ['manager','hr_admin',...] chain,
-- unchanged.
--
-- Verified live after applying: all 7 pending leave_requests now show
-- approval_chain=['hr_admin','plant_head'], current_stage=0 (none had a
-- manager_id set). No existing leave_requests/advance_requests rows were
-- rewritten by this patch -- compute_approval_chain() is only called at
-- request-creation time; any already-created request keeps whatever chain
-- it was given when it was submitted. A request created before this fix,
-- while stuck on an unreachable 'manager' stage, stays stuck unless
-- resubmitted or hand-corrected -- check for any such row separately if
-- a specific employee reports a leave/advance request that "disappeared".
--
-- Known data gap, NOT fixed by this patch (flagged to HR/owner, not
-- fabricated): 4 active staff with uses_app=true have no leave_balances
-- row at all (VFL5463, VFL5464, VFL5465, VFL5466) -- leave applications
-- from them will still fail/behave oddly on balance checks until HR
-- creates their balance rows with real EL/CL/SL figures.

CREATE OR REPLACE FUNCTION public.compute_approval_chain(p_employee_id uuid, p_kind text)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_role text;
  v_dept text;
  v_manager_id uuid;
begin
  select role, department, manager_id into v_role, v_dept, v_manager_id from employees where id = p_employee_id;

  if v_role = 'owner' then
    return array[]::text[];
  elsif v_role = 'plant_head' then
    return array['owner'];
  elsif v_role = 'hr_admin' then
    if p_kind = 'leave' then
      return array['plant_head'];
    else
      return array['accounts', 'plant_head', 'owner'];
    end if;
  elsif v_role = 'manager' then
    if p_kind = 'leave' then
      return array['hr_admin', 'plant_head'];
    elsif v_dept = 'Accounts' then
      return array['hr_admin', 'plant_head', 'owner'];
    else
      return array['hr_admin', 'accounts', 'plant_head', 'owner'];
    end if;
  else
    -- PATCH_126 (4 Nov 2026): skip the 'manager' stage when the employee has no
    -- manager_id set, since my_turn_leave_requests()/my_turn_advance_requests()
    -- can never match e.manager_id = current_employee_id() for a NULL
    -- manager_id -- that left the request permanently stuck at stage 0,
    -- unseen by any approver, forever. Falls back to the same chain a
    -- manager's own request uses (skip straight to hr_admin).
    if v_manager_id is null then
      if p_kind = 'leave' then
        return array['hr_admin', 'plant_head'];
      else
        return array['hr_admin', 'accounts', 'plant_head', 'owner'];
      end if;
    end if;
    if p_kind = 'leave' then
      return array['manager', 'hr_admin', 'plant_head'];
    else
      return array['manager', 'hr_admin', 'accounts', 'plant_head', 'owner'];
    end if;
  end if;
end;
$function$;
