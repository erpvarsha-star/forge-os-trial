-- =============================================================
-- FORGE OS — PATCH 09: New employee INSERTs (QA / Purchase / Maintenance)
-- Date: 10 August 2026
-- Run ONCE in Supabase Dashboard → SQL Editor
-- Requires PATCH_08 to be applied first.
--
-- SOURCE: Empl. Cont. No. contact list (confirmed emp_codes + phones)
--         + VFL_Employee_Salary_Sheet (confirmed dept/designation/salary)
-- These 5 were the employees still missing emp_codes/phones as of
-- PATCH_08 — all now confirmed.
-- =============================================================

INSERT INTO employees
  (emp_code, name, phone, role, department, category, language_preference,
   supervisor_id, manager_id, plant_head_id, salary, is_active)
VALUES

-- ── QA / QMS ──────────────────────────────────────────────────
('VFL5461', 'Shaikh Hafizuddin Tamizuddin', '+918857933692', 'manager',    'Quality',     'staff', 'en', NULL, NULL, NULL, 34000, true),
('VFL5452', 'Bholanath Das',                '+917908149285', 'member',     'Forge Shop',  'staff', 'en', NULL, NULL, NULL, 16470, true),

-- ── PRESS SHOP QA ─────────────────────────────────────────────
('VFL5453', 'Shaikh Zaker Abdul Quayyum',   '+917276433175', 'member',     'Press Shop',  'staff', 'en', NULL, NULL, NULL, 15253, true),

-- ── MAINTENANCE ───────────────────────────────────────────────
('VFL5457', 'Sandip Tryambak Landage',      '+919049228124', 'member',     'Maintenance', 'staff', 'en', NULL, NULL, NULL, 20804, true),

-- ── PURCHASE ──────────────────────────────────────────────────
('VFL5454', 'Shaikh Tohid Yunus',           '+919699538391', 'member',     'Purchase',    'staff', 'en', NULL, NULL, NULL, 15682, true)

ON CONFLICT (emp_code) DO NOTHING;


-- ──────────────────────────────────────────────────────────────
-- Bonus: found in payroll but not previously tracked in org chart.
-- Adding since he is active payroll staff with a confirmed code.
-- ──────────────────────────────────────────────────────────────
INSERT INTO employees
  (emp_code, name, phone, role, department, category, language_preference,
   supervisor_id, manager_id, plant_head_id, salary, is_active)
VALUES
('VFL5463', 'Manoj Anantrao Wagh', '+917875491749', 'member', 'Maintenance', 'staff', 'en', NULL, NULL, NULL, 18480, true)
ON CONFLICT (emp_code) DO NOTHING;


-- ──────────────────────────────────────────────────────────────
-- Post-INSERT: wire manager_id / plant_head_id
-- ──────────────────────────────────────────────────────────────

UPDATE employees
SET plant_head_id = (SELECT id FROM employees WHERE emp_code = 'VFL1386'),
    updated_at = now()
WHERE emp_code IN ('VFL5461','VFL5452','VFL5453','VFL5457','VFL5454','VFL5463')
  AND plant_head_id IS NULL;

-- Shaikh Hafizuddin Tamizuddin: QA In-charge, no manager above him in chart
-- (unless Sadashiv Soddy — consultant, not in DB — is confirmed as his manager)

-- Bholanath Das: manager = Shaikh Hafizuddin Tamizuddin (VFL5461, QA)
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL5461'),
    updated_at = now()
WHERE emp_code = 'VFL5452';

-- Shaikh Zaker: manager = Shaikh Hafizuddin Tamizuddin (VFL5461, QA)
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL5461'),
    updated_at = now()
WHERE emp_code = 'VFL5453';

-- Sandip Landage: manager = Majeed Shaikh (VFL1560, Maintenance)
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL1560'),
    updated_at = now()
WHERE emp_code = 'VFL5457';

-- Shaikh Tohid: manager = Tushar Shirigire (VFL1389, Purchase manager after PATCH_07)
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL1389'),
    updated_at = now()
WHERE emp_code = 'VFL5454';

-- Manoj Wagh: manager = Majeed Shaikh (VFL1560, Maintenance)
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL1560'),
    updated_at = now()
WHERE emp_code = 'VFL5463';


-- Verify
SELECT emp_code, name, department, role, phone, salary, is_active
FROM employees
WHERE emp_code IN ('VFL5461','VFL5452','VFL5453','VFL5457','VFL5454','VFL5463')
ORDER BY emp_code;

SELECT COUNT(*) AS total_employees FROM employees;
-- Expect 120 (original) + 4 (PATCH_08) + 6 (PATCH_09) = 130
-- =============================================================
