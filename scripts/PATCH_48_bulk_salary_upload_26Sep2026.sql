-- ============================================================================
-- PATCH_48 — bulk salary upload (owner only)
-- 26 Sep 2026
--
-- The typed request/approve flow from PATCH_46/47 stays as-is for HR's
-- one-at-a-time revisions. This adds a second, owner-only path for revising
-- many employees at once from a CSV: the owner IS the approver, so this
-- writes directly to employee_salary_structure — no second approval step —
-- but still logs every applied row into salary_change_requests
-- (status='approved', self-reviewed) so there is one single audit trail for
-- every salary change ever made, bulk or not.
--
-- One function, one dry_run flag, so preview and apply can never disagree
-- about what counts as "changed":
--   bulk_apply_salary_changes(p_rows, p_dry_run := true)  -- preview, no writes
--   bulk_apply_salary_changes(p_rows, p_dry_run := false) -- applies "update" rows
--
-- Per row, p_rows is a jsonb array of objects: emp_code + the same 13
-- breakup fields PATCH_46 already defined. Each row classifies as:
--   'not_found' — emp_code doesn't match any active employee (skipped)
--   'unchanged' — every field already matches the active breakup exactly
--                 (IS NOT DISTINCT FROM, so NULL vs NULL also counts as
--                 unchanged, not "different") — skipped, not written
--   'update' / 'updated' — genuinely different (or no prior breakup at
--                 all) — this is the only case that ever writes anything
--
-- A pending new-hire (is_active=false) is invisible to this function on
-- purpose (the lookup filters is_active=true) — their initial salary stays
-- part of the new-hire approval in PATCH_46, not bulk revision, so the two
-- flows can never collide on the same employee mid-flight.
-- ============================================================================

begin;

create or replace function public.bulk_apply_salary_changes(p_rows jsonb, p_dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_rec        jsonb;
  emp_rec        record;
  active_rec     record;
  results        jsonb := '[]'::jsonb;
  n_update       int := 0;
  n_unchanged    int := 0;
  n_not_found    int := 0;
  reviewer_id    uuid;
  is_same        boolean;
  new_request_id uuid;
begin
  if get_current_employee_role() <> 'owner' then
    raise exception 'Permission denied: owner only';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  select id into reviewer_id from employees where auth_user_id = auth.uid();

  for row_rec in select * from jsonb_array_elements(p_rows)
  loop
    select id, name, emp_code into emp_rec
    from employees
    where upper(emp_code) = upper(row_rec->>'emp_code') and is_active = true;

    if emp_rec.id is null then
      n_not_found := n_not_found + 1;
      results := results || jsonb_build_object('emp_code', row_rec->>'emp_code', 'status', 'not_found');
      continue;
    end if;

    select * into active_rec
    from employee_salary_structure
    where employee_id = emp_rec.id and is_active = true;

    is_same := active_rec.id is not null
      and active_rec.ctc_annual is not distinct from (row_rec->>'ctc_annual')::numeric
      and active_rec.basic is not distinct from (row_rec->>'basic')::numeric
      and active_rec.hra is not distinct from (row_rec->>'hra')::numeric
      and active_rec.conveyance is not distinct from (row_rec->>'conveyance')::numeric
      and active_rec.washing is not distinct from (row_rec->>'washing')::numeric
      and active_rec.education is not distinct from (row_rec->>'education')::numeric
      and active_rec.heat_allow is not distinct from (row_rec->>'heat_allow')::numeric
      and active_rec.vda is not distinct from (row_rec->>'vda')::numeric
      and active_rec.production_allow is not distinct from (row_rec->>'production_allow')::numeric
      and active_rec.medical is not distinct from (row_rec->>'medical')::numeric
      and active_rec.professional_development is not distinct from (row_rec->>'professional_development')::numeric
      and active_rec.communication is not distinct from (row_rec->>'communication')::numeric
      and active_rec.uniform is not distinct from (row_rec->>'uniform')::numeric;

    if is_same then
      n_unchanged := n_unchanged + 1;
      results := results || jsonb_build_object('emp_code', emp_rec.emp_code, 'name', emp_rec.name, 'status', 'unchanged');
      continue;
    end if;

    n_update := n_update + 1;

    if p_dry_run then
      results := results || jsonb_build_object('emp_code', emp_rec.emp_code, 'name', emp_rec.name, 'status', 'update');
    else
      update employee_salary_structure
         set is_active = false
       where employee_id = emp_rec.id and is_active = true;

      insert into employee_salary_structure (
        employee_id, ctc_annual, basic, hra, conveyance, washing, education,
        heat_allow, vda, production_allow, medical, professional_development,
        communication, uniform, effective_from, is_active
      ) values (
        emp_rec.id,
        (row_rec->>'ctc_annual')::numeric, (row_rec->>'basic')::numeric,
        (row_rec->>'hra')::numeric, (row_rec->>'conveyance')::numeric,
        (row_rec->>'washing')::numeric, (row_rec->>'education')::numeric,
        (row_rec->>'heat_allow')::numeric, (row_rec->>'vda')::numeric,
        (row_rec->>'production_allow')::numeric, (row_rec->>'medical')::numeric,
        (row_rec->>'professional_development')::numeric, (row_rec->>'communication')::numeric,
        (row_rec->>'uniform')::numeric,
        current_date, true
      );

      insert into salary_change_requests (
        employee_id, is_new_hire, ctc_annual, basic, hra, conveyance, washing, education,
        heat_allow, vda, production_allow, medical, professional_development, communication, uniform,
        status, requested_by, reviewed_by, reviewed_at, note
      ) values (
        emp_rec.id, false,
        (row_rec->>'ctc_annual')::numeric, (row_rec->>'basic')::numeric,
        (row_rec->>'hra')::numeric, (row_rec->>'conveyance')::numeric,
        (row_rec->>'washing')::numeric, (row_rec->>'education')::numeric,
        (row_rec->>'heat_allow')::numeric, (row_rec->>'vda')::numeric,
        (row_rec->>'production_allow')::numeric, (row_rec->>'medical')::numeric,
        (row_rec->>'professional_development')::numeric, (row_rec->>'communication')::numeric,
        (row_rec->>'uniform')::numeric,
        'approved', reviewer_id, reviewer_id, now(), 'Bulk upload'
      )
      returning id into new_request_id;

      results := results || jsonb_build_object(
        'emp_code', emp_rec.emp_code, 'name', emp_rec.name, 'status', 'updated', 'request_id', new_request_id
      );
    end if;
  end loop;

  return jsonb_build_object(
    'summary', jsonb_build_object('update', n_update, 'unchanged', n_unchanged, 'not_found', n_not_found),
    'results', results
  );
end;
$$;

revoke all on function public.bulk_apply_salary_changes(jsonb, boolean) from public, anon;
grant execute on function public.bulk_apply_salary_changes(jsonb, boolean) to authenticated;

commit;
