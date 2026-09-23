-- PATCH_26: Seed payroll_records for Aug 2026 — active staff (VFL1xxx/VFL5xxx) + VFL4057.
-- Source: "VFL Employee Salary Slip Generator 2026" (Drive ID: 1cmzh1CL2uuBDJ2gT0gObDU1jZ9OJwDFSiPFkDA79XsE,
--   modified 23 Sep 2026). 35 TRUE/active rows + VFL4057 = 36 employees seeded.
-- VFL1001 (owner): payable=0, excluded. Staff not in this sheet: payslip shows blank — HR to update.
-- special_allowance = Education+Medical+Professional Development+Communication+Uniform+Washing (actual).
-- overtime = OT Amount column (already in net_pay; stored separately for display).
-- advance_recovery = Salary Advance column.
-- VFL4xxx workers (VFL4008–VFL4072, 19 employees) are in PATCH_25 — not repeated here.
-- Safe to re-run: INSERT ... ON CONFLICT (employee_id, month, year) DO NOTHING.

BEGIN;

INSERT INTO payroll_records
  (employee_id, month, year, basic, hra, conveyance, special_allowance, overtime,
   pf, esic, pt, advance_recovery, tds, net_pay)
VALUES
  -- VFL1xxx staff --
  ((SELECT id FROM employees WHERE emp_code = 'VFL1064'), '08', 2026, 12600, 7560, 1890,  9450,  0,     1800, 0,   200, 0,    0,     28400),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1066'), '08', 2026,  9680, 5808, 1452,  7260,  9407,  1684, 0,   200, 0,    0,     24704),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1272'), '08', 2026, 10866, 6520, 1630,  8150,  701,   1800, 0,   200, 0,    0,     25867),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1290'), '08', 2026,  8684, 5211, 1303,  6513,  7143,  1511, 0,   200, 0,    0,     26038),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1327'), '08', 2026,  8684, 5211, 1303,  6513,  8054,  1511, 0,   200, 0,    0,     27054),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1386'), '08', 2026, 59482,35689, 8922, 44611,  0,     1800, 0,   200, 0,    10000, 136706),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1389'), '08', 2026, 10500, 6300, 1575,  7876,  0,     1800, 0,   200, 5000, 0,     19250),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1391'), '08', 2026, 11200, 6720, 1680,  8400,  12600, 1800, 0,   200, 0,    0,     42600),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1446'), '08', 2026,  7400, 4440, 1110,  5550,  5067,  1288, 0,   200, 0,    0,     22081),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1450'), '08', 2026,  7888, 4733, 1183,  5916,  6107,  1372, 148, 200, 0,    0,     24106),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1453'), '08', 2026,  7518, 4511, 1128,  5640,  6912,  1308, 141, 200, 0,    0,     23997),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1463'), '08', 2026, 23100,13860, 3465, 17326,  0,     1800, 0,   200, 0,    0,     35750),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1482'), '08', 2026,  7200, 4320, 1080,  5400,  2787,  1253, 135, 200, 3000, 0,     16199),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1516'), '08', 2026,  8712, 5227, 1307,  6534,  6429,  1516, 0,   200, 0,    0,     24943),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1520'), '08', 2026,  5870, 3522,  881,  4404,  8071,  1022, 110, 200, 4000, 0,     17415),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1527'), '08', 2026,  7582, 4549, 1137,  5686,  3669,  1319, 142, 200, 0,    0,     20964),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1528'), '08', 2026, 22116,13270, 3317, 16587,  0,     1800, 0,   200, 5000, 0,     46990),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1543'), '08', 2026,  7938, 4763, 1191,  5954,  588,   1381, 0,   200, 0,    0,     18853),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1545'), '08', 2026, 12000, 7200, 1800,  9000,  0,     1800, 0,   200, 0,    0,     28000),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1549'), '08', 2026,  8143, 4886, 1221,  6106,  958,   1417, 0,   200, 0,    0,     19598),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1556'), '08', 2026,  7081, 4248, 1062,  5310,  1713,  1232, 133, 200, 0,    0,     17000),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1557'), '08', 2026, 10800, 6480, 1620,  8100,  0,     1800, 0,   200, 0,    0,     23920),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1560'), '08', 2026, 24800,14880, 3720, 18600,  0,     1800, 0,   200, 0,    0,     59000),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1562'), '08', 2026,  8899, 5340, 1335,  6674,  1364,  1548, 0,   200, 0,    0,     21863),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1564'), '08', 2026,  8684, 5211, 1303,  6513,  0,     1511, 0,   200, 0,    0,     20000),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1566'), '08', 2026, 16416, 9850, 2462, 12312,  0,     1800, 0,   200, 0,    0,     38865),
  ((SELECT id FROM employees WHERE emp_code = 'VFL1567'), '08', 2026,  8684, 5211, 1303,  6513,  0,     1511, 0,   0,   8000, 0,     16200),
  -- VFL5xxx staff --
  ((SELECT id FROM employees WHERE emp_code = 'VFL5079'), '08', 2026, 10800, 6480, 1620,  8100,  0,     1800, 0,   200, 5000, 0,     18050),
  ((SELECT id FROM employees WHERE emp_code = 'VFL5237'), '08', 2026,  7154, 4292, 1073,  5366,  6000,  1245, 134, 200, 0,    0,     21870),
  ((SELECT id FROM employees WHERE emp_code = 'VFL5272'), '08', 2026,  6361, 3817,  954,  4770,  3839,  1107, 119, 200, 0,    0,     17811),
  ((SELECT id FROM employees WHERE emp_code = 'VFL5273'), '08', 2026,  6800, 4080, 1020,  5100,  5539,  1183, 128, 200, 0,    0,     21028),
  ((SELECT id FROM employees WHERE emp_code = 'VFL5302'), '08', 2026, 10800, 6480, 1620,  8100,  9058,  1800, 0,   200, 0,    0,     32778),
  ((SELECT id FROM employees WHERE emp_code = 'VFL5303'), '08', 2026,  7672, 4603, 1151,  5754,  1114,  1335, 144, 200, 0,    0,     18614),
  ((SELECT id FROM employees WHERE emp_code = 'VFL5318'), '08', 2026,  8105, 4863, 1216,  6079,  7223,  1410, 152, 200, 0,    0,     25142),
  ((SELECT id FROM employees WHERE emp_code = 'VFL5321'), '08', 2026,  6764, 4059, 1015,  5073,  5155,  1177, 127, 200, 0,    0,     20562),
  -- VFL4057 (worker appearing in staff salary sheet) --
  ((SELECT id FROM employees WHERE emp_code = 'VFL4057'), '08', 2026, 10060, 6036, 1509,  7544,  0,     1750, 0,   200, 0,    0,     17261)
ON CONFLICT (employee_id, month, year) DO NOTHING;

-- Verify
SELECT COUNT(*) AS seeded_records FROM payroll_records WHERE year = 2026 AND month = '08';
SELECT e.emp_code, e.name, pr.net_pay
FROM payroll_records pr JOIN employees e ON e.id = pr.employee_id
WHERE pr.year = 2026 AND pr.month = '08'
ORDER BY e.emp_code;

COMMIT;
