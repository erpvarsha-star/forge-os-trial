-- FORGE OS — PATCH 01: HR Admin role correction
-- Date: 03 August 2026
-- Confirmed by Yash: VFL5440 Pallavi Vishnu Khade = hr_admin

UPDATE public.employees
SET role = 'hr_admin'
WHERE emp_code = 'VFL5440';

-- Verify
SELECT emp_code, name, role FROM public.employees WHERE emp_code = 'VFL5440';
