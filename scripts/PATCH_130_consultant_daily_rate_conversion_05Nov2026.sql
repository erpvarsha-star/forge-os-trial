-- PATCH_130: Convert CON05/CON09/CON12/CON13 from rate_type='monthly' to 'daily'
-- Decision from Yash, 5 Nov 2026: real per-day rates given, apply effective 01/10/2026.
-- CON05 770, CON09 884, CON12 1846, CON13 2115 per day.
-- CON01/CON20/CON24 already daily (700/762/500) and are UNCHANGED by this patch.
--
-- Applied live via the Supabase MCP tool 5 Nov 2026. Record only — do not re-run
-- (re-running would try to close an already-closed row and insert duplicates).

-- Close old monthly rows at 30 Sep 2026
update employee_salary_structure
set effective_to = '2026-09-30'
where employee_id in (select id from employees where emp_code in ('CON05','CON09','CON12','CON13'))
  and effective_to is null and rate_type = 'monthly';

-- Insert new daily-rate rows effective 1 Oct 2026, carrying over bank/pan/uan/ifsc/esi from the old row
insert into employee_salary_structure
  (employee_id, rate_type, daily_rate, ctc_annual, bank_name, ifsc, account_no, uan, pan, esi_no, effective_from, effective_to, is_active)
select e.id, 'daily',
  case e.emp_code when 'CON05' then 770 when 'CON09' then 884 when 'CON12' then 1846 when 'CON13' then 2115 end,
  0, old.bank_name, old.ifsc, old.account_no, old.uan, old.pan, old.esi_no,
  '2026-10-01', null, true
from employees e
join employee_salary_structure old on old.employee_id = e.id and old.effective_to = '2026-09-30'
where e.emp_code in ('CON05','CON09','CON12','CON13');
