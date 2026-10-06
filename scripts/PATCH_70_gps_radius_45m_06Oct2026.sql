-- PATCH_70_gps_radius_45m_06Oct2026.sql
-- Raises plant_locations.radius_meters from 25m to 45m on all 12 real
-- campus points, per Yash's request 6 Oct 2026. Pune Office (200m) is
-- untouched -- not part of the 12-point Aurangabad campus seed, already a
-- deliberate different radius for a different reason (VFL5439 stationed
-- there). This is the third radius change on this table: 15m (PATCH_?
-- 27 Sep) was too tight, 25m (PATCH_57, 28 Sep) still drew complaints,
-- 45m is the latest ask.

update plant_locations
set radius_meters = 45
where name != 'Pune Office' and is_active = true;

-- VERIFICATION:
-- select name, radius_meters from plant_locations order by name;
