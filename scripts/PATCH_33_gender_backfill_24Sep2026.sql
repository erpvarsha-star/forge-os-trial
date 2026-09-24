-- PATCH_33: Backfill employees.gender (added empty in PATCH_28, needed for
-- PT slab lookup — pt_slabs is gender-differentiated).
--
-- Yash confirmed directly (24 Sep 2026) the complete list of female
-- employees company-wide: Mayuri Sardar Rathod, Pallavi Vishnu Khade,
-- Kajal Sutar, Nidhi Kumari. Everyone else is male.
--
-- Matched against the live employees table:
--   - Kajal Balkrishna Sutar   (VFL1567) -> female
--   - Mayuri Sardar Rathod     (VFL5446) -> female
--   - Pallavi Vishnu Khade     (VFL5440) -> female
--   - Nidhi Kumari — NOT FOUND. Matches the known open item from PATCH_29's
--     seeding (PENDING.md): she's a real-looking hire in the calc sheet's
--     Master Data with no `employees` row in Forge OS at all yet. Nothing
--     to update here until she's actually onboarded with a real emp_code.
--
-- All other 126 employees set to 'male'.

BEGIN;

update employees set gender = 'female'
where emp_code in ('VFL1567', 'VFL5446', 'VFL5440');

update employees set gender = 'male'
where gender is null;

COMMIT;
