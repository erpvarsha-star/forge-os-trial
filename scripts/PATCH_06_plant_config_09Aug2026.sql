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
