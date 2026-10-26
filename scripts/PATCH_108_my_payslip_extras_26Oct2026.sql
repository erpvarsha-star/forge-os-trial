-- PATCH_108 — my_payslip_extras(p_year, p_month): identity, attendance, statutory-ID and
-- leave-balance blocks for the logged-in employee's own payslip.
--
-- The pay-run snapshot (pay_run_items.snapshot) has earnings/deductions but not the slip's
-- identity, attendance, UAN/ESI/PAN or leave-available blocks. This returns them.
--
-- SECURITY: SECURITY DEFINER (owned by postgres, so it can read employee_salary_structure,
-- which is RLS-restricted to owner/HR). The caller is resolved ONLY via auth_employee_id()
-- (same approach as my_payslips(), PATCH_95); there is NO employee id/code parameter, so a
-- caller can only ever receive their own data. PAN is returned masked (last 4 chars only).
--
-- Sources:
--   designation : no column exists anywhere in the DB            -> always null
--   doj         : no joining-date column exists anywhere in DB   -> always null
--   department, emp_code : employees
--   uan, esi_no, pan     : employee_salary_structure, latest row by effective_from
--   leave_available      : leave_balances (latest year row) earned/casual/sick_leave
--   attendance (import)  : payroll_records row for (year, month) if present
--   attendance (live)    : attendance_records + approved leave_requests for the IST month:
--       present      = count of status in P, L, HL
--       weekly_off   = count of status WO
--       working_days = days in month - weekly_off
--       el/cl/sl/ph  = approved leave_requests days overlapping the month by type (calendar overlap)
--       days_payable = present + weekly_off + el + cl + sl + ph
--   attendance (none): zeros.
-- Month boundaries are plain calendar dates (attendance_records.date is an IST date).

create or replace function public.my_payslip_extras(p_year int, p_month int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_emp uuid := auth_employee_id();
  v_code text; v_dept text;
  v_uan text; v_esi text; v_pan text;
  v_bal_el numeric := 0; v_bal_cl numeric := 0; v_bal_sl numeric := 0;
  v_start date; v_end date; v_days int;
  v_att jsonb; v_src text := 'none';
  v_pr payroll_records%rowtype;
  v_present numeric := 0; v_wo numeric := 0;
  v_el numeric := 0; v_cl numeric := 0; v_sl numeric := 0; v_ph numeric := 0;
  v_has_att boolean := false;
begin
  if v_emp is null then
    return null;
  end if;

  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + interval '1 month')::date;
  v_days := v_end - v_start;

  select emp_code, department into v_code, v_dept from employees where id = v_emp;

  select uan, esi_no, pan into v_uan, v_esi, v_pan
  from employee_salary_structure where employee_id = v_emp
  order by effective_from desc nulls last, created_at desc limit 1;

  select coalesce(earned_leave,0), coalesce(casual_leave,0), coalesce(sick_leave,0)
    into v_bal_el, v_bal_cl, v_bal_sl
  from leave_balances where employee_id = v_emp order by year desc limit 1;

  select * into v_pr from payroll_records
  where employee_id = v_emp and year = p_year and month = lpad(p_month::text, 2, '0')
  limit 1;

  if found then
    v_src := 'import';
    v_att := jsonb_build_object(
      'working_days', v_pr.working_days, 'present', v_pr.present_days,
      'weekly_off', v_pr.week_off, 'el', v_pr.el, 'cl', v_pr.cl, 'sl', v_pr.sl,
      'ph', v_pr.ph, 'days_payable', v_pr.days_payable, 'source', v_src);
  else
    select count(*) filter (where status in ('P','L','HL')),
           count(*) filter (where status = 'WO'),
           count(*) > 0
      into v_present, v_wo, v_has_att
    from attendance_records
    where employee_id = v_emp and date >= v_start and date < v_end;

    select coalesce(sum(greatest(0, least(end_date, v_end - 1) - greatest(start_date, v_start) + 1)) filter (where upper(type)='EL'),0),
           coalesce(sum(greatest(0, least(end_date, v_end - 1) - greatest(start_date, v_start) + 1)) filter (where upper(type)='CL'),0),
           coalesce(sum(greatest(0, least(end_date, v_end - 1) - greatest(start_date, v_start) + 1)) filter (where upper(type)='SL'),0),
           coalesce(sum(greatest(0, least(end_date, v_end - 1) - greatest(start_date, v_start) + 1)) filter (where upper(type)='PH'),0)
      into v_el, v_cl, v_sl, v_ph
    from leave_requests
    where employee_id = v_emp and status = 'approved'
      and start_date < v_end and end_date >= v_start;

    if v_has_att or (v_el + v_cl + v_sl + v_ph) > 0 then
      v_src := 'live';
      v_att := jsonb_build_object(
        'working_days', v_days - v_wo, 'present', v_present, 'weekly_off', v_wo,
        'el', v_el, 'cl', v_cl, 'sl', v_sl, 'ph', v_ph,
        'days_payable', v_present + v_wo + v_el + v_cl + v_sl + v_ph, 'source', v_src);
    else
      v_att := jsonb_build_object(
        'working_days', 0, 'present', 0, 'weekly_off', 0, 'el', 0, 'cl', 0,
        'sl', 0, 'ph', 0, 'days_payable', 0, 'source', 'none');
    end if;
  end if;

  return jsonb_build_object(
    'designation', null,
    'department', v_dept,
    'doj', null,
    'emp_code', v_code,
    'uan', nullif(v_uan, ''),
    'esi_no', nullif(v_esi, ''),
    'pan_masked', case when nullif(v_pan,'') is null then null
                       else repeat('X', greatest(length(v_pan) - 4, 0)) || right(v_pan, 4) end,
    'attendance', v_att,
    'leave_available', jsonb_build_object('el', v_bal_el, 'cl', v_bal_cl, 'sl', v_bal_sl)
  );
end;
$$;

revoke all on function public.my_payslip_extras(int, int) from public, anon;
grant execute on function public.my_payslip_extras(int, int) to authenticated, service_role;
