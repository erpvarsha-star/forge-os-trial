-- ============================================================================
-- PATCH_16 — set the QR check-in secret, without anybody ever seeing it
-- 13 Aug 2026
--
-- ⚠ CORRECTED 13 Aug. The salt was never empty — it holds the literal string
-- 'CHANGE_ME_ROTATE_IN_PRODUCTION', seeded by FINAL_SCHEMA line 141 and
-- therefore committed in this repository. That is worse than empty: the
-- "secret" behind QR check-in has been a publicly readable constant since
-- 4 Aug. PATCH_06 left the replacement commented out and it never ran.
--
-- The first version of this patch only replaced '', null and 'REPLACE_ME', so
-- it matched nothing and silently left the placeholder in place (verify
-- returned is_set=false, length=30 — the length of that string).
--
-- This patch generates the salt INSIDE Postgres with pgcrypto. That is the
-- whole point: the value is never typed, never pasted, never sent through
-- chat, and never lands in a file anybody could commit. Nobody — including
-- me — ever learns it. It exists only in the row.
--
-- ⚠ IDEMPOTENT IN THE IMPORTANT DIRECTION. A real salt already in place is
-- left alone, so re-running this file never invalidates QR codes in use.
-- Deliberate rotation is at the bottom of this file.
--
-- ⚠ SETTING A REAL SALT DOES NOT, BY ITSELF, SECURE QR CHECK-IN. See
-- app/(worker)/qr.tsx: the scanned value is accepted if it equals the expected
-- string OR merely CONTAINS the plant code ('VFL-AKT', which is in this repo
-- and in CLAUDE.md). That second branch ignores the salt entirely, so any QR
-- containing that text is accepted from anywhere inside the geofence. The
-- salt is worth fixing regardless, but the bypass is the real hole and it is
-- an app change, not a SQL one — it is not fixed here because removing it
-- without first providing a way to display the daily QR would stop 129 people
-- checking in at the gate.
--
-- ⚠ RUN IN THE SUPABASE SQL EDITOR.
-- ============================================================================

begin;

-- Supabase ships pgcrypto; this is here so the patch is self-contained if it
-- is ever run against a fresh project.
create extension if not exists pgcrypto with schema extensions;

-- 48 hex characters = 24 random bytes. Same strength as the
-- `secrets.token_hex(24)` that PATCH_06 asked for by hand.
insert into public.plant_config (config_key, config_value, description)
values (
  'qr_secret_salt',
  to_jsonb(encode(extensions.gen_random_bytes(24), 'hex')),
  'HMAC salt for QR check-in codes. Generated in-database; never transmitted.'
)
on conflict (config_key) do update
  set config_value = to_jsonb(encode(extensions.gen_random_bytes(24), 'hex')),
      updated_at   = now()
  -- Replace anything that is not already a generated salt, rather than
  -- listing placeholders and hoping the list is complete — which is exactly
  -- how the first attempt missed 'CHANGE_ME_ROTATE_IN_PRODUCTION'. A real
  -- salt from this patch is always 48 lowercase hex characters, so any value
  -- failing that test cannot be one of ours and is safe to overwrite.
  where plant_config.config_value is null
     or (plant_config.config_value #>> '{}') is null
     or (plant_config.config_value #>> '{}') !~ '^[0-9a-f]{48}$';

commit;

-- ============================================================================
-- Verify — confirms a salt exists and how long it is, WITHOUT printing it.
-- Expect: is_set = true, length = 48.
-- ============================================================================
select
  config_key,
  (config_value #>> '{}') is not null
    and length(config_value #>> '{}') = 48 as is_set,
  length(config_value #>> '{}')             as length,
  updated_at
from public.plant_config
where config_key = 'qr_secret_salt';

-- ============================================================================
-- TO ROTATE ON PURPOSE (invalidates every printed QR code — reprint them all):
--
--   update public.plant_config
--      set config_value = to_jsonb(encode(extensions.gen_random_bytes(24), 'hex')),
--          updated_at   = now()
--    where config_key = 'qr_secret_salt';
-- ============================================================================
