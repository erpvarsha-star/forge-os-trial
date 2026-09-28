-- PATCH_57: Raise plant_locations geofence radius from 15m to 25m
-- 28 Sep 2026
--
-- Context: 15m (Yash's original call, 27 Sep 2026) was too tight in practice
-- — employees reported being unable to check in ("15m is making it difficult
-- for people to sign in"). Typical phone GPS accuracy is +/-5-20m outdoors and
-- degrades further inside a steel-frame shop building, so 15m rejected
-- legitimate check-ins. Yash's call: 25m.
--
-- Applies to all 12 real campus points seeded by PATCH_22. Deliberately
-- excludes "Pune Office" (200m), which is not part of that documented seed.

UPDATE plant_locations
SET radius_meters = 25
WHERE name <> 'Pune Office';
