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
