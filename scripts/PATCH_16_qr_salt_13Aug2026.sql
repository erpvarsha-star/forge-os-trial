-- ============================================================================
-- PATCH_16 — set the QR check-in secret, without anybody ever seeing it
-- 13 Aug 2026
--
-- plant_config.qr_secret_salt has been empty since the schema was created.
-- PATCH_06 left it as a commented-out UPDATE with an instruction to generate a
-- value locally and paste it in — which never happened, so QR check-in has had
-- no secret behind it.
--
-- This patch generates the salt INSIDE Postgres with pgcrypto. That is the
-- whole point: the value is never typed, never pasted, never sent through
-- chat, and never lands in a file anybody could commit. Nobody — including
-- me — ever learns it. It exists only in the row.
--
-- ⚠ IDEMPOTENT IN THE IMPORTANT DIRECTION. If a salt is already set, this
-- leaves it alone. Rotating the salt invalidates every QR code already printed
-- and posted at the gate, so that has to be a deliberate act, not something a
-- re-run does by accident. To rotate on purpose, see the bottom of this file.
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
  -- Only fills a missing or blank salt. An existing one is left untouched,
  -- because replacing it silently breaks every QR code already in use.
  where plant_config.config_value is null
     or plant_config.config_value::text in ('""', 'null', '"REPLACE_ME"');

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
