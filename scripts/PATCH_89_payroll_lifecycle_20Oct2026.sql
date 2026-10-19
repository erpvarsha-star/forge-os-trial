-- PATCH_89 — Pay run lifecycle, immutable results, status history, audit log.
-- ADDITIVE ONLY: no existing table is dropped or rewritten.
-- payroll_records stays the working table; pay runs snapshot into pay_run_items.

-- 1a. Pay periods -------------------------------------------------------------
create table if not exists pay_periods (
  id uuid primary key default gen_random_uuid(),
  month text not null,                 -- '04' style, matches payroll_records
  year text not null,                  -- '2026', matches payroll_records
  start_date date not null,
  end_date date not null,
  working_days numeric(4,1),
  status text not null default 'open'
    check (status in ('open','locked')),
  unique (month, year)
);

-- 1b. Pay runs + state machine ------------------------------------------------
create table if not exists pay_runs (
  id uuid primary key default gen_random_uuid(),
  pay_period_id uuid not null references pay_periods(id),
  name text not null,                  -- e.g. 'October 2026 — Main'
  status text not null default 'draft' check (status in (
    'draft','calculating','calculated','in_review','approved',
    'finalized','payment_file_generated','paid','archived','cancelled')),
  adjustment_of uuid references pay_runs(id),   -- set for retro/adjustment runs
  created_by uuid references employees(id),
  created_at timestamptz not null default now(),
  approved_by uuid references employees(id),
  approved_at timestamptz,
  finalized_at timestamptz,
  paid_at timestamptz,
  note text
);

-- Allowed transitions, enforced in the DB (not just in app code):
create or replace function enforce_pay_run_transition()
returns trigger language plpgsql as $$
declare allowed text[];
begin
  allowed := case old.status
    when 'draft'                   then array['calculating','cancelled']
    when 'calculating'             then array['calculated','cancelled']
    when 'calculated'              then array['in_review','cancelled']
    when 'in_review'               then array['approved','draft']
    when 'approved'                then array['finalized']
    when 'finalized'               then array['payment_file_generated']
    when 'payment_file_generated'  then array['paid']
    when 'paid'                    then array['archived']
    else array[]::text[]             -- archived / cancelled: terminal
  end;
  if not (new.status = any(allowed)) then
    raise exception 'Illegal pay run transition: % -> %', old.status, new.status;
  end if;
  return new;
end $$;

drop trigger if exists trg_pay_run_transition on pay_runs;
create trigger trg_pay_run_transition
  before update of status on pay_runs
  for each row execute function enforce_pay_run_transition();

-- 1c. Immutable pay run results ------------------------------------------------
create table if not exists pay_run_items (
  id uuid primary key default gen_random_uuid(),
  pay_run_id uuid not null references pay_runs(id),
  employee_id uuid not null references employees(id),
  payroll_record_id uuid references payroll_records(id),  -- link back to working row
  snapshot jsonb not null,             -- full gross-to-net breakdown, every component
  net_pay numeric(12,2) not null,
  unique (pay_run_id, employee_id)
);

-- Lock items once the run is finalized:
create or replace function lock_finalized_pay_run_items()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from pay_runs
             where id = coalesce(new.pay_run_id, old.pay_run_id)
               and status in ('finalized','payment_file_generated','paid','archived')) then
    raise exception 'Pay run is finalized — items are immutable. Create an adjustment run.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_lock_items_upd on pay_run_items;
create trigger trg_lock_items_upd before update or delete on pay_run_items
  for each row execute function lock_finalized_pay_run_items();

-- 1d. Employee status history --------------------------------------------------
-- Statuses: active | on_leave | left | terminated | retired | rehired
-- ('draft' kept only for legacy rows). Category change is NOT a status change:
-- close the old salary-structure row (effective_to) and open a new one.
create table if not exists employee_status_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  status text not null check (status in ('draft','active','on_leave','left','terminated','retired','rehired')),
  effective_from date not null,
  note text,
  recorded_by uuid references employees(id),
  created_at timestamptz not null default now()
);

-- 1e. Audit log ----------------------------------------------------------------
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  actor_employee_id uuid references employees(id),
  table_name text not null,
  row_id text not null,
  action text not null check (action in ('insert','update','delete')),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

-- Generic audit trigger — attach to money/status tables:
create or replace function audit_row_change()
returns trigger language plpgsql security definer as $$
begin
  insert into audit_log (actor_employee_id, table_name, row_id, action, old_values, new_values)
  values (
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'employee_id','')::uuid,
    TG_TABLE_NAME,
    coalesce(new.id::text, old.id::text),
    lower(TG_OP),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

drop trigger if exists trg_audit_salary on employee_salary_structure;
create trigger trg_audit_salary after insert or update or delete on employee_salary_structure
  for each row execute function audit_row_change();
drop trigger if exists trg_audit_payroll on payroll_records;
create trigger trg_audit_payroll after insert or update or delete on payroll_records
  for each row execute function audit_row_change();

-- 1f. Effective-dating completion on salary structure ---------------------------
alter table employee_salary_structure add column if not exists effective_to date;
-- Rule (app + SQL convention): new version inserts carry effective_from;
-- the previous active row gets effective_to = new effective_from - 1 and is_active=false.
-- Never UPDATE amounts in place on a historical row.

-- 1g. Documents -----------------------------------------------------------------
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  pay_run_id uuid references pay_runs(id),
  kind text not null,                  -- 'contract','id_proof','payslip_pdf','bank_file',...
  storage_path text not null,          -- Supabase Storage path
  created_at timestamptz not null default now()
);

-- 1h. RLS -----------------------------------------------------------------------
alter table pay_periods enable row level security;
alter table pay_runs enable row level security;
alter table pay_run_items enable row level security;
alter table employee_status_history enable row level security;
alter table audit_log enable row level security;
alter table documents enable row level security;
-- Management read/write; employees read only their own items after finalize:
create policy pay_mgmt on pay_runs for all using (is_management());
create policy items_mgmt on pay_run_items for all using (is_management());
create policy items_self on pay_run_items for select
  using (employee_id = auth_employee_id()  -- reuse the existing helper name used by other policies
         and exists (select 1 from pay_runs r where r.id = pay_run_id
                     and r.status in ('finalized','payment_file_generated','paid','archived')));
create policy periods_mgmt on pay_periods for all using (is_management());
create policy status_hist_mgmt on employee_status_history for all using (is_management());
create policy audit_mgmt on audit_log for select using (is_management());
create policy docs_mgmt on documents for all using (is_management());
create policy docs_self on documents for select using (employee_id = auth_employee_id());
