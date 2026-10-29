-- PATCH_118: audit_log records the real acting employee instead of always NULL.
-- APPLIED LIVE 29 Oct 2026 (owner decision). Exact record of what was applied; no personal data.
-- Before: actor came only from a 'employee_id' JWT claim, which Supabase JWTs never carry -> always NULL.
-- Now: actor = JWT 'employee_id' claim if present, else public.current_employee_id() (auth.uid() lookup);
--      stays NULL only for service-role / SQL-editor / cron writes (no JWT).
-- Also hardened: empty-string request.jwt.claims (left by pooled connections) no longer errors the trigger.
-- search_path = public added to audit_row_change. Trigger bindings unchanged; existing audit_log rows NOT rewritten.
-- Bank/PAN/UAN masking in audit_row_change_salary_masked is unchanged (PATCH_116).
-- Tests (rolled back, zero residue; audit_log 139 rows / 139 NULL actor before and after):
--   TEST_RESULT: A_actor_null=t (no JWT) A_table=employee_salary_structure A_bank_masked=t A_masked_has_bank=t
--     | B_actor_is_hr=t (VFL5440 JWT) B_bank_masked=t B_masked_has_bank=t
--     | C_table=payroll_records C_actor_is_hr=t | rows_added=3

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  insert into audit_log (actor_employee_id, table_name, row_id, action, old_values, new_values)
  values (
    coalesce(
      nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'employee_id','')::uuid,
      public.current_employee_id()
    ),
    TG_TABLE_NAME,
    coalesce(new.id::text, old.id::text),
    lower(TG_OP),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $function$;

create or replace function public.audit_row_change_salary_masked()
returns trigger language plpgsql security definer set search_path = public as $function$
declare
  k text;
  v_old jsonb := case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_changed text[] := '{}';
  v_keys text[] := array['bank_name','account_no','ifsc','uan','pan'];
begin
  foreach k in array v_keys loop
    if (v_old -> k) is distinct from (v_new -> k) then
      v_changed := v_changed || k;
    end if;
    v_old := v_old - k;
    v_new := v_new - k;
  end loop;
  if v_new is not null then
    v_new := v_new || jsonb_build_object('masked_fields', to_jsonb(v_changed));
  elsif v_old is not null then
    v_old := v_old || jsonb_build_object('masked_fields', to_jsonb(v_changed));
  end if;
  insert into audit_log (actor_employee_id, table_name, row_id, action, old_values, new_values)
  values (
    coalesce(
      nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'employee_id','')::uuid,
      public.current_employee_id()
    ),
    TG_TABLE_NAME,
    coalesce(new.id::text, old.id::text),
    lower(TG_OP),
    v_old,
    v_new
  );
  return coalesce(new, old);
end $function$;
