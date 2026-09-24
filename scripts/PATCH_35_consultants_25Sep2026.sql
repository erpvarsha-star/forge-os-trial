-- ============================================================================
-- PATCH_35 — Consultant logins (25 Sep 2026)
--
-- 23 consultants exist (CON01–CON23). This patch adds the 9 confirmed-active
-- ones whose identity is unambiguous:
--   CON01 Chhagan D Dehade          Die Shop
--   CON05 Madhukar Shamgir Gosavi   Design
--   CON09 Nagnath Damu Kale         Die Shop
--   CON12 Sadashiv Nitalaksha Soddy Quality
--   CON13 Sanjeev Pandurang Supsande (no department on file)
--   CON16 Sarwan Bindhyanchal Prasad Forge Shop
--   CON18 Bapusaheb Trimbak Gawate  Die Shop
--   CON20 Prabhuling Ramchandra Achaleri Die Shop
--   CON21 Balasaheb Sahebrao Yeole  Maintenance
--
-- Three Active consultants deliberately excluded pending Yash's confirmation:
--   CON19 Chhaya Shelke  — Bunglow Maid (Administration). Likely does not
--          need factory GPS check-in. Confirm before adding.
--   CON22 Digambar Mahadeo Todekar — Die Shop. Name matches VFL4004 Digambar
--          Todekar (in the 5-worker gap list from PATCH_29). May be the same
--          person re-engaged as a consultant. Cannot add without confirmation.
--   CON23 Suresh Sopan Gawali — Final Shop. Name matches VFL4030 Suresh
--          Gawali (same gap list). Same reason.
--
-- Role assignment: 'member' — consultants use the existing worker UI screens
-- (GPS check-in, QR, attendance calendar, score) without needing new routes.
-- A dedicated 'consultant' tab is scoped for a future session.
--
-- Login identifier: CON ID (e.g. "CON01") or phone number once added.
-- Starting PIN:  "20" + LPAD(numeric part, 4, '0')
--   CON01  →  200001     CON12  →  200012     CON21  →  200021
-- This is different from the VFL formula (LPAD digits to 6) — the "20"
-- prefix makes consultant PINs unambiguously distinct from any VFL starting PIN.
--
-- Safe to re-run: all inserts are guarded with ON CONFLICT DO NOTHING; the
-- auth-user loop skips already-provisioned rows.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Insert consultant employees
-- ---------------------------------------------------------------------------
INSERT INTO employees (emp_code, name, department, role, category, salary, is_active, must_change_pin, language_preference, gender)
VALUES
  ('CON01', 'Chhagan D Dehade',              'Die Shop',       'member', 'consultant', 0, true, true, 'en', 'male'),
  ('CON05', 'Madhukar Shamgir Gosavi',        'Design',         'member', 'consultant', 0, true, true, 'en', 'male'),
  ('CON09', 'Nagnath Damu Kale',              'Die Shop',       'member', 'consultant', 0, true, true, 'en', 'male'),
  ('CON12', 'Sadashiv Nitalaksha Soddy',      'Quality',        'member', 'consultant', 0, true, true, 'en', 'male'),
  ('CON13', 'Sanjeev Pandurang Supsande',     NULL,             'member', 'consultant', 0, true, true, 'en', 'male'),
  ('CON16', 'Sarwan Bindhyanchal Prasad',     'Forge Shop',     'member', 'consultant', 0, true, true, 'en', 'male'),
  ('CON18', 'Bapusaheb Trimbak Gawate',       'Die Shop',       'member', 'consultant', 0, true, true, 'en', 'male'),
  ('CON20', 'Prabhuling Ramchandra Achaleri', 'Die Shop',       'member', 'consultant', 0, true, true, 'en', 'male'),
  ('CON21', 'Balasaheb Sahebrao Yeole',       'Maintenance',    'member', 'consultant', 0, true, true, 'en', 'male')
ON CONFLICT (emp_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Provision Supabase auth users for each consultant
--
--    PIN formula:  '20' || lpad(regexp_replace(emp_code, '\D','','g'), 4, '0')
--      CON01  →  '200001'    CON09  →  '200009'    CON21  →  '200021'
--
--    Mirrors PATCH_10's loop exactly except for the starting-pin formula.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  emp            record;
  new_user_id    uuid;
  synthetic_email text;
  starting_pin   text;
  has_provider_id boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'identities'
      AND column_name = 'provider_id'
  ) INTO has_provider_id;

  FOR emp IN
    SELECT id, emp_code
    FROM employees
    WHERE is_active = true
      AND auth_user_id IS NULL
      AND emp_code LIKE 'CON%'
  LOOP
    synthetic_email := lower(emp.emp_code) || '@forgeos.local';
    -- CON01 → '200001',  CON12 → '200012'
    starting_pin := '20' || lpad(regexp_replace(emp.emp_code, '\D', '', 'g'), 4, '0');

    -- Skip if auth user already exists for this email (idempotent re-run).
    IF EXISTS (SELECT 1 FROM auth.users u WHERE u.email = synthetic_email) THEN
      UPDATE employees e
         SET auth_user_id = (SELECT u.id FROM auth.users u WHERE u.email = synthetic_email)
       WHERE e.id = emp.id AND e.auth_user_id IS NULL;
      CONTINUE;
    END IF;

    new_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      synthetic_email,
      crypt(starting_pin, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('emp_code', emp.emp_code),
      '', '', '', '',
      false
    );

    IF has_provider_id THEN
      INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), new_user_id, new_user_id,
        jsonb_build_object('sub', new_user_id::text, 'email', synthetic_email),
        'email', now(), now(), now()
      );
    ELSE
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        new_user_id::text, new_user_id,
        jsonb_build_object('sub', new_user_id::text, 'email', synthetic_email),
        'email', now(), now(), now()
      );
    END IF;

    UPDATE employees SET auth_user_id = new_user_id WHERE id = emp.id;
  END LOOP;
END $$;

COMMIT;
