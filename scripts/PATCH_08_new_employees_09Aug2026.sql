-- =============================================================
-- FORGE OS — PATCH 08: New employee INSERTs (CORRECTED)
-- Date: 10 August 2026
-- Run ONCE in Supabase Dashboard → SQL Editor
-- Requires PATCH_07 to be applied first.
--
-- ⚠ SUPERSEDES the version of this file committed 09 Aug 2026.
--   That version used FABRICATED emp_codes (VFL5463-VFL5467) that
--   were only placeholders — they collided with REAL employees once
--   the actual staff contact list + salary sheet were checked.
--   If you already ran the old version, see the CORRECTION section
--   at the bottom of this file before doing anything else.
--
-- SOURCE: Empl. Cont. No. contact list (confirmed emp_codes + phones)
--         + VFL_Employee_Salary_Sheet (confirmed dept/designation/salary)
--         cross-checked against org chart, 10 Aug 2026
--
-- Nagnath Kale and Sadashiv Soddy do NOT appear in the contact list
-- or salary sheet — they are genuinely outside consultants with no
-- payroll record. NOT inserted here. Add only if Yash confirms they
-- need app logins, with a real emp_code from the master register.
-- =============================================================

INSERT INTO employees
  (emp_code, name, phone, role, department, category, language_preference,
   supervisor_id, manager_id, plant_head_id, salary, is_active)
VALUES

-- ── ACCOUNTS ──────────────────────────────────────────────────
('VFL5462', 'Bharat Vasantrao Salve', '+919763577926', 'manager',    'Accounts',   'staff', 'en', NULL, NULL, NULL, 26790, true),

-- ── FORGE SHOP (Week 3 Aug rotating supervisor) ──────────────
('VFL5458', 'Shaikh Irfan',           '+919923723662', 'supervisor', 'Forge Shop', 'staff', 'en', NULL, NULL, NULL, 26000, true),

-- ── PRESS SHOP (Week 1 Aug rotating supervisor) ──────────────
('VFL5459', 'Vaibhav Mali',           '+919607238428', 'supervisor', 'Press Shop', 'staff', 'en', NULL, NULL, NULL, 21711, true),

-- ── FINAL SHOP (Sr. Supervisor) ──────────────────────────────
('VFL5460', 'Ashok Kumar',            '+919887803962', 'supervisor', 'Final Shop', 'staff', 'en', NULL, NULL, NULL, 21711, true)

ON CONFLICT (emp_code) DO NOTHING;


-- ──────────────────────────────────────────────────────────────
-- Post-INSERT: wire manager_id and plant_head_id
-- ──────────────────────────────────────────────────────────────

-- plant_head_id for all new employees (Fazal Ilahi Khan VFL1386)
UPDATE employees
SET plant_head_id = (SELECT id FROM employees WHERE emp_code = 'VFL1386'),
    updated_at = now()
WHERE emp_code IN ('VFL5462','VFL5458','VFL5459','VFL5460')
  AND plant_head_id IS NULL;

-- Bharat Salve has no manager above him in chart (reports direct to plant head)

-- Shaikh Irfan: manager = Sudeep Singh (VFL5079, Forge Shop manager)
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL5079'),
    updated_at = now()
WHERE emp_code = 'VFL5458';

-- Vaibhav Mali: manager = Dinkar Landge (VFL1463, Press Shop manager)
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL1463'),
    updated_at = now()
WHERE emp_code = 'VFL5459';

-- Ashok Kumar: manager = Subhash Thorat (VFL5444, Final Shop in-charge)
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL5444'),
    updated_at = now()
WHERE emp_code = 'VFL5460';


-- ──────────────────────────────────────────────────────────────
-- CORRECTION — only run this section if you already executed the
-- OLD version of PATCH_08 (committed 09 Aug 2026, with fabricated
-- codes VFL5463/5465/5466/5467). It deletes those bad rows so the
-- INSERT above can run cleanly with the correct real codes.
-- Skip this section entirely if you have not yet run PATCH_08.
-- ──────────────────────────────────────────────────────────────
-- DELETE FROM employees WHERE emp_code IN ('VFL5463','VFL5464','VFL5465','VFL5466','VFL5467')
--   AND name IN ('Nagnath Kale','Sadashiv Soddy','Irfan Shaikh','Vaibhav Mali','Ashok Kumar');


-- Verify
SELECT emp_code, name, department, role, phone, salary, is_active
FROM employees
WHERE emp_code IN ('VFL5462','VFL5458','VFL5459','VFL5460')
ORDER BY emp_code;
-- =============================================================
