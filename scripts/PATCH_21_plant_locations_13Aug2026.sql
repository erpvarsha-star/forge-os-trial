-- ============================================================================
-- PATCH_21_plant_locations_13Aug2026.sql
--
-- Adds multi-point geofencing. Yash shared a sheet of 11 named locations
-- across the campus (Plant location, Office 1st Floor, Machine shop, Die
-- shop, VMC shop, Press Shop, HT shop, Forge shop, Cutting shop, Final Shop,
-- Raw Material) as Google Maps links. Decision (13 Aug): "multi-point, any
-- match" — a check-in succeeds if the employee is within radius of ANY of
-- these points, not tied to their own department. The single campus is
-- large enough that one center point + 100m (plant_config) was missing
-- far-flung shops like the Raw Material yard.
--
-- This patch only creates the TABLE — it seeds ZERO rows. The Google Maps
-- links resolve to real GPS coordinates, and this sandbox's network egress
-- proxy blocks every Google Maps domain (maps.app.goo.gl, google.com/maps),
-- so those coordinates could not be read here — writing guessed lat/lng
-- values into a table that gates physical plant access would be worse than
-- leaving it empty. The app and fraud-detector both already fall back
-- automatically to the existing single-point plant_config geofence when
-- this table is empty, so running this patch now is safe and changes
-- nothing about current behaviour. Once real coordinates are provided,
-- PATCH_22 will insert the 11 rows and check-in switches over automatically
-- — no further app code changes needed.
-- ============================================================================

create table if not exists plant_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create index if not exists idx_plant_locations_active on plant_locations(is_active);

alter table plant_locations enable row level security;

-- Readable by any signed-in employee, same as plant_config — the app needs
-- this list client-side to run the geofence check before it even attempts
-- check-in.
drop policy if exists "plant_locations_select" on plant_locations;
create policy "plant_locations_select" on plant_locations for select using (auth.uid() is not null);

-- Only management can add/edit/remove locations — same rationale as every
-- other config-shaped table in this schema (plant_config has no client
-- write path at all; this is more permissive only because a shop can
-- reasonably be added between SQL sessions without redeploying).
drop policy if exists "plant_locations_write_management" on plant_locations;
create policy "plant_locations_write_management" on plant_locations for all
  using (is_management())
  with check (is_management());

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select 'plant_locations table created, 0 rows (expected — see header comment)' as status,
       count(*) as row_count
from plant_locations;
