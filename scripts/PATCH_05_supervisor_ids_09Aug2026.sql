-- =============================================================
-- FORGE OS — PATCH 05: Supervisor assignments + VFL1528 phone fix
-- Date: 09 August 2026
-- Run ONCE in Supabase Dashboard → SQL Editor
-- Requires PATCH_03 and PATCH_04 to be applied first.
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- 0. VFL1528 phone fix
--    Contact list showed duplicate 9518905470 (same as VFL1520).
--    Confirmed correct number from Supervisor_Map.csv.
-- ──────────────────────────────────────────────────────────────
UPDATE employees SET phone = '+918805698127' WHERE emp_code = 'VFL1528';


-- ──────────────────────────────────────────────────────────────
-- 1. plant_head_id — Fazal Ilahi Khan (VFL1386) for all active
-- ──────────────────────────────────────────────────────────────
UPDATE employees
SET plant_head_id = (SELECT id FROM employees WHERE emp_code = 'VFL1386')
WHERE is_active = true
  AND emp_code != 'VFL1386'
  AND emp_code != 'VFL1001'; -- owner is not under plant_head


-- ──────────────────────────────────────────────────────────────
-- 2. manager_id assignments (departments with a single clear manager)
-- ──────────────────────────────────────────────────────────────

-- Heat Treatment: manager = VFL1064 Balasaheb Todmal
-- (his supervisors VFL1066 Ramnath Gadekar, VFL1568 Farhan Shah; workers VFL4066, 4071, 4072)
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL1064')
WHERE department = 'Heat Treatment'
  AND emp_code != 'VFL1064';

-- Machine Shop: manager = VFL1528 Bhupendra Bharude
-- (supervisors VFL1272, VFL1290, VFL1327; members VFL1543, VFL5203, VFL5272, VFL5273,
--  VFL5302, VFL5303, VFL5321, VFL5354, VFL5382, VFL5383, VFL5425)
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL1528')
WHERE department = 'Machine Shop'
  AND emp_code != 'VFL1528';

-- Maintenance: manager = VFL1560 Shaikh Majeed
-- (supervisor VFL4057 Devendrakumar Singh; members VFL1391, VFL1446, VFL1549,
--  VFL5322, VFL5323, VFL5324, VFL5337, VFL5405, VFL5410, VFL5448;
--  workers VFL4006, VFL4012, VFL4016, VFL4023, VFL4061)
UPDATE employees
SET manager_id = (SELECT id FROM employees WHERE emp_code = 'VFL1560')
WHERE department = 'Maintenance'
  AND emp_code != 'VFL1560';


-- ──────────────────────────────────────────────────────────────
-- 3. supervisor_id assignments (departments with a single fixed supervisor)
-- ──────────────────────────────────────────────────────────────

-- Final Shop: supervisor = VFL5444 Subhash Thorat (fixed per Supervisor_Map)
-- Workers: VFL4028, VFL4030, VFL4038, VFL4063
UPDATE employees
SET supervisor_id = (SELECT id FROM employees WHERE emp_code = 'VFL5444')
WHERE emp_code IN ('VFL4028','VFL4030','VFL4038','VFL4063');

-- Die Shop: supervisor = VFL1550 Swapnil Kakade (single supervisor in department)
-- Staff members: VFL1450, VFL5318, VFL5347, VFL5409, VFL5413
-- Workers: VFL4004, VFL4007, VFL4008, VFL4015, VFL4017, VFL4032
UPDATE employees
SET supervisor_id = (SELECT id FROM employees WHERE emp_code = 'VFL1550')
WHERE emp_code IN (
  'VFL1450','VFL5318','VFL5347','VFL5409','VFL5413',
  'VFL4004','VFL4007','VFL4008','VFL4015','VFL4017','VFL4032'
);

-- Maintenance: supervisor = VFL4057 Devendrakumar Jagdish Singh
-- Staff members: VFL1391, VFL1446, VFL1549, VFL5322, VFL5323, VFL5324,
--                VFL5337, VFL5405, VFL5410, VFL5448
-- Workers: VFL4006, VFL4012, VFL4016, VFL4023, VFL4061
UPDATE employees
SET supervisor_id = (SELECT id FROM employees WHERE emp_code = 'VFL4057')
WHERE emp_code IN (
  'VFL1391','VFL1446','VFL1549',
  'VFL5322','VFL5323','VFL5324','VFL5337','VFL5405','VFL5410','VFL5448',
  'VFL4006','VFL4012','VFL4016','VFL4023','VFL4061'
);

-- Forge Shop: supervisor ROTATES weekly (see Supervisor_Map.csv).
-- Week 1 (04-10 Aug 2026): VFL5079 Sudeep Singh
-- Week 2 (11-17 Aug 2026): VFL1516 Subhash Palve
-- Week 3 (18-24 Aug 2026): VFL5074 Angad Kate
-- Setting Week 1 now. Update this weekly or build a cron job.
-- Staff members: VFL1453, VFL5237
-- Workers: VFL4011, VFL4014, VFL4018, VFL4020, VFL4021, VFL4024, VFL4025, VFL4026,
--          VFL4029, VFL4033, VFL4036, VFL4040, VFL4041, VFL4042, VFL4045, VFL4048,
--          VFL4064, VFL4065, VFL4068, VFL4075
UPDATE employees
SET supervisor_id = (SELECT id FROM employees WHERE emp_code = 'VFL5079')
WHERE emp_code IN (
  'VFL1453','VFL5237',
  'VFL4011','VFL4014','VFL4018','VFL4020','VFL4021','VFL4024','VFL4025','VFL4026',
  'VFL4029','VFL4033','VFL4036','VFL4040','VFL4041','VFL4042','VFL4045','VFL4048',
  'VFL4064','VFL4065','VFL4068','VFL4075'
);

-- ──────────────────────────────────────────────────────────────
-- PENDING (waiting for org chart from Yash):
--   Cutting Shop: Darshan Alhat (VFL5442) is seeded as 'member' in Stores —
--     role/dept discrepancy to resolve before assigning supervisor_id to
--     VFL4002, VFL4043, VFL5083.
--   Heat Treatment: 2 supervisors (VFL1066, VFL1568) for 3 workers (VFL4066,
--     VFL4071, VFL4072) — need split from Yash.
--   Machine Shop: 3 supervisors (VFL1272, VFL1290, VFL1327) — need member→
--     supervisor mapping from Yash.
--   Press Shop: supervisors named in Supervisor_Map (Vaibhav Mali,
--     Shakeel Sayyad, Shyambabu Yadav) are not found in employee seed —
--     may need to be added as employees.
--   Electricity & Oil: supervisors from Supervisor_Map are Maintenance dept
--     employees (VFL1560, VFL1391, VFL5337, etc.) assigned weekly.
--   VMC Shop: 2 managers (VFL1463, VFL1566) — need primary from Yash.
-- ──────────────────────────────────────────────────────────────


-- Verify
SELECT emp_code, name, department, role,
       (SELECT emp_code FROM employees m WHERE m.id = e.supervisor_id) AS supervisor,
       (SELECT emp_code FROM employees m WHERE m.id = e.manager_id)    AS manager,
       (SELECT emp_code FROM employees m WHERE m.id = e.plant_head_id) AS plant_head
FROM employees e
WHERE supervisor_id IS NOT NULL
   OR manager_id IS NOT NULL
ORDER BY department, emp_code;

SELECT
  COUNT(*) FILTER (WHERE supervisor_id IS NOT NULL) AS with_supervisor,
  COUNT(*) FILTER (WHERE manager_id IS NOT NULL)    AS with_manager,
  COUNT(*) FILTER (WHERE plant_head_id IS NOT NULL) AS with_plant_head,
  COUNT(*) AS total
FROM employees;
-- =============================================================
