-- =============================================================
-- FORGE OS — PATCH 02
-- Date: 04 August 2026
-- 1. Promote Fazal Ilahi Khan (VFL1386) to plant_head
-- 2. Set Yash Munot (VFL1001) phone number
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================

UPDATE employees
SET role = 'plant_head'
WHERE emp_code = 'VFL1386';

UPDATE employees
SET phone = '+919823080707'
WHERE emp_code = 'VFL1001';

-- Verify
SELECT emp_code, name, role, phone
FROM employees
WHERE emp_code IN ('VFL1386', 'VFL1001');
