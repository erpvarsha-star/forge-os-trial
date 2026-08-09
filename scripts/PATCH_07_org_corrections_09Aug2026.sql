-- =============================================================
-- FORGE OS — PATCH 07: Org-chart corrections (dept / role fixes)
-- Date: 09 August 2026
-- Run ONCE in Supabase Dashboard → SQL Editor
-- Requires PATCH_01 through PATCH_06 to be applied first.
-- Source: Revised org chart confirmed by Yash Munot 09 Aug 2026
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. VFL1463 Dinkar Landge — dept VMC Shop → Press Shop
--    He is Manager of Press Shop (was wrongly seeded as VMC Shop)
-- ──────────────────────────────────────────────────────────────
UPDATE employees
SET department = 'Press Shop', updated_at = now()
WHERE emp_code = 'VFL1463';

-- ──────────────────────────────────────────────────────────────
-- 2. VFL1545 Shaikh Mujahed — role member → manager
--    He is Design Department Manager
-- ──────────────────────────────────────────────────────────────
UPDATE employees
SET role = 'manager', updated_at = now()
WHERE emp_code = 'VFL1545';

-- ──────────────────────────────────────────────────────────────
-- 3. VFL1556 Shyambabu Yadav — dept Quality → Press Shop,
--    role member → supervisor
--    He is Press Shop Supervisor under Dinkar Landge
-- ──────────────────────────────────────────────────────────────
UPDATE employees
SET department = 'Press Shop',
    role       = 'supervisor',
    updated_at = now()
WHERE emp_code = 'VFL1556';

-- ──────────────────────────────────────────────────────────────
-- 4. VFL1389 Tushar Shirgire — role member → manager
--    He is Purchase Department Manager
-- ──────────────────────────────────────────────────────────────
UPDATE employees
SET role = 'manager', updated_at = now()
WHERE emp_code = 'VFL1389';

-- ──────────────────────────────────────────────────────────────
-- 5. VFL1557 Milind Barhate — dept Administration → Human Resource
--    He is HR Department Manager
-- ──────────────────────────────────────────────────────────────
UPDATE employees
SET department = 'Human Resource', updated_at = now()
WHERE emp_code = 'VFL1557';

-- ──────────────────────────────────────────────────────────────
-- 6. VFL5447 Sarang Shinde — dept Sales & Logistics → Administration
--    He is under IT / Security / Admin (Majeed Shaikh)
-- ──────────────────────────────────────────────────────────────
UPDATE employees
SET department = 'Administration', updated_at = now()
WHERE emp_code = 'VFL5447';

-- ──────────────────────────────────────────────────────────────
-- 7. Update manager_id for Design dept (now that VFL1545 is manager)
-- ──────────────────────────────────────────────────────────────
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL1545'),
    updated_at = now()
WHERE department = 'Design'
  AND emp_code != 'VFL1545';

-- ──────────────────────────────────────────────────────────────
-- 8. Update manager_id for Purchase dept (VFL1389 is now manager)
-- ──────────────────────────────────────────────────────────────
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL1389'),
    updated_at = now()
WHERE department = 'Purchase'
  AND emp_code != 'VFL1389';

-- ──────────────────────────────────────────────────────────────
-- 9. Update manager_id for Press Shop (VFL1463 is manager)
-- ──────────────────────────────────────────────────────────────
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL1463'),
    updated_at = now()
WHERE department = 'Press Shop'
  AND emp_code != 'VFL1463';

-- ──────────────────────────────────────────────────────────────
-- 10. Set supervisor_id for Press Shop: VFL1556 Shyambabu Yadav
--     (Week 2+ rotating supervisor — update weekly as per Supervisor_Map)
--     Vaibhav Mali (new, added in PATCH_08) will be Week 1 sup once added.
-- ──────────────────────────────────────────────────────────────
-- Run AFTER PATCH_08 to also set Vaibhav Mali as supervisor.

-- Verify
SELECT emp_code, name, department, role,
       (SELECT emp_code FROM employees m WHERE m.id = e.manager_id) AS manager
FROM employees e
WHERE emp_code IN (
  'VFL1463','VFL1545','VFL1556','VFL1389','VFL1557','VFL5447'
)
ORDER BY emp_code;
-- =============================================================
