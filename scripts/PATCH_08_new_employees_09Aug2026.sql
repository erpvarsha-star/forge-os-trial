-- =============================================================
-- FORGE OS — PATCH 08: New employee INSERTs
-- Date: 09 August 2026
-- Run ONCE in Supabase Dashboard → SQL Editor
-- Requires PATCH_07 to be applied first.
--
-- SOURCE: Org chart confirmed by Yash Munot 09 Aug 2026
--
-- ⚠ EMP CODES: Bharat Salve = VFL5462 (confirmed by Yash).
--   VFL5463–VFL5467 are SUGGESTED codes — verify against your
--   master register before running. Update numbers if needed.
--
-- ⚠ SALARY: Set to 0 for all new employees.
--   Update with actual salary before running payroll.
-- =============================================================

INSERT INTO employees
  (emp_code, name, phone, role, department, category, language_preference,
   supervisor_id, manager_id, plant_head_id, salary, is_active)
VALUES

-- ── ACCOUNTS & FINANCE ───────────────────────────────────────
-- VFL5462 confirmed by Yash
('VFL5462', 'Bharat Salve',       NULL, 'manager',    'Accounts',    'staff', 'en', NULL, NULL, NULL, 0, true),

-- ── DIE SHOP (Consultant Manager) ────────────────────────────
-- No app login required unless Yash confirms otherwise
('VFL5463', 'Nagnath Kale',       NULL, 'manager',    'Die Shop',    'staff', 'en', NULL, NULL, NULL, 0, true),

-- ── QUALITY / QMS (Consultant Manager) ───────────────────────
-- No app login required unless Yash confirms otherwise
('VFL5464', 'Sadashiv Soddy',     NULL, 'manager',    'Quality',     'staff', 'en', NULL, NULL, NULL, 0, true),

-- ── FORGE SHOP (Week 3 Aug rotating supervisor) ───────────────
('VFL5465', 'Irfan Shaikh',       '+919923723662', 'supervisor', 'Forge Shop',  'staff', 'en', NULL, NULL, NULL, 0, true),

-- ── PRESS SHOP (Week 1 Aug rotating supervisor) ───────────────
('VFL5466', 'Vaibhav Mali',       '+919607238428', 'supervisor', 'Press Shop',  'staff', 'en', NULL, NULL, NULL, 0, true),

-- ── FINAL SHOP (Sr. Supervisor) ───────────────────────────────
-- Full name to confirm with Yash
('VFL5467', 'Ashok Kumar',        NULL, 'supervisor', 'Final Shop',  'staff', 'en', NULL, NULL, NULL, 0, true)

ON CONFLICT (emp_code) DO NOTHING;


-- ──────────────────────────────────────────────────────────────
-- Post-INSERT: wire manager_id and plant_head_id
-- ──────────────────────────────────────────────────────────────

-- plant_head_id for all new employees (Fazal Ilahi Khan VFL1386)
UPDATE employees
SET plant_head_id = (SELECT id FROM employees WHERE emp_code = 'VFL1386'),
    updated_at = now()
WHERE emp_code IN ('VFL5462','VFL5463','VFL5464','VFL5465','VFL5466','VFL5467')
  AND plant_head_id IS NULL;

-- Bharat Salve has no manager above him in chart (reports direct to plant head)
-- Nagnath Kale has no manager above him in chart
-- Sadashiv Soddy has no manager above him in chart

-- Irfan Shaikh: manager = Sudeep Singh (VFL5079 is listed as Forge Shop manager
--   but VFL5079 is actually a supervisor emp_code; for now leave manager_id NULL
--   until Sudeep Singh's manager role is confirmed in DB)
-- Vaibhav Mali: manager = Dinkar Landge (VFL1463, Press Shop manager)
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL1463'),
    updated_at = now()
WHERE emp_code = 'VFL5466';

-- Ashok Kumar: manager = Subhash Thorat (VFL5444, Final Shop in-charge)
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL5444'),
    updated_at = now()
WHERE emp_code = 'VFL5467';


-- ──────────────────────────────────────────────────────────────
-- PENDING (need more info from Yash before adding):
--   Shaikh Tamizuddin  — QA/QMS In-charge (no phone/emp_code yet)
--   Sandip Landage      — Maintenance Electrician (no phone/emp_code)
--   Shaikh Zaker        — Press Shop Quality Inspector (no phone/emp_code)
--   Bholanath Das       — QA Inspector (no phone/emp_code)
--   Tohid Shaikh        — Purchase Assistant (no phone/emp_code)
-- Add these in PATCH_09 once emp codes and phones are confirmed.
-- ──────────────────────────────────────────────────────────────


-- Verify
SELECT emp_code, name, department, role, phone, is_active
FROM employees
WHERE emp_code IN ('VFL5462','VFL5463','VFL5464','VFL5465','VFL5466','VFL5467')
ORDER BY emp_code;
-- =============================================================
