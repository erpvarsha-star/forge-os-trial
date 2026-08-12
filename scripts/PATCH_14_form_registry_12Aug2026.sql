-- ============================================================================
-- PATCH_14 — form registry in the database, so the app can show it
-- 12 Aug 2026
--
-- Yash, 12 Aug: "we give one tab on their page for forms .... where we give
-- them the list of forms", and the shift timings are for notifications in the
-- app, not for scoring people off the Operations Dashboard.
--
-- Until now the only copy of the Google Forms registry lived in two places
-- outside the app: Yash's registry sheet, and the DEPT_FORM_SEED array inside
-- scripts/ALERT.gs. Neither is reachable from React Native. This patch puts
-- the registry in Supabase so:
--   1. app/(supervisor)/forms.tsx and app/(manager)/forms.tsx can list the
--      forms for the signed-in employee's department, and
--   2. the shift-reminder edge function can raise an in-app notification at
--      each shift's form deadline without hardcoding anything.
--
-- ⚠ DEPARTMENT NAMES ARE NOT THE ONES ALERT.gs USES. The dashboard script
-- says 'Cutting' / 'Forge' / 'HT'; employees.department says 'Cutting Shop' /
-- 'Forge Shop' / 'Heat Treatment'. Rows below are keyed to the *employees*
-- spelling, because that is what the app and the edge function join on. The
-- mapping used, confirmed against EMPLOYEE_SEED + WORKER_SEED:
--     Cutting -> Cutting Shop      Machine -> Machine Shop
--     Forge   -> Forge Shop        HT      -> Heat Treatment
--     Press   -> Press Shop        Final   -> Final Shop
-- The four ALERT.gs departments with no forms in the registry (Electricity,
-- Oil, Staff Manpower, Contract Manpower) are deliberately not seeded — they
-- have no forms to chase and no matching employees.department value.
--
-- Only the *Daily* forms are seeded. The "As & When Required" ones (gate
-- pass, hospital, advance, leave) are not chased per shift and would be noise
-- in a per-shift reminder; add them later with frequency = 'As Required' and
-- send_in_reminder = false if they should appear in the tab but not the alert.
--
-- ⚠ RUN IN THE SUPABASE SQL EDITOR. Safe to re-run.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. form_links — the registry itself
--
-- send_in_reminder is the mute switch Yash asked for: a form can be listed in
-- the app tab but left out of the shift reminder by flipping one boolean, no
-- code change and no redeploy.
-- ---------------------------------------------------------------------------
create table if not exists public.form_links (
  id                 uuid primary key default gen_random_uuid(),
  department         text not null,
  form_name          text not null,
  frequency          text not null default 'Daily',
  responsible_person text,
  url                text not null,
  send_in_reminder   boolean not null default true,
  sort_order         integer not null default 0,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (department, form_name)
);

create index if not exists idx_form_links_department on public.form_links (department) where is_active;

alter table public.form_links enable row level security;

-- Read: every signed-in employee. These are published /viewform responder
-- links that are already circulated on WhatsApp — the list is not a secret,
-- and scoping the SELECT by department would break the real case where one
-- person covers two shops (Todmal covers Cutting and HT). The app filters by
-- department for display; RLS is not doing that job.
drop policy if exists "form_links_select_all" on public.form_links;
create policy "form_links_select_all" on public.form_links for select
  using (auth.role() = 'authenticated');

-- Write: management only. Nobody should be able to point a shop's daily form
-- at a URL of their choosing.
drop policy if exists "form_links_insert_management" on public.form_links;
create policy "form_links_insert_management" on public.form_links for insert
  with check (is_management());

drop policy if exists "form_links_update_management" on public.form_links;
create policy "form_links_update_management" on public.form_links for update
  using (is_management()) with check (is_management());

-- ---------------------------------------------------------------------------
-- 2. Seed — 24 daily forms, from Yash's registry sheet
--    (1M2E83q64BXzfGwZsNQ_9u2jdfzwJPrJlD8WKRKgG554)
--
-- on conflict updates the url and the person but deliberately leaves
-- send_in_reminder and is_active alone, so re-running this patch never
-- un-mutes a form somebody muted on purpose.
-- ---------------------------------------------------------------------------
insert into public.form_links
  (department, form_name, frequency, responsible_person, url, send_in_reminder, sort_order)
values
  ('Cutting Shop', 'Cutting PMS', 'Daily', 'Sudeep Singh',
   'https://docs.google.com/forms/d/e/1FAIpQLSf0yqwPXjd8kWwqgpgcDRmYq7Z8PeOV0ifY8lmZycC_MDibjw/viewform', true, 10),
  ('Cutting Shop', 'Cutting Daily check sheet', 'Daily', 'Sudeep Singh',
   'https://docs.google.com/forms/d/e/1FAIpQLSf9m5VVFlVpEaoRYMPZ1MEOnZyaWnkdnIyVYG2yDj736jy-Bg/viewform', true, 20),
  ('Cutting Shop', 'Cutting Planning', 'Daily', 'Sudeep Singh',
   'https://docs.google.com/forms/d/e/1FAIpQLSe9vMmKukDFGNKptsJMOu4ICtSgds4adrhw1Czcjb1XSodSHg/viewform', true, 30),
  ('Cutting Shop', 'Overtime Form', 'Daily', 'Sudeep Singh',
   'https://docs.google.com/forms/d/e/1FAIpQLSf9zPvnTSMDE8AT_vrs9W8y2efwXxTbpJ2FlrRJl2TLoGKGXw/viewform', true, 40),
  ('Forge Shop', 'Forge Daily check sheet', 'Daily', 'Sudeep Singh Laxman Yadav Subhash Sitaram Palve Saroj Avdesh Singh Shaikh Irfan',
   'https://docs.google.com/forms/d/e/1FAIpQLSfEzztMshze903rfc6vobPK0AZudZ9MfM-Mahsuzzj3ie1tEw/viewform', true, 10),
  ('Forge Shop', 'Forge PMS', 'Daily', 'Sudeep Singh Laxman Yadav Subhash Sitaram Palve Saroj Avdesh Singh Shaikh Irfan',
   'https://docs.google.com/forms/d/e/1FAIpQLSeXwEc4jMUmwTySfvFrm4bOqbB01gW5cS_yeiRe6VmlWKDntQ/viewform', true, 20),
  ('Forge Shop', 'Forge Shop Planning', 'Daily', 'Sudeep Singh Laxman Yadav Subhash Sitaram Palve Saroj Avdesh Singh Shaikh Irfan',
   'https://docs.google.com/forms/d/e/1FAIpQLSc1cbhgqSJVuLXFJ6xCr5pkfN0UBhok8mpi6sIcA1AY6BsJSQ/viewform', true, 30),
  ('Press Shop', 'Press Daily check sheet', 'Daily', 'Dinkar Landge Shyambabu Radheshyam Yadav Chandan Milind Sonapasare Manbodh Sambhu Sah Shaikh Zaker Abdul Quayyum Vaibhav Mali',
   'https://docs.google.com/forms/d/e/1FAIpQLSc0QOVHipibWe2B4pENewKxJt7O36xe4eRDMxNqr_UYf7Ei2A/viewform', true, 10),
  ('Press Shop', 'Press PMS', 'Daily', 'Dinkar Landge Shyambabu Radheshyam Yadav Chandan Milind Sonapasare Manbodh Sambhu Sah Shaikh Zaker Abdul Quayyum Vaibhav Mali',
   'https://docs.google.com/forms/d/e/1FAIpQLSerCkOEK8Y9olorgA4OtusaaBXxA9G7RgHcq9IXJmCabcfRMg/viewform', true, 20),
  ('Press Shop', 'Press Shop Planning', 'Daily', 'Dinkar Landge Shyambabu Radheshyam Yadav Chandan Milind Sonapasare Manbodh Sambhu Sah Shaikh Zaker Abdul Quayyum Vaibhav Mali',
   'https://docs.google.com/forms/d/e/1FAIpQLSe9fhnfuCG_DjAPij5jk0k5K3ix9OCs7bHTxAX5eQtCK0Tgsw/viewform', true, 30),
  ('Machine Shop', 'Machine Daily check sheet', 'Daily', 'Haribhau Shamrao Datar. Pravin Pundalik Sonavane Santosh Vishwanath Sawai Bhupendra Kashinath Bharude Shaikh Wajid shaikh Shabbir Ramesh Narayan Gote Anna Pralhad Deshmukh Bhaiyyasaheb Sambhaji Patil Vitthal Uddhav Tekale',
   'https://docs.google.com/forms/d/e/1FAIpQLSeBWFirZX18C1Sqz4hiTzLnPSDqXGEbYLH5LWmo3Gy6Rx0kQA/viewform', true, 10),
  ('Machine Shop', 'Machine PMS', 'Daily', 'Haribhau Shamrao Datar. Pravin Pundalik Sonavane Santosh Vishwanath Sawai Bhupendra Kashinath Bharude Shaikh Wajid shaikh Shabbir Ramesh Narayan Gote Anna Pralhad Deshmukh Bhaiyyasaheb Sambhaji Patil Vitthal Uddhav Tekale',
   'https://docs.google.com/forms/d/e/1FAIpQLSdzriZ1FIXAdrt247msSFabUSnLn5ctdBkyl_4NyRL_b_UBSg/viewform', true, 20),
  ('Machine Shop', 'Machine Shop Planning', 'Daily', 'Haribhau Shamrao Datar. Pravin Pundalik Sonavane Santosh Vishwanath Sawai Bhupendra Kashinath Bharude Shaikh Wajid shaikh Shabbir Ramesh Narayan Gote Anna Pralhad Deshmukh Bhaiyyasaheb Sambhaji Patil Vitthal Uddhav Tekale',
   'https://docs.google.com/forms/d/e/1FAIpQLSfkmTouMWhxG-7SbnwcV4wbQJrPJOxD9cdnvHWrdh3fZIIc4Q/viewform', true, 30),
  ('Machine Shop', 'VFPL Sales Dispatch Actual Form', 'Daily', 'Haribhau Shamrao Datar. Pravin Pundalik Sonavane Santosh Vishwanath Sawai Bhupendra Kashinath Bharude Shaikh Wajid shaikh Shabbir Ramesh Narayan Gote Anna Pralhad Deshmukh Bhaiyyasaheb Sambhaji Patil Vitthal Uddhav Tekale',
   'https://docs.google.com/forms/d/e/1FAIpQLSerDrMI7SlhB5HEHyUDuxfPJrCuvpwkyl9pw2lOYqwOaUqteg/viewform', true, 40),
  ('Machine Shop', 'Dispatch Plan-Machine Shop', 'Daily', 'Haribhau Shamrao Datar. Pravin Pundalik Sonavane Santosh Vishwanath Sawai Bhupendra Kashinath Bharude Shaikh Wajid shaikh Shabbir Ramesh Narayan Gote Anna Pralhad Deshmukh Bhaiyyasaheb Sambhaji Patil Vitthal Uddhav Tekale',
   'https://docs.google.com/forms/d/e/1FAIpQLSdcZw9VVStYMhy17zHu5hnB-mC9sn6Pq0V5SkIZCfV1uzTPUA/viewform', true, 50),
  ('Heat Treatment', 'HT Daily check sheet', 'Daily', 'Balasaheb Shivaji Todmal Ramnath Babasaheb Gadekar',
   'https://docs.google.com/forms/d/e/1FAIpQLSc5M5SVkihS7FIZCLF-8Me5wGseyQIU88x0p1Zs1aB5ZThrRw/viewform', true, 10),
  ('Heat Treatment', 'HT PMS', 'Daily', 'Balasaheb Shivaji Todmal Ramnath Babasaheb Gadekar',
   'https://docs.google.com/forms/d/e/1FAIpQLSdVaiBzMydIQxI0h77R78_aPyFzuLjIFFpUY2T1qTQrfwl8Jg/viewform', true, 20),
  ('Heat Treatment', 'HT Shop Planning', 'Daily', 'Balasaheb Shivaji Todmal Ramnath Babasaheb Gadekar',
   'https://docs.google.com/forms/d/e/1FAIpQLSeeuJRiGEtT3wst31Qs5f9BX3NpLXLW5StmwpYTJldAXayaSg/viewform', true, 30),
  ('Final Shop', 'Final Daily check sheet', 'Daily', 'Jakir Munshi Chaudhari Subhash Shivanand Thorat Ashok Kumar',
   'https://docs.google.com/forms/d/e/1FAIpQLScnN9MwSqunjomGCTo73GuIBHBw1xHTj4j8u_49PZsAZzM1hQ/viewform', true, 10),
  ('Final Shop', 'Final PMS', 'Daily', 'Jakir Munshi Chaudhari Subhash Shivanand Thorat Ashok Kumar',
   'https://docs.google.com/forms/d/e/1FAIpQLSdyxVMje-Ke51r6AnNbh81mFgbDzjJGQbjkfcpFHk4S1BbMYA/viewform', true, 20),
  ('Final Shop', 'VFPL Sales Dispatch Actual Form', 'Daily', 'Jakir Munshi Chaudhari Subhash Shivanand Thorat Ashok Kumar',
   'https://docs.google.com/forms/d/e/1FAIpQLSerDrMI7SlhB5HEHyUDuxfPJrCuvpwkyl9pw2lOYqwOaUqteg/viewform', true, 30),
  ('Final Shop', 'Final Shop Planning', 'Daily', 'Jakir Munshi Chaudhari Subhash Shivanand Thorat Ashok Kumar',
   'https://docs.google.com/forms/d/e/1FAIpQLSff5rk2BDx-2ky64_rrVUXlrxdgqI4mvHL-Kcf5eBhHa8nA2w/viewform', true, 40),
  ('Final Shop', '57F4 Inward Form', 'Daily', 'Jakir Munshi Chaudhari Subhash Shivanand Thorat Ashok Kumar',
   'https://docs.google.com/forms/d/e/1FAIpQLSdHaCr9PfjKFv_nRIQGy_0uBo6SmoXfJe06ZNWW5-zBONkA-w/viewform', true, 50),
  ('Final Shop', '57F4 Outward Form', 'Daily', 'Jakir Munshi Chaudhari Subhash Shivanand Thorat Ashok Kumar',
   'https://docs.google.com/forms/d/e/1FAIpQLSdfReEVbGGGNC6CwIPDq53syvvkomXj2gfIWNBQehjozUD1DA/viewform', true, 60)
on conflict (department, form_name) do update
  set url                = excluded.url,
      responsible_person = excluded.responsible_person,
      frequency          = excluded.frequency,
      sort_order         = excluded.sort_order,
      updated_at         = now();

-- ---------------------------------------------------------------------------
-- 3. Shift schedule for form deadlines, as plant_config JSON
--
-- These are the timings off the Operations Dashboard shift master, confirmed
-- 12 Aug: S1 08:30-15:30, S2 15:30-23:30, S3 23:30-08:30, 60-minute grace
-- after shift end, so deadlines land at 16:30 / 00:30 / 09:30.
--
-- Per Yash 12 Aug these drive NOTIFICATIONS ONLY. Nothing scores an employee
-- off them — not nightly-scoring, not monthly_scores, not ALERT.gs.
--
-- Stored as one JSON key rather than a table because it is six numbers that
-- change roughly never, and because plant_config is already the place the app
-- looks for plant-wide settings. Editing it here changes the reminder times
-- with no redeploy of the edge function.
--
-- lead_minutes = how long BEFORE the deadline the reminder goes out. The 15
-- in the ALERT.gs config is this value; it was misread as the grace period
-- once already, so it is named explicitly here.
-- ---------------------------------------------------------------------------
insert into public.plant_config (config_key, config_value, description)
values (
  'form_shift_schedule',
  '{"lead_minutes": 15, "shifts": [
     {"shift": "Shift 1", "start": "08:30", "end": "15:30", "deadline": "16:30"},
     {"shift": "Shift 2", "start": "15:30", "end": "23:30", "deadline": "00:30"},
     {"shift": "Shift 3", "start": "23:30", "end": "08:30", "deadline": "09:30"}
   ]}'::jsonb,
  'Shift form deadlines used by shift-reminder. Notifications only - not scoring.'
)
on conflict (config_key) do update
  set config_value = excluded.config_value,
      description  = excluded.description,
      updated_at   = now();

-- ---------------------------------------------------------------------------
-- 4. notifications.related_entity_* — the columns push.ts has always written
--    to and this schema has never had
--
-- ⚠ THIS IS A LIVE BUG, NOT A NEW FEATURE. supabase/functions/_shared/push.ts
-- builds every notification row as:
--     { user_id, type, title, body, related_entity_type, related_entity_id }
-- Those last two exist only in supabase/migrations/20260803090000_initial_schema.sql
-- — the old spec-derived schema CLAUDE.md tells you to ignore. They are NOT in
-- FINAL_SCHEMA_02Aug2026.sql, which is what is actually deployed.
--
-- PostgREST rejects an insert naming a column that does not exist (PGRST204),
-- and notifyEmployees() never checked the error:
--     await db.from('notifications').insert(rows);
-- So the insert has been failing silently for every edge function that calls
-- it — nightly-scoring, fraud-detector, mrm-reminder, shift-reminder. The
-- in-app notification bell has never received a single row from the server.
-- That was invisible because Android push was separately broken on FCM, so
-- "no notification arrived" had an accepted explanation.
--
-- Adding the columns rather than stripping them from push.ts keeps the
-- deep-link intent (open the MRM review / fraud flag the alert is about) and
-- fixes every caller at once. related_entity_id is text, not uuid, because
-- the forms reminder keys on 'yyyy-mm-dd|Shift n' rather than a row id.
-- push.ts is fixed in the same commit to surface insert errors instead of
-- swallowing them.
-- ---------------------------------------------------------------------------
alter table public.notifications add column if not exists related_entity_type text;
alter table public.notifications add column if not exists related_entity_id   text;

-- The forms reminder dedupes on (type, related_entity_id) so a 15-minute cron
-- sends one nudge per shift deadline rather than one per invocation.
create index if not exists idx_notifications_related
  on public.notifications (type, related_entity_id);

commit;

-- ============================================================================
-- Verify
-- ============================================================================
-- select department, count(*) from form_links where is_active group by 1 order by 1;
--   expect: Cutting Shop 4, Final Shop 6, Forge Shop 3,
--           Heat Treatment 3, Machine Shop 5, Press Shop 3   (24 total)
-- select config_value from plant_config where config_key = 'form_shift_schedule';
-- select column_name from information_schema.columns
--   where table_name = 'notifications' and column_name like 'related_%';
--   expect: related_entity_type, related_entity_id
