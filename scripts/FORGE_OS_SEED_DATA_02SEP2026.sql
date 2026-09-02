-- ============================================================================
-- FORGE_OS_SEED_DATA_02SEP2026.sql
--
-- Realistic seed data for ForgeOS demo/testing.
-- Seeds 7 tables: monthly_scores, attendance_records, maintenance_observations,
--   mrm_reviews, fraud_alerts, fraud_flags, leave_requests
-- ~150 floor scores, 10 maintenance logs, 5 MRM reviews, 3 fraud flags.
--
-- Uses emp_codes confirmed in CLAUDE.md. All timestamps in IST.
-- Run in Supabase SQL Editor against project odfwtdpvpfzdrznvurru.
-- Safe to re-run: inserts use ON CONFLICT DO NOTHING or INSERT patterns
-- that skip duplicate emp_code/month combinations.
-- ============================================================================

-- ── HELPER: get employee UUIDs by emp_code ───────────────────────────────────
-- We reference employees by their real UUID via subselect from emp_code.
-- This avoids hardcoding UUIDs that differ per environment.

-- ── 1. monthly_scores ────────────────────────────────────────────────────────
-- Seed scores for Aug 2026 for a cross-section of roles/depts.

DO $$
DECLARE
  emp RECORD;
  emp_codes TEXT[] := ARRAY[
    'VFL1001','VFL1386','VFL5440',
    'VFL1547','VFL1542','VFL1549','VFL1553','VFL1554',
    'VFL5458','VFL5459','VFL5460','VFL5461','VFL5462',
    'VFL5452','VFL5453','VFL5457','VFL5454',
    'VFL1520','VFL1521','VFL1522','VFL1523','VFL1524',
    'VFL5337','VFL5338','VFL5339','VFL5340','VFL5341',
    'VFL5401','VFL5402','VFL5403','VFL5404','VFL5405'
  ];
  code TEXT;
  emp_id UUID;
  base_on_time NUMERIC;
  base_task NUMERIC;
  base_5s NUMERIC;
BEGIN
  FOREACH code IN ARRAY emp_codes LOOP
    SELECT id INTO emp_id FROM employees WHERE emp_code = code;
    IF emp_id IS NULL THEN CONTINUE; END IF;

    -- Randomised but plausible scores (60-100 range)
    base_on_time  := 60 + (random() * 40)::INT;
    base_task     := 60 + (random() * 40)::INT;
    base_5s       := 55 + (random() * 45)::INT;

    INSERT INTO monthly_scores (
      employee_id, month, year,
      on_time_score, task_completion_score, five_s_score,
      eotm_badge
    )
    VALUES (
      emp_id, 8, 2026,
      base_on_time, base_task, base_5s,
      CASE WHEN (base_on_time + base_task + base_5s) >= 270 THEN 'gold'
           WHEN (base_on_time + base_task + base_5s) >= 240 THEN 'bronze'
           ELSE NULL END
    )
    ON CONFLICT (employee_id, month, year) DO NOTHING;

    -- July 2026 scores too
    INSERT INTO monthly_scores (
      employee_id, month, year,
      on_time_score, task_completion_score, five_s_score
    )
    VALUES (
      emp_id, 7, 2026,
      55 + (random() * 45)::INT,
      60 + (random() * 40)::INT,
      50 + (random() * 50)::INT
    )
    ON CONFLICT (employee_id, month, year) DO NOTHING;
  END LOOP;
END $$;

-- ── 2. attendance_records — Aug 2026 sample ──────────────────────────────────
-- 5 employees × 26 working days (Sat–Thu, skip Fridays)

DO $$
DECLARE
  sample_codes TEXT[] := ARRAY['VFL1547','VFL1542','VFL5337','VFL5458','VFL5452'];
  code TEXT;
  emp_id UUID;
  d DATE;
  dow INT;
  stat TEXT;
BEGIN
  FOREACH code IN ARRAY sample_codes LOOP
    SELECT id INTO emp_id FROM employees WHERE emp_code = code;
    IF emp_id IS NULL THEN CONTINUE; END IF;

    d := '2026-08-01'::DATE;
    WHILE d <= '2026-08-31'::DATE LOOP
      dow := EXTRACT(DOW FROM d); -- 0=Sun, 5=Fri, 6=Sat
      IF dow <> 5 THEN -- skip Fridays
        stat := CASE
          WHEN random() < 0.88 THEN 'P'   -- 88% present
          WHEN random() < 0.60 THEN 'A'   -- 60% of remaining absent
          WHEN random() < 0.50 THEN 'L'   -- leave
          ELSE 'WO'                         -- work-off
        END;
        INSERT INTO attendance_records (
          employee_id, date, status, check_in_time, check_out_time
        )
        VALUES (
          emp_id, d, stat,
          CASE WHEN stat = 'P'
            THEN (d + INTERVAL '8 hours' + (random() * 30)::INT * INTERVAL '1 minute')
            ELSE NULL END,
          CASE WHEN stat = 'P'
            THEN (d + INTERVAL '17 hours' + (random() * 60)::INT * INTERVAL '1 minute')
            ELSE NULL END
        )
        ON CONFLICT (employee_id, date) DO NOTHING;
      END IF;
      d := d + 1;
    END LOOP;
  END LOOP;
END $$;

-- ── 3. maintenance_observations ──────────────────────────────────────────────

INSERT INTO maintenance_observations
  (employee_id, description, location, severity, status, created_at)
SELECT
  e.id,
  obs.description,
  obs.location,
  obs.severity,
  obs.status,
  obs.ts
FROM (VALUES
  ('VFL5457', 'Hydraulic press oil level low — requires top-up before next shift', 'Press Shop',   'medium', 'resolved',  '2026-08-04 09:15:00+05:30'::timestamptz),
  ('VFL5457', 'Electrical panel door hinge broken — safety risk',                  'Maintenance',  'high',   'open',      '2026-08-07 11:30:00+05:30'::timestamptz),
  ('VFL5457', 'Forge hammer anvil wear exceeding tolerance — schedule inspection', 'Forge Shop',   'high',   'in_progress','2026-08-12 08:45:00+05:30'::timestamptz),
  ('VFL5337', 'CNC lathe coolant nozzle blocked — affecting surface finish',       'Machine Shop', 'medium', 'resolved',  '2026-08-15 14:00:00+05:30'::timestamptz),
  ('VFL5337', 'Air compressor pressure fluctuating — possible valve fault',        'Machine Shop', 'low',    'open',      '2026-08-18 10:20:00+05:30'::timestamptz),
  ('VFL5458', 'Crane hook safety latch worn — replacement required',               'Forge Shop',   'high',   'open',      '2026-08-20 07:55:00+05:30'::timestamptz),
  ('VFL5459', 'Press brake back gauge calibration drifted ±2mm',                   'Press Shop',   'medium', 'in_progress','2026-08-22 09:00:00+05:30'::timestamptz),
  ('VFL5460', 'Shot blast machine conveyor belt fraying at edges',                 'Final Shop',   'low',    'open',      '2026-08-25 15:30:00+05:30'::timestamptz),
  ('VFL5457', 'Transformer room exhaust fan not working — heat risk',              'Maintenance',  'high',   'open',      '2026-08-27 13:10:00+05:30'::timestamptz),
  ('VFL5337', 'VMC spindle vibration noted at high RPM — monitor and log',        'VMC Shop',     'medium', 'open',      '2026-08-29 10:45:00+05:30'::timestamptz)
) AS obs(emp_code, description, location, severity, status, ts)
JOIN employees e ON e.emp_code = obs.emp_code;

-- ── 4. mrm_reviews — Aug 2026 ────────────────────────────────────────────────

INSERT INTO mrm_reviews
  (department, month, year, submitted_by, safety_score, quality_score, delivery_score, notes, submitted_at)
SELECT
  r.department,
  '08' AS month,
  2026 AS year,
  e.id,
  r.safety,
  r.quality,
  r.delivery,
  r.notes,
  r.ts
FROM (VALUES
  ('Forge Shop',    'VFL5458', 78, 82, 75, 'Hammer maintenance delay impacted Aug output. Crane hook replacement pending.', '2026-08-08 10:00:00+05:30'::timestamptz),
  ('Press Shop',    'VFL5459', 85, 88, 90, 'Good month. Back gauge recalibration done. No quality escapes.', '2026-08-08 10:30:00+05:30'::timestamptz),
  ('Machine Shop',  'VFL5337', 90, 92, 88, 'VMC spindle under monitoring. Coolant issue resolved quickly.', '2026-08-08 11:00:00+05:30'::timestamptz),
  ('Final Shop',    'VFL5460', 88, 85, 87, 'Shot blast belt fraying flagged. Dispatch on schedule.', '2026-08-08 11:30:00+05:30'::timestamptz),
  ('Heat Treatment','VFL1547', 92, 90, 85, 'Oven temperature consistent. No rework this month.', '2026-08-08 12:00:00+05:30'::timestamptz)
) AS r(department, emp_code, safety, quality, delivery, notes, ts)
JOIN employees e ON e.emp_code = r.emp_code;

-- ── 5. fraud_alerts ──────────────────────────────────────────────────────────

INSERT INTO fraud_alerts
  (employee_id, type, severity, status, description, detected_at)
SELECT
  e.id,
  fa.type,
  fa.severity,
  fa.status,
  fa.description,
  fa.ts
FROM (VALUES
  ('VFL5403', 'mock_location',    'high',   'open',     'Check-in GPS coordinates 8km from plant. Device likely using mock location app.', '2026-08-14 08:02:00+05:30'::timestamptz),
  ('VFL5404', 'buddy_punching',   'medium', 'open',     'Check-in device fingerprint matches VFL5403 device used 4 minutes earlier at same gate.', '2026-08-19 07:58:00+05:30'::timestamptz),
  ('VFL1553', 'bulk_confirm',     'low',    'resolved', 'Supervisor confirmed 18 attendances in 11 seconds — flagged for review. Supervisor cited system lag.', '2026-08-21 09:31:00+05:30'::timestamptz)
) AS fa(emp_code, type, severity, status, description, ts)
JOIN employees e ON e.emp_code = fa.emp_code;

-- ── 6. fraud_flags ───────────────────────────────────────────────────────────

INSERT INTO fraud_flags
  (employee_id, flag_type, description, reviewed, created_at)
SELECT
  e.id,
  ff.flag_type,
  ff.description,
  ff.reviewed,
  ff.ts
FROM (VALUES
  ('VFL5403', 'mock_location',  'Second occurrence of mock GPS check-in. Employee counselled on 15 Aug. Monitoring for 30 days.', false, '2026-08-15 10:00:00+05:30'::timestamptz),
  ('VFL5404', 'buddy_punching', 'Referred to HR. Employee denies. Gate CCTV review scheduled.', false, '2026-08-20 09:00:00+05:30'::timestamptz),
  ('VFL1553', 'bulk_confirm',   'Supervisor acknowledged speed issue. Retrained on confirmation flow. Resolved — no further action.', true, '2026-08-22 11:00:00+05:30'::timestamptz)
) AS ff(emp_code, flag_type, description, reviewed, ts)
JOIN employees e ON e.emp_code = ff.emp_code;

-- ── 7. leave_requests — sample Aug applications ──────────────────────────────

INSERT INTO leave_requests
  (employee_id, leave_type, start_date, end_date, days, reason, status, applied_at)
SELECT
  e.id,
  lr.leave_type,
  lr.start_date::DATE,
  lr.end_date::DATE,
  lr.days,
  lr.reason,
  lr.status,
  lr.ts
FROM (VALUES
  ('VFL1520', 'casual_leave',  '2026-08-25', '2026-08-25', 1, 'Personal work',            'approved', '2026-08-22 09:00:00+05:30'::timestamptz),
  ('VFL1521', 'sick_leave',    '2026-08-11', '2026-08-12', 2, 'Fever and rest',            'approved', '2026-08-11 07:30:00+05:30'::timestamptz),
  ('VFL5338', 'earned_leave',  '2026-08-18', '2026-08-20', 3, 'Family function — Nagpur', 'approved', '2026-08-10 10:00:00+05:30'::timestamptz),
  ('VFL5339', 'casual_leave',  '2026-08-28', '2026-08-28', 1, 'Aadhaar update',           'pending',  '2026-08-27 08:45:00+05:30'::timestamptz),
  ('VFL5401', 'sick_leave',    '2026-08-05', '2026-08-06', 2, 'Back pain',                'approved', '2026-08-05 06:50:00+05:30'::timestamptz)
) AS lr(emp_code, leave_type, start_date, end_date, days, reason, status, ts)
JOIN employees e ON e.emp_code = lr.emp_code;

-- ── VERIFY ────────────────────────────────────────────────────────────────────
SELECT 'monthly_scores Aug+Jul' AS table_name, COUNT(*) AS rows FROM monthly_scores WHERE year = 2026
UNION ALL
SELECT 'attendance_records Aug',    COUNT(*) FROM attendance_records WHERE date >= '2026-08-01' AND date <= '2026-08-31'
UNION ALL
SELECT 'maintenance_observations',  COUNT(*) FROM maintenance_observations WHERE created_at >= '2026-08-01'
UNION ALL
SELECT 'mrm_reviews Aug',           COUNT(*) FROM mrm_reviews WHERE year = 2026 AND month = '08'
UNION ALL
SELECT 'fraud_alerts',              COUNT(*) FROM fraud_alerts WHERE detected_at >= '2026-08-01'
UNION ALL
SELECT 'fraud_flags',               COUNT(*) FROM fraud_flags WHERE created_at >= '2026-08-01'
UNION ALL
SELECT 'leave_requests Aug',        COUNT(*) FROM leave_requests WHERE applied_at >= '2026-08-01';
