-- FRESH_INSTALL_25Oct2026.sql
-- Run this in Supabase SQL Editor on 25 Oct 2026 before distributing the new APK.
--
-- What it does:
--   1. Clears device_registrations — removes all device locks so every employee
--      can register their device fresh on first install.
--   2. Resets every active employee's PIN to their starting PIN and re-arms
--      must_change_pin = true, so each employee picks their own PIN on first
--      launch of the new build.
--
-- Starting PIN formula (same as PATCH_10):
--   VFL employees: lpad(digits, 6, '0')   — VFL1001 → 001001
--   CON employees: '20' || lpad(digits, 4, '0') — CON01 → 200001
--
-- After running this, share the download link via WhatsApp:
--   https://github.com/erpvarsha-star/forge-os-trial/releases/latest/download/app-release.apk
--
-- Every employee will:
--   1. Install the new APK
--   2. Log in with emp_code + starting PIN
--   3. Be forced to set their own PIN
--   4. Go through the one-time permissions screen (PATCH_40)
--   5. Use the app normally

BEGIN;

-- Step 1: clear all device locks
TRUNCATE device_registrations;

-- Step 2: reset must_change_pin for all active employees
UPDATE employees
SET must_change_pin = true
WHERE is_active = true;

-- Step 3: reset all auth user passwords to starting PINs
DO $$
DECLARE
  emp RECORD;
  emp_digits TEXT;
  starting_pin TEXT;
BEGIN
  FOR emp IN
    SELECT e.emp_code, e.auth_user_id
    FROM employees e
    WHERE e.is_active = true
      AND e.auth_user_id IS NOT NULL
  LOOP
    emp_digits := regexp_replace(emp.emp_code, '[^0-9]', '', 'g');

    IF emp.emp_code LIKE 'CON%' THEN
      -- Consultants: CON01 → 200001
      starting_pin := '20' || lpad(emp_digits, 4, '0');
    ELSE
      -- Regular employees: VFL1001 → 001001
      starting_pin := lpad(emp_digits, 6, '0');
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(starting_pin, gen_salt('bf')),
        updated_at = now()
    WHERE id = emp.auth_user_id;
  END LOOP;
END $$;

COMMIT;

-- Verify: should return 0 (all device locks cleared)
SELECT count(*) AS device_registrations_remaining FROM device_registrations;

-- Verify: should return total active employee count (all must_change_pin = true)
SELECT count(*) AS reset_count FROM employees WHERE is_active = true AND must_change_pin = true;
