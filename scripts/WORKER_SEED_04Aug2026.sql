-- =============================================================
-- FORGE OS — EMPLOYEE SEED (WORKERS)
-- Generated: 04 August 2026
-- Source: VFPL Worker Salary Sheet v1 (Google Drive)
-- Schema: public.employees (current Supabase live schema)
-- Notes:
--   phone = NULL (not in salary sheet)
--   supervisor_id / manager_id / plant_head_id = NULL (hierarchy pending)
--   salary = FIXED Gross PM from Worker Master Data tab
--   category = 'worker' for all records
--   language_preference = 'hi' (Hindi — schema constraint only allows en/hi;
--     Marathi UI support to be added in a future release)
--   is_active = false for Non-Active workers (preserved in DB)
-- =============================================================

INSERT INTO public.employees
  (emp_code, name, phone, role, department, category, language_preference,
   supervisor_id, manager_id, plant_head_id, salary, is_active)
VALUES

('VFL4002', 'Kailash Shantwan Dhiwar', NULL, 'member', 'Cutting Shop', 'worker', 'hi', NULL, NULL, NULL, 40118, true),
('VFL4004', 'Digambar Mahadeo Todekar', NULL, 'member', 'Die Shop', 'worker', 'hi', NULL, NULL, NULL, 40118, true),
('VFL4006', 'Dilip Pandurang Dhalpe', NULL, 'member', 'Maintenance', 'worker', 'hi', NULL, NULL, NULL, 40122, false),
('VFL4007', 'Hanumant Shantmallappa Shigarkanti', NULL, 'member', 'Die Shop', 'worker', 'hi', NULL, NULL, NULL, 40138, true),
('VFL4008', 'Dnyaneshwar Nivrutti Harishchandre', NULL, 'member', 'Die Shop', 'worker', 'hi', NULL, NULL, NULL, 40102, true),
('VFL4011', 'Banwari Harihar Yadav', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 40268, true),
('VFL4012', 'Kailas Ramdas Darandale', NULL, 'member', 'Maintenance', 'worker', 'hi', NULL, NULL, NULL, 40102, true),
('VFL4014', 'Sitaram Ramkrishna Gadekar', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 39920, false),
('VFL4015', 'Bapusaheb Trimbak Gawate', NULL, 'member', 'Die Shop', 'worker', 'hi', NULL, NULL, NULL, 39806, false),
('VFL4016', 'Balasaheb Sahebrao Yeole', NULL, 'member', 'Maintenance', 'worker', 'hi', NULL, NULL, NULL, 39787, false),
('VFL4018', 'Kailas Moti Chavan', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 39909, false),
('VFL4020', 'Shravan Vindhyachal Prasad', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 39911, false),
('VFL4021', 'Sopan Bhausaheb Dhasal', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 39911, false),
('VFL4023', 'Annasaheb Ratanrao Pathare', NULL, 'member', 'Maintenance', 'worker', 'hi', NULL, NULL, NULL, 38913, false),
('VFL4024', 'Ramesh Sitaram Sharma', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 40246, true),
('VFL4025', 'Raghav Harihar Yadav', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 40261, true),
('VFL4026', 'Parbhansh Tameshwar Yadav', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 40256, true),
('VFL4028', 'Kacharu Hariba Karhale', NULL, 'member', 'Final Shop', 'worker', 'hi', NULL, NULL, NULL, 38894, false),
('VFL4029', 'Ashok Danial Borde', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 39911, false),
('VFL4030', 'Suresh Sopan Gawali', NULL, 'member', 'Final Shop', 'worker', 'hi', NULL, NULL, NULL, 40116, true),
('VFL4032', 'Vitthal Kondiba Kanade', NULL, 'member', 'Die Shop', 'worker', 'hi', NULL, NULL, NULL, 40112, true),
('VFL4033', 'Bireshkumar Jagdish Singh', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 40256, true),
('VFL4036', 'Bhagwan Revji Walunj', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 40252, true),
('VFL4038', 'Radheshyam Rambaran Yadav', NULL, 'member', 'Final Shop', 'worker', 'hi', NULL, NULL, NULL, 39911, false),
('VFL4040', 'Baban Shivaji Nale', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 39921, false),
('VFL4041', 'Sharad Kisan Dargude', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 40106, true),
('VFL4042', 'Rajkumar Vyankatrao Amge', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 39813, true),
('VFL4043', 'Uttam Kacharu Bhadgal', NULL, 'member', 'Cutting Shop', 'worker', 'hi', NULL, NULL, NULL, 39623, true),
('VFL4045', 'Madhav Laxman Bhande', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 39612, true),
('VFL4048', 'Babasaheb Dagadu Randive', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 39556, true),
('VFL4061', 'Harichandra Vinayakrao Mate', NULL, 'member', 'Maintenance', 'worker', 'hi', NULL, NULL, NULL, 38962, false),
('VFL4063', 'Shivaji Hanumantrao Dangat', NULL, 'member', 'Final Shop', 'worker', 'hi', NULL, NULL, NULL, 38647, true),
('VFL4064', 'Yaduba Punjaram Pathade', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 36566, false),
('VFL4065', 'Ramrao Shrawan Bansode', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 38797, true),
('VFL4066', 'Nitin Rajendra Boralkar', NULL, 'member', 'Heat Treatment', 'worker', 'hi', NULL, NULL, NULL, 38797, true),
('VFL4068', 'Subhash Ramji Rathod', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 38797, true),
('VFL4071', 'Baburao Sambhaji Bakwad', NULL, 'member', 'Heat Treatment', 'worker', 'hi', NULL, NULL, NULL, 38797, true),
('VFL4072', 'Gundappa Mahadeo Nadde', NULL, 'member', 'Heat Treatment', 'worker', 'hi', NULL, NULL, NULL, 38797, true),
('VFL4075', 'Dattatray Madhavrao Nale', NULL, 'member', 'Forge Shop', 'worker', 'hi', NULL, NULL, NULL, 38797, false)

ON CONFLICT (emp_code) DO NOTHING;


-- =============================================================
-- SUMMARY
-- Total worker records: 39
-- Active: 24  |  Non-Active (archived): 15
-- Members: 39  |  Security Guards: 0
-- Salary source: 'Gross Salary' column from Worker Master Data tab
-- Gross PM range: 36,566 – 40,268
--
-- CHANGES FROM UPLOADED FILE:
-- language_preference changed from 'mr' to 'hi' — schema constraint only
-- allows 'en' or 'hi'. Marathi UI support is a future release item.
--
-- GAPS / FLAGS:
-- 1. VFL4057 (Devendrakumar Jagdish Singh) — in EMPLOYEE_SEED_03Aug2026.sql
--    as supervisor/Maintenance/salary=25988.
-- 2. VFL4064 (Yaduba Punjaram Pathade) — Gross=36,566 (lower than peers)
--    Basic=13,912 vs standard 15,756. Possible wage anomaly or partial month.
--    Verify with Accounts before confirming.
-- 3. phone numbers — not in Worker Salary Sheet; add via UPDATE after collection.
-- 4. supervisor_id / manager_id / plant_head_id — need hierarchy map from Yash.
-- =============================================================
