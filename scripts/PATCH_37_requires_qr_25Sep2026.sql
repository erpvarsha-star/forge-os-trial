-- ============================================================================
-- PATCH_37 — requires_qr flag + 30-minute QR time buckets (25 Sep 2026)
--
-- Two changes:
--
-- 1. Add requires_qr boolean (default true) to employees.
--    Set false for:
--      VFL1001 Yash Munot (owner — no gate check-in required)
--      VFL1567 Kajal Balkrishna Sutar (Pune office — no gate security there)
--    Everyone else stays true.
--
-- 2. The QR formula changes from `plant_id-date-salt` (valid all day)
--    to `plant_id-date-timeBucket-salt` (valid for one 30-minute slot).
--    timeBucket = floor(IST minutes since midnight / 30), range 0-47.
--    This SQL patch covers only the schema change; the formula update is
--    in gate-qr.tsx, qr.tsx, and CheckInCard.tsx (all three changed in
--    the same commit).
--
-- Safe to re-run: ALTER TABLE IF NOT EXISTS, UPDATE is idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS requires_qr boolean NOT NULL DEFAULT true;

UPDATE employees SET requires_qr = false
WHERE emp_code IN ('VFL1001', 'VFL1567');

COMMIT;
