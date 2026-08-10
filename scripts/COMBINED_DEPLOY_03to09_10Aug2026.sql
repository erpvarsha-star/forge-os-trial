-- =============================================================
-- FORGE OS — COMBINED DEPLOY: PATCH_03 through PATCH_09
-- Generated 2026-08-10 for one-shot run in Supabase SQL Editor
-- Run top to bottom in a single execution. If anything errors,
-- stop and report the error back before re-running.
--
-- NOTE: PATCH_06 leaves the qr_secret_salt UPDATE commented out on
-- purpose — generate your own secret and set it separately, see
-- CLAUDE.md. Do not paste a real secret into this file or into chat.
-- =============================================================

BEGIN;

-- =============================================================
-- >>> PATCH_03_phones_09Aug2026.sql
-- =============================================================
-- =============================================================
-- FORGE OS — PATCH 03: Employee Phone Numbers
-- Date: 09 August 2026
-- Sources:
--   Staff:   Empl._Cont._No..xlsx  (76 employees)
--   Workers: Worker_Cont_No.xlsx   (19 workers)
--
-- VFL1001 (Yash) already set in PATCH_02 — included here for
-- completeness; re-running is safe (same value).
--
-- KNOWN DISCREPANCIES (contact list used as authority over salary sheet):
--   VFL1327 Santosh Sawai:       contact=9423715670, salary=9422809190
--   VFL1386 Fazal Khan:          contact=9823395533, salary=9423715670
--   VFL1391 Atul Patil:          contact=7264809381, salary=9860613342
--   VFL1450 Kishan Giri:         contact=8551853716, salary=8208357893
--   VFL1560 Shaikh Majeed:       contact=8830252123, salary=8446531791
--   (Salary sheet phone column appears to be systematically shifted by a
--    few rows — contact list is the dedicated source and takes priority.)
--
-- SKIPPED — VERIFY MANUALLY WITH YASH:
--   VFL1527 Sharwan Singh Jodha  — contact list shows 9518905470 (DUPLICATE)
--   VFL1528 Bhupendra Bharude    — contact list shows 9518905470 (DUPLICATE)
--   Both employees have the same number in the contact list which violates
--   the UNIQUE constraint. Update these two after confirming correct numbers.
--
-- Workers without phones (~20 workers not in Worker_Cont_No.xlsx): NULL
-- Staff without phones (~5 employees not in Empl._Cont._No.xlsx):  NULL
-- =============================================================

UPDATE employees
SET phone = v.phone
FROM (VALUES

  -- ── STAFF (Empl._Cont._No..xlsx) ─────────────────────────────────────
  ('VFL1001', '+919823080707'),  -- Yash Jinendra Munot         (Owner)
  ('VFL1064', '+919763776328'),  -- Balasaheb Shivaji Todmal
  ('VFL1066', '+917719012879'),  -- Ramnath Babasaheb Gadekar
  ('VFL1272', '+919922463647'),  -- Haribhau Shamrao Datar
  ('VFL1290', '+918830223648'),  -- Pravin Pundalik Sonavane
  ('VFL1327', '+919423715670'),  -- Santosh Vishwanath Sawai    [salary: 9422809190]
  ('VFL1386', '+919823395533'),  -- Fazal Ilahi Khan            (Plant Head) [salary: 9423715670]
  ('VFL1389', '+919860613342'),  -- Tushar Abasaheb Shirgire
  ('VFL1391', '+917264809381'),  -- Atul Bhata Patil            [salary: 9860613342]
  ('VFL1446', '+917387156331'),  -- Dharmendra Prabhu Mahto
  ('VFL1450', '+918551853716'),  -- Kishan Suresh Giri          [salary: 8208357893]
  ('VFL1453', '+918421104688'),  -- Laxman Yadav
  ('VFL1463', '+919637880700'),  -- Dinkar Landge
  ('VFL1465', '+918459835117'),  -- Mahipal Singh
  ('VFL1482', '+918888036251'),  -- Brahmanand Kaduba Tajne
  ('VFL1516', '+919028082100'),  -- Subhash Sitaram Palve
  ('VFL1520', '+918955273074'),  -- Shrawan Rewant Singh
  -- VFL1527 SKIPPED: duplicate phone in contact list — verify and run manually
  -- VFL1528 SKIPPED: duplicate phone in contact list — verify and run manually
  ('VFL1543', '+919552708382'),  -- Shaikh Mobin Shaikh Sultan
  ('VFL1545', '+919822934865'),  -- Shaikh Mujahed Shaikh Naeem
  ('VFL1549', '+919881478633'),  -- Shaikh Wajid Shaikh Shabbir
  ('VFL1556', '+919305654119'),  -- Shyambabu Radheshyam Yadav
  ('VFL1557', '+919423921576'),  -- Milind Ambadas Barhate
  ('VFL1560', '+918830252123'),  -- Shaikh Majeed               [salary: 8446531791]
  ('VFL1562', '+919067714113'),  -- Sachin Suresh Rathod
  ('VFL1564', '+917776088223'),  -- Syed Inzamam Ali
  ('VFL1566', '+918806922846'),  -- Abhimanyu Kakde
  ('VFL1567', '+919309937201'),  -- Kajal Balkrishna Sutar
  ('VFL1568', '+919021347785'),  -- Farhan Ahmad Shah
  ('VFL4057', '+917414968926'),  -- Devendrakumar Jagdish Singh (Supervisor)
  ('VFL5079', '+917219658792'),  -- Sudeep Singh
  ('VFL5237', '+917499169405'),  -- Saroj Avdesh Singh
  ('VFL5272', '+919766264823'),  -- Ramesh Narayan Gote
  ('VFL5273', '+919987564378'),  -- Anna Pralhad Deshmukh
  ('VFL5302', '+918552817886'),  -- Nanasaheb Dinkar Shinde
  ('VFL5303', '+919130401298'),  -- Dilip Sanjay Ghegde
  ('VFL5318', '+919552466837'),  -- Gorakh Sitaram More
  ('VFL5321', '+919579956176'),  -- Bhaiyyasaheb Sambhaji Patil
  ('VFL5322', '+919767495797'),  -- Jakir Munshi Chaudhari
  ('VFL5324', '+919518300916'),  -- Shivaji Suresh Jaypure
  ('VFL5337', '+917875491749'),  -- Manoj Anantrao Wagh (was misfiled as new-hire VFL5463 in an earlier PATCH_08/09 draft — corrected 10 Aug)
  ('VFL5347', '+919765961946'),  -- Rajdev Narpat Prasad
  ('VFL5379', '+917057396234'),  -- Gaurav Deelip Kakde
  ('VFL5382', '+919922825336'),  -- Vitthal Uddhav Tekale
  ('VFL5397', '+919309952722'),  -- Amol Rakhmaji Ambhore
  ('VFL5398', '+918265091427'),  -- Arun Dilip Gaikwad
  ('VFL5399', '+919370769318'),  -- Chandan Milind Sonapasare
  ('VFL5400', '+918459261783'),  -- Manbodh Sambhu Sah
  ('VFL5405', '+917276160558'),  -- Sunil Ramakant Saha
  ('VFL5409', '+919049429785'),  -- Dilip Pralhad Arak
  ('VFL5413', '+919850242109'),  -- Sachin Somnath Parmeshwar
  ('VFL5415', '+919325603396'),  -- Payal Sudhir Surve
  ('VFL5428', '+918421063089'),  -- Saurabh Niwas Ghorpade
  ('VFL5430', '+919970565384'),  -- Kisan Ashok Waghule
  ('VFL5433', '+917218033679'),  -- Aniket Kailas Taru
  ('VFL5434', '+917756895631'),  -- Amit Bhagvan Shirsath
  ('VFL5439', '+919970258665'),  -- Bhanwar Singh Rathod
  ('VFL5440', '+917057078479'),  -- Pallavi Vishnu Khade        (HR Admin)
  ('VFL5442', '+917972356441'),  -- Darshan Anil Alhat
  ('VFL5444', '+919922507343'),  -- Subhash Shivanand Thorat
  ('VFL5446', '+917420899624'),  -- Mayuri Sardar Rathod
  ('VFL5447', '+919665819084'),  -- Sarang Kishor Shinde
  ('VFL5448', '+919657869377'),  -- Vijay Rangnath Sonawane
  ('VFL5449', '+919922883931'),  -- Siddiqui Mohd Zainul Abedin
  ('VFL5450', '+919309799899'),  -- Sayed Uzaif Ali Syed Altaf Ali
  ('VFL5451', '+917972292384'),  -- Ezaan Ahmed Khan
  ('VFL5452', '+917908149285'),  -- Bholanath Das
  ('VFL5453', '+917276433175'),  -- Shaikh Zaker Abdul Quayyum
  ('VFL5454', '+919699538391'),  -- Shaikh Tohid Yunus
  ('VFL5457', '+919049228124'),  -- Sandip Tryambak Landage
  ('VFL5458', '+919923723662'),  -- Shaikh Irfan
  ('VFL5459', '+919607238428'),  -- Vaibhav Mali
  ('VFL5460', '+919887803962'),  -- Ashok Kumar
  ('VFL5461', '+918857933692'),  -- Shaikh Hafizuddin Tamizuddin
  ('VFL5462', '+919763577926'),  -- Bharat Vasantrao Salve
  -- VFL5463 removed 10 Aug: this phone belongs to VFL5337 (see above), not a
  -- separate new employee. See PATCH_09 note for the full correction.

  -- ── WORKERS (Worker_Cont_No.xlsx) ────────────────────────────────────
  ('VFL4008', '+919881157193'),  -- Dnyaneshwar Nivrutti Harishchandre
  ('VFL4011', '+918698825349'),  -- Banwari Harihar Yadav
  ('VFL4012', '+919921968920'),  -- Kailas Ramdas Darandale
  ('VFL4024', '+919156862257'),  -- Ramesh Sitaram Sharma
  ('VFL4025', '+917620608037'),  -- Raghav Harihar Yadav
  ('VFL4026', '+919284919021'),  -- Parbhansh Tameshwar Yadav
  ('VFL4032', '+919881028107'),  -- Vitthal Kondiba Kanade
  ('VFL4033', '+917709247389'),  -- Bireshkumar Jagdish Singh
  ('VFL4036', '+918888473974'),  -- Bhagwan Revji Walunj
  ('VFL4041', '+919766084792'),  -- Sharad Kisan Dargude
  ('VFL4042', '+919403061614'),  -- Rajkumar Vyankatrao Amge
  ('VFL4043', '+919763365383'),  -- Uttam Kacharu Bhadgal
  ('VFL4045', '+919370719711'),  -- Madhav Laxman Bhande
  ('VFL4063', '+917972274110'),  -- Shivaji Hanumantrao Dangat
  ('VFL4065', '+918766556538'),  -- Ramrao Shrawan Bansode
  ('VFL4066', '+918530148224'),  -- Nitin Rajendra Boralkar
  ('VFL4068', '+918208620279'),  -- Subhash Ramji Rathod
  ('VFL4071', '+919552701531'),  -- Baburao Sambhaji Bakwad
  ('VFL4072', '+917385493807')   -- Gundappa Mahadeo Nadde

) AS v(emp_code, phone)
WHERE employees.emp_code = v.emp_code;

-- =============================================================
-- MANUALLY SET THESE AFTER CONFIRMING CORRECT NUMBERS WITH EMPLOYEES:
--
-- VFL1527 Sharwan Singh Jodha:
--   UPDATE employees SET phone = '+91XXXXXXXXXX' WHERE emp_code = 'VFL1527';
--
-- VFL1528 Bhupendra Kashinath Bharude:
--   UPDATE employees SET phone = '+91XXXXXXXXXX' WHERE emp_code = 'VFL1528';
-- =============================================================

-- Verify
SELECT emp_code, name, phone
FROM employees
WHERE phone IS NOT NULL
ORDER BY emp_code;

SELECT
  count(*) FILTER (WHERE phone IS NOT NULL) AS with_phone,
  count(*) FILTER (WHERE phone IS NULL)     AS without_phone,
  count(*)                                  AS total
FROM employees;


-- =============================================================
-- >>> PATCH_04_schema_fixes_09Aug2026.sql
-- =============================================================
-- =============================================================
-- FORGE OS — PATCH 04: Schema Fixes
-- Date: 09 August 2026
-- Run ONCE in Supabase Dashboard → SQL Editor
-- =============================================================

-- 1. Rename "5s_score" in monthly_scores so PostgREST can reference it.
--    Column names starting with a digit cannot be used in PostgREST
--    order/filter parameters. The EOTM screen and nightly-scoring now use
--    five_s_score.
ALTER TABLE monthly_scores RENAME COLUMN "5s_score" TO five_s_score;

-- 2. Add missing index on employees(auth_user_id).
--    This column is resolved by every RLS helper function on every request.
--    Without an index, each authenticated DB operation does a full scan of
--    the employees table.
CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id ON employees(auth_user_id);

-- 3. Add missing index on attendance_records(employee_id).
--    Supervisor and manager dashboards do .in('employee_id', ids) — the only
--    existing index is on (device_id, date).
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance_records(employee_id);

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'monthly_scores'
ORDER BY ordinal_position;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('employees', 'attendance_records')
ORDER BY tablename, indexname;
-- =============================================================


-- =============================================================
-- >>> PATCH_05_supervisor_ids_09Aug2026.sql
-- =============================================================
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


-- =============================================================
-- >>> PATCH_06_plant_config_09Aug2026.sql
-- =============================================================
-- =============================================================
-- FORGE OS — PATCH 06: Plant config (GPS + QR salt)
-- Date: 09 August 2026
-- Run ONCE in Supabase Dashboard → SQL Editor
-- =============================================================

-- 1. Correct factory gate GPS (confirmed by Yash Munot 09 Aug 2026)
UPDATE plant_config SET config_value = '19.836079', updated_at = now()
WHERE config_key = 'plant_lat';

UPDATE plant_config SET config_value = '75.236261', updated_at = now()
WHERE config_key = 'plant_lng';

-- 2. Geofence radius: 100 m (factory gate, kept from initial config).
--    Increase if workers are getting rejected at the gate.
--    UPDATE plant_config SET config_value = '150' WHERE config_key = 'geofence_radius_meters';

-- 3. Replace placeholder QR secret salt with a real random value.
--    This salt is mixed into the daily rotating gate QR hash.
--    KEEP THIS VALUE — changing it invalidates all currently displayed QR codes.
--    If you suspect it has been leaked, rotate it on a quiet shift changeover.
--
--    ACTION REQUIRED (do not commit this value to git):
--    Generate a secret in your terminal:
--      python3 -c "import secrets; print(secrets.token_hex(24))"
--    Then paste YOUR_GENERATED_SECRET below and run this statement:
--
-- UPDATE plant_config
-- SET config_value = '"YOUR_GENERATED_SECRET"',
--     updated_at = now()
-- WHERE config_key = 'qr_secret_salt';

-- Verify
SELECT config_key, config_value, updated_at
FROM plant_config
ORDER BY config_key;
-- =============================================================


-- =============================================================
-- >>> PATCH_07_org_corrections_09Aug2026.sql
-- =============================================================
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


-- =============================================================
-- >>> PATCH_08_new_employees_09Aug2026.sql
-- =============================================================
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


-- =============================================================
-- >>> PATCH_09_qa_purchase_maintenance_10Aug2026.sql
-- =============================================================
-- =============================================================
-- FORGE OS — PATCH 09: New employee INSERTs (QA / Purchase / Maintenance)
-- Date: 10 August 2026 (corrected 10 Aug — duplicate Manoj Wagh insert removed)
-- Run ONCE in Supabase Dashboard → SQL Editor
-- Requires PATCH_08 to be applied first.
--
-- SOURCE: Empl. Cont. No. contact list (confirmed emp_codes + phones)
--         + VFL_Employee_Salary_Sheet (confirmed dept/designation/salary)
-- These 5 were the employees still missing emp_codes/phones as of
-- PATCH_08 — all now confirmed.
-- A 6th candidate, 'Manoj Anantrao Wagh' (VFL5463), was dropped after
-- cross-checking the org chart: he is the same person as VFL5337, already
-- in the seed with the same name/phone/salary/department.
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

-- NOTE: 'Manoj Anantrao Wagh' (VFL5463, +917875491749, Maintenance, 18480) was
-- REMOVED from this patch on 10 Aug — he is a DUPLICATE of VFL5337 'Manoj Anantrao
-- Wagh', already in EMPLOYEE_SEED_03Aug2026.sql with the identical name/phone/
-- salary/department, and already has his phone set via PATCH_03. Do not re-add him.


-- ──────────────────────────────────────────────────────────────
-- Post-INSERT: wire manager_id / plant_head_id
-- ──────────────────────────────────────────────────────────────

UPDATE employees
SET plant_head_id = (SELECT id FROM employees WHERE emp_code = 'VFL1386'),
    updated_at = now()
WHERE emp_code IN ('VFL5461','VFL5452','VFL5453','VFL5457','VFL5454')
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


-- Verify
SELECT emp_code, name, department, role, phone, salary, is_active
FROM employees
WHERE emp_code IN ('VFL5461','VFL5452','VFL5453','VFL5457','VFL5454')
ORDER BY emp_code;

SELECT COUNT(*) AS total_employees FROM employees;
-- Expect 120 (original) + 4 (PATCH_08) + 5 (PATCH_09) = 129
-- =============================================================


-- =============================================================
-- All 7 patches applied. Review the SELECT outputs above, then:
COMMIT;
-- If you saw an error above instead of reaching this line, Supabase's
-- SQL Editor will have already rolled the transaction back automatically —
-- nothing was partially applied. Paste the error back here.
-- =============================================================
