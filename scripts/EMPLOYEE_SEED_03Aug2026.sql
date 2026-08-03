-- =============================================================
-- FORGE OS — EMPLOYEE SEED (STAFF)
-- Generated: 03 August 2026
-- Source: Salary Feb 2026.xlsx - Staff.csv
-- Schema: public.employees (current Supabase live schema)
-- Columns: emp_code, name, phone, role, department, category,
--          language_preference, supervisor_id, manager_id,
--          plant_head_id, salary, is_active
-- Notes:
--   phone = NULL (not in salary sheet — add separately)
--   supervisor_id / manager_id / plant_head_id = NULL (blocked)
--   salary = FIXED Gross PM from salary sheet
--   category = 'staff' for all records in this file
--   language_preference = 'en' default
--   Workers (separate sheet) NOT included here
-- =============================================================

-- Role mapping used:
--   Executive Director         → owner
--   Manager / Sr. Manager / Dy Manager → manager
--   Supervisor / Sr. Supervisor / Production Supervisor / Hobbing Supervisor → supervisor
--   Security Guard             → security_guard
--   All others                 → member

INSERT INTO public.employees
  (emp_code, name, phone, role, department, category, language_preference,
   supervisor_id, manager_id, plant_head_id, salary, is_active)
VALUES

-- ── OWNER ────────────────────────────────────────────────────
('VFL1001', 'Yash Jinendra Munot',         NULL, 'owner',          'Production',      'staff', 'en', NULL, NULL, NULL, 0,      true),

-- ── MANAGERS ─────────────────────────────────────────────────
('VFL1064', 'Balasaheb Shivaji Todmal',    NULL, 'manager',        'Heat Treatment',  'staff', 'en', NULL, NULL, NULL, 31500,  true),
('VFL1386', 'Fazal Ilahi Khan',            NULL, 'manager',        'Purchase',        'staff', 'en', NULL, NULL, NULL, 148706, true),
('VFL1463', 'Dinkar Landge',               NULL, 'manager',        'VMC Shop',        'staff', 'en', NULL, NULL, NULL, 57750,  true),
('VFL1528', 'Bhupendra Kashinath Bharude', NULL, 'manager',        'Machine Shop',    'staff', 'en', NULL, NULL, NULL, 55290,  true),
('VFL1560', 'Shaikh Majeed',               NULL, 'manager',        'Maintenance',     'staff', 'en', NULL, NULL, NULL, 58000,  true),
('VFL1566', 'Abhimanyu Kakde',             NULL, 'manager',        'VMC Shop',        'staff', 'en', NULL, NULL, NULL, 41040,  true),

-- ── SUPERVISORS ───────────────────────────────────────────────
('VFL1066', 'Ramnath Babasaheb Gadekar',   NULL, 'supervisor',     'Heat Treatment',  'staff', 'en', NULL, NULL, NULL, 24200,  true),
('VFL1272', 'Haribhau Shamrao Datar',      NULL, 'supervisor',     'Machine Shop',    'staff', 'en', NULL, NULL, NULL, 27166,  true),
('VFL1290', 'Pravin Pundalik Sonavane',    NULL, 'supervisor',     'Machine Shop',    'staff', 'en', NULL, NULL, NULL, 21711,  true),
('VFL1327', 'Santosh Vishwanath Sawai',    NULL, 'supervisor',     'Machine Shop',    'staff', 'en', NULL, NULL, NULL, 21711,  true),
('VFL1516', 'Subhash Sitaram Palve',       NULL, 'supervisor',     'Forge Shop',      'staff', 'en', NULL, NULL, NULL, 21780,  true),
('VFL1550', 'Swapnil Vitthal Kakade',      NULL, 'supervisor',     'Die Shop',        'staff', 'en', NULL, NULL, NULL, 20333,  true),
('VFL1568', 'Farhan Ahmad Shah',           NULL, 'supervisor',     'Heat Treatment',  'staff', 'en', NULL, NULL, NULL, 21000,  true),
('VFL4057', 'Devendrakumar Jagdish Singh', NULL, 'supervisor',     'Maintenance',     'staff', 'en', NULL, NULL, NULL, 25988,  true),
('VFL5074', 'Angad Rajabhau Kate',         NULL, 'supervisor',     'Forge Shop',      'staff', 'en', NULL, NULL, NULL, 23144,  true),
('VFL5079', 'Sudeep Singh',                NULL, 'supervisor',     'Forge Shop',      'staff', 'en', NULL, NULL, NULL, 27000,  true),
('VFL5444', 'Subhash Shivanand Thorat',    NULL, 'supervisor',     'Final Shop',      'staff', 'en', NULL, NULL, NULL, 20804,  true),

-- ── SECURITY GUARDS ───────────────────────────────────────────
('VFL1441', 'Jitendrasingh Nainsingh',     NULL, 'security_guard', 'Human Resource',  'staff', 'en', NULL, NULL, NULL, 21000,  true),
('VFL1465', 'Mahipal Singh',               NULL, 'security_guard', 'Human Resource',  'staff', 'en', NULL, NULL, NULL, 19550,  true),
('VFL1520', 'Shrawan Rewant Singh',        NULL, 'security_guard', 'Human Resource',  'staff', 'en', NULL, NULL, NULL, 16500,  true),
('VFL1527', 'Sharwan Singh Jodha',         NULL, 'security_guard', 'Human Resource',  'staff', 'en', NULL, NULL, NULL, 16500,  true),
('VFL5439', 'Bhanwar Singh Rathod',        NULL, 'security_guard', 'Human Resource',  'staff', 'en', NULL, NULL, NULL, 18025,  true),

-- ── MEMBERS ───────────────────────────────────────────────────
('VFL1319', 'Dipak Balkrishna Patil',      NULL, 'member',         'Accounts',        'staff', 'en', NULL, NULL, NULL, 30360,  true),
('VFL1389', 'Tushar Abasaheb Shirgire',    NULL, 'member',         'Purchase',        'staff', 'en', NULL, NULL, NULL, 26250,  true),
('VFL1391', 'Atul Bhata Patil',            NULL, 'member',         'Maintenance',     'staff', 'en', NULL, NULL, NULL, 24000,  true),
('VFL1446', 'Dharmendra Prabhu Mahto',     NULL, 'member',         'Maintenance',     'staff', 'en', NULL, NULL, NULL, 21000,  true),
('VFL1450', 'Kishan Suresh Giri',          NULL, 'member',         'Die Shop',        'staff', 'en', NULL, NULL, NULL, 15600,  true),
('VFL1453', 'Laxman Yadav',                NULL, 'member',         'Forge Shop',      'staff', 'en', NULL, NULL, NULL, 18795,  true),
('VFL1482', 'Brahmanand Kaduba Tajne',     NULL, 'member',         'Human Resource',  'staff', 'en', NULL, NULL, NULL, 18000,  true),
('VFL1543', 'Shaikh Mobin Shaikh Sultan',  NULL, 'member',         'Machine Shop',    'staff', 'en', NULL, NULL, NULL, 20000,  true),
('VFL1545', 'Shaikh Mujahed Shaikh Naeem', NULL, 'member',         'Design',          'staff', 'en', NULL, NULL, NULL, 26400,  true),
('VFL1549', 'Shaikh Wajid Shaikh Shabbir', NULL, 'member',         'Maintenance',     'staff', 'en', NULL, NULL, NULL, 24747,  true),
('VFL1556', 'Shyambabu Radheshyam Yadav',  NULL, 'member',         'Quality',         'staff', 'en', NULL, NULL, NULL, 17702,  true),
('VFL1557', 'Milind Ambadas Barhate',      NULL, 'member',         'Administration',  'staff', 'en', NULL, NULL, NULL, 27000,  true),
('VFL1562', 'Sachin Suresh Rathod',        NULL, 'member',         'Quality',         'staff', 'en', NULL, NULL, NULL, 22248,  true),
('VFL1564', 'Syed Inzamam Ali',            NULL, 'member',         'Design',          'staff', 'en', NULL, NULL, NULL, 18700,  true),
('VFL1567', 'Kajal Balkrishna Sutar',      NULL, 'member',         'Administration',  'staff', 'en', NULL, NULL, NULL, 21711,  true),
('VFL5083', 'Nivrutti Karbhari Jadhav',    NULL, 'member',         'Cutting Shop',    'staff', 'en', NULL, NULL, NULL, 14850,  true),
('VFL5203', 'Santosh Khandu Dabhade',      NULL, 'member',         'Machine Shop',    'staff', 'en', NULL, NULL, NULL, 17000,  true),
('VFL5237', 'Saroj Avdesh Singh',          NULL, 'member',         'Forge Shop',      'staff', 'en', NULL, NULL, NULL, 17884,  true),
('VFL5272', 'Ramesh Narayan Gote',         NULL, 'member',         'Machine Shop',    'staff', 'en', NULL, NULL, NULL, 17000,  true),
('VFL5273', 'Anna Pralhad Deshmukh',       NULL, 'member',         'Machine Shop',    'staff', 'en', NULL, NULL, NULL, 17000,  true),
('VFL5302', 'Nanasaheb Dinkar Shinde',     NULL, 'member',         'Machine Shop',    'staff', 'en', NULL, NULL, NULL, 27000,  true),
('VFL5303', 'Dilip Sanjay Ghegde',         NULL, 'member',         'Machine Shop',    'staff', 'en', NULL, NULL, NULL, 16911,  true),
('VFL5318', 'Gorakh Sitaram More',         NULL, 'member',         'Die Shop',        'staff', 'en', NULL, NULL, NULL, 17743,  true),
('VFL5321', 'Bhaiyyasaheb Sambhaji Patil', NULL, 'member',         'Machine Shop',    'staff', 'en', NULL, NULL, NULL, 16911,  true),
('VFL5322', 'Jakir Munshi Chaudhari',      NULL, 'member',         'Maintenance',     'staff', 'en', NULL, NULL, NULL, 16911,  true),
('VFL5323', 'Shaikh Abdul Gani',           NULL, 'member',         'Maintenance',     'staff', 'en', NULL, NULL, NULL, 26790,  true),
('VFL5324', 'Shivaji Suresh Jaypure',      NULL, 'member',         'Maintenance',     'staff', 'en', NULL, NULL, NULL, 22000,  true),
('VFL5337', 'Manoj Anantrao Wagh',         NULL, 'member',         'Maintenance',     'staff', 'en', NULL, NULL, NULL, 18480,  true),
('VFL5347', 'Rajdev Narpat Prasad',        NULL, 'member',         'Die Shop',        'staff', 'en', NULL, NULL, NULL, 19270,  true),
('VFL5354', 'Rahul Ashok Patil',           NULL, 'member',         'Machine Shop',    'staff', 'en', NULL, NULL, NULL, 16290,  true),
('VFL5379', 'Gaurav Deelip Kakde',         NULL, 'member',         'Sales & Logistics','staff','en', NULL, NULL, NULL, 19500,  true),
('VFL5382', 'Vitthal Uddhav Tekale',       NULL, 'member',         'Machine Shop',    'staff', 'en', NULL, NULL, NULL, 16290,  true),
('VFL5383', 'Vikas Lalchand Pere',         NULL, 'member',         'Machine Shop',    'staff', 'en', NULL, NULL, NULL, 16537,  true),
('VFL5397', 'Amol Rakhmaji Ambhore',       NULL, 'member',         'VMC Shop',        'staff', 'en', NULL, NULL, NULL, 17500,  true),
('VFL5398', 'Arun Dilip Gaikwad',          NULL, 'member',         'Stores',          'staff', 'en', NULL, NULL, NULL, 18000,  true),
('VFL5399', 'Chandan Milind Sonapasare',   NULL, 'member',         'Quality',         'staff', 'en', NULL, NULL, NULL, 15374,  true),
('VFL5400', 'Manbodh Sambhu Sah',          NULL, 'member',         'Press Shop',      'staff', 'en', NULL, NULL, NULL, 19221,  true),
('VFL5405', 'Sunil Ramakant Saha',         NULL, 'member',         'Maintenance',     'staff', 'en', NULL, NULL, NULL, 22786,  true),
('VFL5409', 'Dilip Pralhad Arak',          NULL, 'member',         'Die Shop',        'staff', 'en', NULL, NULL, NULL, 18211,  true),
('VFL5410', 'Raju Laxman Kasare',          NULL, 'member',         'Maintenance',     'staff', 'en', NULL, NULL, NULL, 19270,  true),
('VFL5413', 'Sachin Somnath Parmeshwar',   NULL, 'member',         'Die Shop',        'staff', 'en', NULL, NULL, NULL, 19270,  true),
('VFL5415', 'Payal Sudhir Surve',          NULL, 'member',         'Design',          'staff', 'en', NULL, NULL, NULL, 16253,  true),
('VFL5420', 'Rohit Kailas Mokase',         NULL, 'member',         'Quality',         'staff', 'en', NULL, NULL, NULL, 17553,  true),
('VFL5425', 'Dipak Kashinath Kharat',      NULL, 'member',         'Machine Shop',    'staff', 'en', NULL, NULL, NULL, 16290,  true),
('VFL5428', 'Saurabh Niwas Ghorpade',      NULL, 'member',         'Quality',         'staff', 'en', NULL, NULL, NULL, 14303,  true),
('VFL5429', 'Pooja Pravin Pawar',          NULL, 'member',         'Quality',         'staff', 'en', NULL, NULL, NULL, 13700,  true),
('VFL5430', 'Kisan Ashok Waghule',         NULL, 'member',         'VMC Shop',        'staff', 'en', NULL, NULL, NULL, 17500,  true),
('VFL5433', 'Aniket Kailas Taru',          NULL, 'member',         'Quality',         'staff', 'en', NULL, NULL, NULL, 17000,  true),
('VFL5434', 'Amit Bhagvan Shirsath',       NULL, 'member',         'Administration',  'staff', 'en', NULL, NULL, NULL, 17500,  true),
('VFL5440', 'Pallavi Vishnu Khade',        NULL, 'member',         'Human Resource',  'staff', 'en', NULL, NULL, NULL, 13500,  true),
('VFL5442', 'Darshan Anil Alhat',          NULL, 'member',         'Stores',          'staff', 'en', NULL, NULL, NULL, 15000,  true),
('VFL5445', 'Shreyash Rajaram Mhaske',     NULL, 'member',         'Administration',  'staff', 'en', NULL, NULL, NULL, 15386,  true),
('VFL5446', 'Mayuri Sardar Rathod',        NULL, 'member',         'Human Resource',  'staff', 'en', NULL, NULL, NULL, 19817,  true),
('VFL5447', 'Sarang Kishor Shinde',        NULL, 'member',         'Sales & Logistics','staff','en', NULL, NULL, NULL, 14303,  true),
('VFL5448', 'Vijay Rangnath Sonawane',     NULL, 'member',         'Maintenance',     'staff', 'en', NULL, NULL, NULL, 20262,  true),
('VFL5449', 'Siddiqui Mohd Zainul Abedin', NULL, 'member',         'Quality',         'staff', 'en', NULL, NULL, NULL, 16470,  true),
('VFL5450', 'Sayed Uzaif Ali',             NULL, 'member',         'VMC Shop',        'staff', 'en', NULL, NULL, NULL, 23861,  true),
('VFL5451', 'Ezaan Ahmed Khan',            NULL, 'member',         'Accounts',        'staff', 'en', NULL, NULL, NULL, 16470,  true)

ON CONFLICT (emp_code) DO NOTHING;

-- =============================================================
-- SUMMARY
-- Total records: 81 staff employees
-- Owner:         1
-- Managers:      6
-- Supervisors:   11
-- Security Guard:5
-- Members:       58
-- =============================================================
-- GAPS — action needed before pilot:
-- 1. phone numbers — add via UPDATE after worker sheet loaded
-- 2. supervisor_id / manager_id / plant_head_id — need reporting mapping from Yash
-- 3. Worker employees — separate sheet not yet uploaded
-- 4. VFL1001 salary = 0 (owner — correct, do not change)
-- 5. Pallavi Khade (VFL5440) mapped as 'member' — update to 'hr_admin' if she is the HR Admin
-- =============================================================
