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
  ('VFL5463', '+917875491749'),  -- Manoj Anantrao Wagh

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
