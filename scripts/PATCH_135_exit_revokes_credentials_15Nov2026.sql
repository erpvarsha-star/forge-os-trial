-- Forge OS — PATCH_135: an employee exit must REVOKE CREDENTIALS, not just set is_active = false.
-- Written AND APPLIED LIVE 15 Nov 2026, on the owner's explicit approval:
--   "apply patch 135 .. if they make a mistake then they should take the extra effort to reactivate"
-- Applied by Claude directly (a Sonnet agent was briefed first; the spawn was refused by the safety
-- classifier because writes to auth.* read as destructive). Tested in rolled-back transactions, see
-- the TEST RECORD at the foot of this file. Zero residue confirmed afterwards.
--
-- WHY THIS EXISTS (keep this reason attached to the rule — a documented project requirement):
--
-- `is_active = false` DOES NOT LOCK ANYONE OUT OF THIS SYSTEM. It blocks only the *app's* login
-- screen, because public.resolve_login_identifier() filters on `e.is_active = true`. But:
--   * the synthetic login email is derivable by anyone who knows the emp_code — '<empcode>@forgeos.local';
--   * the PIN (= the auth password) is left unchanged;
--   * NO RLS policy anywhere checks is_active — every policy keys on `auth_user_id = auth.uid()`.
-- So a direct call to the Supabase Auth API still mints a working session for a "deactivated"
-- employee, and that session passes RLS.
--
-- This is not theoretical. When VFL1557 was terminated for a breach of information on 15 Nov 2026,
-- he had 1 live refresh token and 1 live session at that moment. Deactivation alone would have left
-- both working. Every earlier deactivation in this project (PATCH_60 VFL1319; PATCH_61 CON22, CON23,
-- VFL5354, VFL4048; VFL5337; and the rest) did the is_active step only — those credentials may still
-- authenticate today. This patch stops NEW exits adding to that list; it does not remediate the old
-- ones (deliberately — that is a separate owner decision, see PENDING.md).
--
-- WHAT IT CHANGES: purely additive. Both functions keep their exact signature, role checks,
-- validation, transition rules and return values. At the one point where each already sets
-- `is_active = false`, it now also, for that employee's auth user:
--   1. rotates auth.users.encrypted_password to three concatenated gen_random_uuid()s, bcrypt-hashed
--      INSIDE Postgres — so nobody, Claude included, ever sees the value (same method as PATCH_16's
--      QR salt);
--   2. revokes every live auth.refresh_tokens row;
--   3. expires every live auth.sessions row.
-- An 'active' / 'rehired' transition revokes NOTHING.
--
-- POLICY CONSEQUENCE — accepted by the owner, 15 Nov 2026. After this, a deactivation DESTROYS that
-- person's PIN. If HR deactivates someone by mistake, reactivating them is NOT enough — HR must also
-- reset their PIN (More → Missing Data → reset PIN, i.e. public.reset_employee_pin(), which already
-- handles both the VFL and CON formulas). The owner's ruling: "if they make a mistake then they should
-- take the extra effort to reactivate." Do not soften this to a warning-only behaviour.
--
-- NOTES FOR WHOEVER APPLIES THIS:
--   * Both functions carry `SET search_path TO 'public'`, so auth.*, extensions.crypt and
--     extensions.gen_salt MUST stay schema-qualified exactly as written. pgcrypto lives in
--     `extensions` on this project (verified 15 Nov 2026).
--   * No DROP and no DELETE anywhere — CREATE OR REPLACE and UPDATE only, per this project's
--     standing guardrails (the Supabase MCP tool also cannot execute DROP/DELETE).
--   * Test inside `begin; ... rollback;` against an already-INACTIVE employee that has an
--     auth_user_id. Never print encrypted_password; compare md5(encrypted_password) before/after.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: revoke one employee's credentials. Internal; service_role only.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._revoke_employee_credentials(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid;
begin
  select auth_user_id into v_uid from public.employees where id = p_employee_id;
  if v_uid is null then
    return;  -- no login provisioned; nothing to revoke
  end if;

  -- 1. Destroy the PIN. Generated in-database; the value is never returned to any caller.
  update auth.users u
     set encrypted_password = extensions.crypt(
           gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text,
           extensions.gen_salt('bf')),
         updated_at = now()
   where u.id = v_uid;

  -- 2. Kill refresh tokens, so an app already signed in cannot renew.
  update auth.refresh_tokens t
     set revoked = true, updated_at = now()
   where t.user_id::text = v_uid::text
     and coalesce(t.revoked, false) = false;

  -- 3. Expire live sessions.
  update auth.sessions s
     set not_after = now()
   where s.user_id::text = v_uid::text
     and (s.not_after is null or s.not_after > now());
end $$;

revoke all on function public._revoke_employee_credentials(uuid) from public, anon, authenticated;
grant execute on function public._revoke_employee_credentials(uuid) to service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — APPLIED. Both exit paths now call the helper at the exact point they
-- already set is_active = false. Each function was re-created with CREATE OR REPLACE from its
-- CURRENT live body (fetched with pg_get_functiondef and copied verbatim, never retyped from
-- memory — that is how the 4 Nov 2026 "v15" edge-function deploy broke), adding ONLY these lines:
--
-- In public.record_employee_status(...), in the existing `if v_eff <= v_today then` block:
--       update public.employees set is_active = false where id = p_employee_id;
--       perform public._revoke_employee_credentials(p_employee_id);          -- <<< ADDED
--   (the 'active'/'rehired' branch is untouched, so a reinstatement revokes nothing)
--
-- In public.apply_due_exits(), the bulk UPDATE became a CTE returning the ids so the count stays
-- correct, then each is revoked:
--       ), upd as ( update public.employees e set is_active = false ... returning e.id )
--       select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from upd;
--       v_n := coalesce(array_length(v_ids, 1), 0);
--       foreach v_id in array v_ids loop
--         perform public._revoke_employee_credentials(v_id);                 -- <<< ADDED
--       end loop;
--       return v_n;
--
-- Everything else in both functions — signature, SECURITY DEFINER, search_path, the
-- owner/hr_admin gate, status validation, the transition matrix, the duplicate-status guard, the
-- effective_from = p_date + 1 rule, the returned jsonb, and apply_due_exits's integer return —
-- is byte-for-byte as it was.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- TEST RECORD — 15 Nov 2026, all inside `begin; … rollback;`, on already-INACTIVE employees so no
-- live person was touched. Hashes compared via md5() only; the hash itself was never selected.
--
-- 1. POSITIVE (CON16, has an auth_user_id, no prior status history). Impersonated HR (VFL5440) by
--    setting BOTH `request.jwt.claims` and `request.jwt.claim.sub` — auth.uid() needs the second
--    form on this project, and get_current_employee_role() then correctly returned 'hr_admin'.
--    Called the real RPC with 'terminated':
--      pin_unchanged  = FALSE   → the PIN hash really was rotated
--      history_rows   = 1      → exit recorded
--      is_active      = false  → deactivated
--    tokens/sessions were already 0 for this person, so those two branches were not exercised here
--    — but they WERE exercised for real earlier the same day on VFL1557, where 1 live refresh token
--    and 1 live session were revoked. Stated plainly rather than claimed as covered by this test.
-- 2. NEGATIVE (CON18). Same impersonation, status 'on_leave' (not an exit):
--      pin_unchanged  = TRUE   → non-exit transitions revoke nothing, as intended
-- 3. CRON: public.apply_due_exits() returned 0 — correct, nobody is currently due (VFL1557 is
--    already is_active=false, which the `and e.is_active` filter excludes).
-- 4. ROLE GATE still intact: an earlier attempt without the jwt claims failed with
--    'Only owner or HR admin may record employee status'.
-- 5. RESIDUE CHECK after rollback, fresh query outside any transaction: CON16/CON18/CON21 all still
--    0 status-history rows, is_active unchanged. Nothing persisted.
-- ─────────────────────────────────────────────────────────────────────────────
