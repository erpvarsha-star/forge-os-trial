-- PATCH_55: 4 employees found only in HR's real salary sheets (uploaded by
-- Yash 28 Sep 2026 — Consultant/Worker/Employee salary sheets, Apr-Aug 2026),
-- not previously in Forge OS at all. Every field below is copied verbatim
-- from each sheet's own Master Data row — nothing guessed.
--
-- CON22 / CON23 — re-hires, not new people: CON22 is Digambar Mahadeo
-- Todekar (the same person as inactive worker VFL4004) and CON23 is Suresh
-- Sopan Gawali (same person as inactive worker VFL4030), both rejoining as
-- consultants from mid-June 2026 (DOJ 13/16 Jun 2026 in the sheet) — same
-- pattern as the VFL5337->VFL5463 rejoin already documented in CLAUDE.md.
-- Consultants have no employee_salary_structure row (that table only
-- covers Worker/Staff's fixed-rate breakdown; consultants are a flat
-- monthly fee, see Master Data's single 'Gross P.M.' column), so only
-- `employees` needs a row for them.
--
-- VFL5455 / VFL5456 — real people (Anil Dadarao Awchar, Maintenance Sr.
-- Engineer; Yograj Vishwanath Dharmik, Maintenance Fitter) who were
-- actually paid Apr-Jun 2026 and Apr 2026 respectively per the sheet, but
-- were never onboarded into Forge OS under any emp_code — a genuine
-- onboarding gap, found while cross-checking every emp_code in the sheets
-- against the live employees table before importing payroll. Both are
-- marked Non-Active in the sheet's own Master Data (left after their last
-- paid month), so inserted as is_active=false — no login provisioned,
-- matching the pattern for other already-departed employees.
insert into employees (emp_code, name, role, department, category, salary, language_preference, is_active, must_change_pin)
values
  ('CON22', 'Digambar Mahadeo Todekar', 'member', 'Die Shop', 'consultant', 0, 'en', true, true),
  ('CON23', 'Suresh Sopan Gawali', 'member', 'Final Shop', 'consultant', 0, 'en', true, true),
  ('VFL5455', 'Anil Dadarao Awchar', 'member', 'Maintenance', 'staff', 33714, 'en', false, true),
  ('VFL5456', 'Yograj Vishwanath Dharmik', 'member', 'Maintenance', 'staff', 27000, 'en', false, true)
on conflict (emp_code) do nothing;

-- Fixed-rate salary structure for the 2 new staff rows, from the same
-- Master Data rows (CTC/basic/HRA/... breakup, bank details) — consultants
-- deliberately excluded (see note above).
insert into employee_salary_structure
  (employee_id, ctc_annual, basic, hra, conveyance, washing, education, heat_allow, vda, production_allow,
   medical, professional_development, communication, uniform, bank_name, ifsc, account_no, uan, pan, esi_no,
   effective_from, is_active)
select e.id, v.ctc_annual, v.basic, v.hra, v.conveyance, v.washing, v.education, 0, 0, 0,
       v.medical, v.professional_development, v.communication, v.uniform,
       v.bank_name, v.ifsc, v.account_no, v.uan, v.pan, null, current_date, true
from (values
  ('VFL5455', 447468, 13486, 8091, 2023, 3034, 2023, 2023, 1011, 674, 1349, 'HDFC BANK', 'HDFC0005992', '50100828617479', '100234603067', 'BPDPA5527H'),
  ('VFL5456', 362652, 10800, 6480, 1620, 2430, 1620, 1620, 810, 540, 1080, 'IDBI BANK', 'IBKL0000076', '76104000249454', '100136450114', 'CCGPD2451Q')
) as v(emp_code, ctc_annual, basic, hra, conveyance, washing, education, medical, professional_development, communication, uniform, bank_name, ifsc, account_no, uan, pan)
join employees e on e.emp_code = v.emp_code
on conflict do nothing;

-- Provision login access for the 2 active consultants — same logic as
-- PATCH_10's provisioning loop (starting PIN = emp_code digits padded to 6),
-- re-run here because it is idempotent (only touches is_active=true rows
-- with auth_user_id still null) rather than duplicated as new code.
do $$
declare
  emp            record;
  new_user_id    uuid;
  synthetic_email text;
  starting_pin   text;
  has_provider_id boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities'
      and column_name = 'provider_id'
  ) into has_provider_id;

  for emp in
    select id, emp_code
    from employees
    where is_active = true
      and auth_user_id is null
      and emp_code is not null
  loop
    synthetic_email := lower(emp.emp_code) || '@forgeos.local';
    starting_pin    := lpad(regexp_replace(emp.emp_code, '\D', '', 'g'), 6, '0');

    if exists (select 1 from auth.users u where u.email = synthetic_email) then
      update employees e
         set auth_user_id = (select u.id from auth.users u where u.email = synthetic_email)
       where e.id = emp.id and e.auth_user_id is null;
      continue;
    end if;

    new_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      is_super_admin
    ) values (
      '00000000-0000-0000-0000-000000000000',
      new_user_id, 'authenticated', 'authenticated', synthetic_email,
      crypt(starting_pin, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('emp_code', emp.emp_code),
      '', '', '', '', false
    );

    if has_provider_id then
      insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), new_user_id, new_user_id, jsonb_build_object('sub', new_user_id::text, 'email', synthetic_email), 'email', now(), now(), now());
    else
      insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (new_user_id::text, new_user_id, jsonb_build_object('sub', new_user_id::text, 'email', synthetic_email), 'email', now(), now(), now());
    end if;

    update employees set auth_user_id = new_user_id where id = emp.id;
  end loop;
end $$;
