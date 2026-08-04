-- =============================================================
-- FORGE OS — MASTER RUN SCRIPT
-- Run this in Supabase Dashboard → SQL Editor (paste entire file)
-- Order matters: schema first, then departments, then employees, then patch.
-- All inserts are idempotent (ON CONFLICT DO NOTHING) — safe to re-run.
-- Date: 04 August 2026
-- =============================================================

-- STEP 1: Full schema (creates all tables + plant_config seed + departments)
-- Paste contents of: FINAL_SCHEMA_02Aug2026.sql
-- (too large to inline here — run separately first if not already done)

-- STEP 2: Staff employees (81 records — owner, managers, supervisors, security, members)
\i EMPLOYEE_SEED_03Aug2026.sql

-- STEP 3: Worker employees (39 records — all role=member)
\i WORKER_SEED_04Aug2026.sql

-- STEP 4: HR Admin role correction (VFL5440 Pallavi Vishnu Khade)
\i PATCH_01_hrAdmin_03Aug2026.sql

-- STEP 5: Plant Head + Owner phone (VFL1386 Fazal, VFL1001 Yash)
\i PATCH_02_plantHead_phone_04Aug2026.sql

-- =============================================================
-- POST-RUN VERIFICATION
-- =============================================================

SELECT role, count(*) FROM employees GROUP BY role ORDER BY role;

SELECT
  (SELECT count(*) FROM employees WHERE is_active = true)  AS active_employees,
  (SELECT count(*) FROM employees WHERE is_active = false) AS archived_employees,
  (SELECT count(*) FROM employees)                         AS total_employees,
  (SELECT count(*) FROM departments)                       AS departments;
