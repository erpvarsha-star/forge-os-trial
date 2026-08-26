-- ============================================================================
-- PATCH_22_plant_locations_seed_13Aug2026.sql
--
-- Seeds plant_locations (created by PATCH_21, run that one first) with the
-- 12 campus points Yash surveyed and sent as a CSV with coordinates already
-- resolved (this sandbox cannot reach any Google Maps domain to resolve the
-- links itself — see PENDING.md). "Store" is a 12th point that wasn't in
-- the original 11-location sheet but was included in the coordinates file,
-- so it's seeded too.
--
-- Sanity-checked before writing this (not just pasted blind): every point
-- is within 131m of "Plant location" (Machine shop is the farthest, at
-- 131.3m — which means it sat just OUTSIDE the old single-point 100m
-- geofence, a real, concrete case this multi-point upgrade fixes). One
-- oddity worth knowing about: "Cutting shop" and "Final Shop" were sent
-- with IDENTICAL coordinates (19.836111, 75.236750) — seeded as given since
-- it doesn't break anything (both still independently widen the "any
-- match" set to the same physical spot), but flagging it in case that's a
-- copy-paste slip in the source sheet rather than a real coincidence — see
-- PENDING.md.
--
-- Radius: 100m per point, matching the existing plant_config default —
-- deliberately not tightened per-shop, since the design intent (13 Aug
-- decision) is broad "any of these counts" coverage, not per-shop access
-- control.
-- ============================================================================

insert into plant_locations (name, latitude, longitude, radius_meters) values
  ('Plant location',   19.836056, 75.236222, 100),
  ('Office 1st Floor', 19.835928, 75.236184, 100),
  ('Machine shop',     19.835944, 75.237472, 100),
  ('Die shop',         19.836139, 75.236611, 100),
  ('VMC shop',         19.836167, 75.236472, 100),
  ('Press Shop',       19.836222, 75.236444, 100),
  ('HT shop',          19.836139, 75.236556, 100),
  ('Forge shop',       19.836306, 75.236500, 100),
  ('Cutting shop',     19.836111, 75.236750, 100),
  ('Final Shop',       19.836111, 75.236750, 100),
  ('Raw Material',     19.836083, 75.236833, 100),
  ('Store',            19.836109, 75.236702, 100)
on conflict (name) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  radius_meters = excluded.radius_meters;

-- ---------------------------------------------------------------------------
-- Verify — expect 12 rows, all is_active
-- ---------------------------------------------------------------------------
select name, latitude, longitude, radius_meters, is_active from plant_locations order by name;
