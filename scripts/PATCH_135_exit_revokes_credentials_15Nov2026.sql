-- Forge OS — PATCH_135: an employee exit must REVOKE CREDENTIALS, not just set is_active = false.
-- Written 15 Nov 2026. ⚠ NOT YET APPLIED — needs the owner's go-ahead (see "Policy consequence" below).
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
-- POLICY CONSEQUENCE — the reason this needs the owner's sign-off rather than being applied as a
-- technical fix: after this, a deactivation DESTROYS that person's PIN. If HR deactivates someone by
-- mistake, reactivating them is not enough — HR must also reset their PIN (More → Missing Data →
-- reset PIN, i.e. public.reset_employee_pin(), which already handles both the VFL and CON formulas).
-- That is a small, recoverable extra step, but it is a change to how a mis-click behaves.
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
-- STEP 2 (apply by hand, after reviewing): add ONE line to each exit path.
--
-- In public.record_employee_status(...), inside the existing block:
--
--     if v_eff <= v_today then
--       if p_status in ('left','terminated','retired') then
--         update public.employees set is_active = false where id = p_employee_id;
--         perform public._revoke_employee_credentials(p_employee_id);   -- <<< ADD THIS LINE
--       elsif p_status in ('active','rehired') then
--         update public.employees set is_active = true where id = p_employee_id;
--       end if;
--     end if;
--
-- In public.apply_due_exits(), after the existing bulk UPDATE ... get diagnostics v_n = row_count,
-- loop the same set and revoke each (the return value v_n must stay the number deactivated):
--
--     for v_emp in
--       select e.id from public.employees e join latest l on l.employee_id = e.id
--        where l.status in ('left','terminated','retired') and not e.is_active
--     loop
--       perform public._revoke_employee_credentials(v_emp);
--     end loop;
--
-- Both full function bodies must be re-created with CREATE OR REPLACE, copying the CURRENT live
-- definition verbatim (fetch it with pg_get_functiondef) and adding only the lines above. Do not
-- retype either body from memory — that is how the 4 Nov 2026 "v15" edge-function deploy broke.
-- ─────────────────────────────────────────────────────────────────────────────
