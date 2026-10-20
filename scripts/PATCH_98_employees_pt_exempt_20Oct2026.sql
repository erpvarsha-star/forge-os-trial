-- PATCH_98 — employees.pt_exempt (20 Oct 2026)
-- Purpose: Maharashtra Professional Tax exemption list feeding the payroll
-- engine's `ptExempt` input (via feedSync). Decision from Yash, 20 Oct 2026.
-- Additive only: one new NOT NULL column (default false) + flag 3 employees.

alter table public.employees add column if not exists pt_exempt boolean not null default false;
update public.employees set pt_exempt = true where emp_code in ('VFL4021','VFL4014','VFL4063');
