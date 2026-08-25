-- ============================================================================
-- PATCH_22_plant_locations_seed_PENDING_COORDINATES.sql
--
-- DO NOT RUN YET. Every latitude/longitude below is a placeholder (0, 0) —
-- deliberately invalid so this can never be run by accident and silently
-- geofence-block the entire plant at Null Island. Replace each TODO pair
-- with the real coordinates from
-- https://docs.google.com/spreadsheets/d/1900lODxTxhKV-oFccKpgcs_MgXD2zx3qCNFEki15iTk
-- (open each Google Maps link, long-press/tap the pin, read the decimal
-- coordinates shown) and only then run this in the Supabase SQL Editor.
--
-- Radius defaults to 100m (matching plant_config.geofence_radius_meters)
-- for every row except "Plant location", which is the whole-campus point —
-- bump that one if it's meant to be a looser catch-all. Adjust per-row if
-- any shop needs a tighter or looser radius.
-- ============================================================================

insert into plant_locations (name, latitude, longitude, radius_meters) values
  ('Plant location',   0 /* TODO lat */, 0 /* TODO lng */, 150),
  ('Office 1st Floor', 0 /* TODO lat */, 0 /* TODO lng */, 100),
  ('Machine shop',     0 /* TODO lat */, 0 /* TODO lng */, 100),
  ('Die shop',         0 /* TODO lat */, 0 /* TODO lng */, 100),
  ('VMC shop',         0 /* TODO lat */, 0 /* TODO lng */, 100),
  ('Press Shop',       0 /* TODO lat */, 0 /* TODO lng */, 100),
  ('HT shop',          0 /* TODO lat */, 0 /* TODO lng */, 100),
  ('Forge shop',       0 /* TODO lat */, 0 /* TODO lng */, 100),
  ('Cutting shop',     0 /* TODO lat */, 0 /* TODO lng */, 100),
  ('Final Shop',       0 /* TODO lat */, 0 /* TODO lng */, 100),
  ('Raw Material',     0 /* TODO lat */, 0 /* TODO lng */, 100)
on conflict (name) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  radius_meters = excluded.radius_meters;

select 'plant_locations seeded' as status, count(*) as row_count from plant_locations;
