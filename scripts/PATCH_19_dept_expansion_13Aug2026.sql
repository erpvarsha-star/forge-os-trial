-- ============================================================================
-- PATCH_19 — Maintenance (electricity + oil), Manpower (security + HR), VMC
-- 13 Aug 2026
--
-- Answers the open question from PATCH_14/PENDING.md: "Four ALERT.gs
-- departments are absent from the registry: Electricity, Oil, Staff Manpower,
-- Contract Manpower — which real department covers them?"
--
-- Yash, 13 Aug: "electricity, oil comes under maintenance and manpower comes
-- under security and hr — we need to add them, they need to feed it in, was
-- missed earlier in the earlier alert." Also: "we need to add VMC machine per
-- shift output."
--
-- Verified against the LIVE registry sheet (1M2E83q64BXzfGwZsNQ_9u2jdfzwJPrJlD8WKRKgG554)
-- via the Drive connector before writing this — not guessed. Real published
-- forms exist for all of this already:
--
--   Maintenance Shop  — 4 Daily forms: check sheet, TWO electricity forms
--                        (the sheet genuinely lists two — "VFPL Electricity
--                        Consumable Form" and "VFL 24Hrs Electricity
--                        Consumable Form" — both kept), and oil.
--   HR Dept + Security — the SAME 2 manpower forms ("Daily Manpower Form",
--                        "Daily Contractual Manpower Form") are listed under
--                        BOTH department labels in the registry, each with a
--                        different responsible person. Both marked "As & When
--                        Required" by the registry itself, not Daily — that
--                        cadence is respected below, not overridden.
--   VMC Shop          — 1 Daily form: "VMC Daily check sheet". This is the
--                        per-shift machine output form Yash asked for.
--
-- ⚠ employees.department HAS NO SEPARATE 'Security' VALUE. Security guards are
-- seeded with department = 'Human Resource' (EMPLOYEE_SEED_03Aug2026.sql —
-- role security_guard, e.g. VFL1441, VFL1465). The registry's "Security" and
-- "HR Dept" are two operational labels sharing one real employees.department
-- value, so both manpower forms are seeded ONCE under 'Human Resource' — a
-- second copy under a 'Security' department nothing in employees.department
-- ever matches would just never show up in anyone's Forms tab.
--
-- ⚠ WHAT THIS DOES NOT DO: push Electricity/Oil into production_records.
-- RAW_ELECTRICITY holds kWh meter readings and RAW_OIL holds litres consumed —
-- neither is "quantity of parts produced," and summing them into the same
-- number as Cutting/Forge/Press output would make the production dashboard
-- lie. See the matching ALERT.gs change, which excludes them from
-- syncProductionToSupabase() explicitly rather than by accident.
--
-- VMC has no RAW_VMC tab on the dashboard yet (checked the live sheet's tab
-- index — it isn't there), so VMC cannot get per-shift on-time/late/missing
-- compliance tracking until one exists. That's a dashboard-side gap, not
-- something to fabricate here. This patch gets the form into the app and the
-- reminder; compliance tracking for it is a separate, later piece.
--
-- ⚠ RUN IN THE SUPABASE SQL EDITOR. Safe to re-run — same on-conflict
-- behaviour as PATCH_14: url/person/frequency/sort_order refresh, but
-- send_in_reminder is never touched by a re-run, so muting one of these later
-- sticks.
-- ============================================================================

begin;

insert into public.form_links
  (department, form_name, frequency, responsible_person, url, send_in_reminder, sort_order)
values
  ('Maintenance', 'Maintanance Daily check sheet', 'Daily',
   'Atul Bhata Patil, Dharmendra Prabhu Mahto, Shaikh Majeed, Devendrakumar Jagdish Singh, Nanasaheb Dinkar Shinde, Shivaji Suresh Jaypure, Sunil Ramakant Saha, Vijay Rangnath Sonawane, Sandip Tryambak Landage, Manoj Anantrao Wagh',
   'https://docs.google.com/forms/d/e/1FAIpQLSeH-1oDurNeYxJDwXWEea6Gpmz3omIVv8WLjvN-SJBKvKKT9A/viewform', true, 10),
  ('Maintenance', 'VFPL Electricity Consumable Form', 'Daily',
   'Atul Bhata Patil, Dharmendra Prabhu Mahto, Shaikh Majeed, Devendrakumar Jagdish Singh, Nanasaheb Dinkar Shinde, Shivaji Suresh Jaypure, Sunil Ramakant Saha, Vijay Rangnath Sonawane, Sandip Tryambak Landage, Manoj Anantrao Wagh',
   'https://docs.google.com/forms/d/e/1FAIpQLScB6QrOCHmWeAKzZP76eWPISlt_tnr5z7aBROTHK614gfd31A/viewform', true, 20),
  ('Maintenance', 'VFL 24Hrs Electricity Consumable Form', 'Daily',
   'Atul Bhata Patil, Dharmendra Prabhu Mahto, Shaikh Majeed, Devendrakumar Jagdish Singh, Nanasaheb Dinkar Shinde, Shivaji Suresh Jaypure, Sunil Ramakant Saha, Vijay Rangnath Sonawane, Sandip Tryambak Landage, Manoj Anantrao Wagh',
   'https://docs.google.com/forms/d/e/1FAIpQLScr2JYBV9yFN5WZj99dhc2mTV--1_-Y8pIeMT8Bmf6t9qR7RQ/viewform', true, 30),
  ('Maintenance', 'VFL Oil Consumable', 'Daily',
   'Atul Bhata Patil, Dharmendra Prabhu Mahto, Shaikh Majeed, Devendrakumar Jagdish Singh, Nanasaheb Dinkar Shinde, Shivaji Suresh Jaypure, Sunil Ramakant Saha, Vijay Rangnath Sonawane, Sandip Tryambak Landage, Manoj Anantrao Wagh',
   'https://docs.google.com/forms/d/e/1FAIpQLSfyrYgWEhyBjy8GxwvaaDOk5Uc5doDYZ0SeSE2uUoU9ujNUkA/viewform', true, 40),

  -- As & When Required, per the registry — not chased on the 15-minute shift
  -- timer, but visible in the Forms tab. Flip send_in_reminder to true if the
  -- real cadence should be daily instead; that is a policy call, not a typo.
  ('Human Resource', 'Daily Manpower Form', 'As & When Required',
   'Shrawan Rewant Singh (Security), Milind Ambadas Barhate / Pallavi Vishnu Khade / Mayuri Sardar Rathod (HR)',
   'https://docs.google.com/forms/d/e/1FAIpQLSflyxcQjVEdv2OXgflXhKVH1VWhBUEMhC7KhUUUtdb4pHQNyw/viewform', false, 200),
  ('Human Resource', 'Daily Contractual Manpower Form', 'As & When Required',
   'Shrawan Rewant Singh (Security), Milind Ambadas Barhate / Pallavi Vishnu Khade / Mayuri Sardar Rathod (HR)',
   'https://docs.google.com/forms/d/e/1FAIpQLSfecNumIXRV7Xej_n-4N7k0K702I9WHjiT6F_naEqT5JnFS0g/viewform', false, 210),

  ('VMC Shop', 'VMC Daily check sheet', 'Daily',
   'Abhimanyu Kakde, Amol Rakhmaji Ambhore, Sayed Uzaif Ali Syed Altaf Ali',
   'https://docs.google.com/forms/d/e/1FAIpQLSdCv3PnoYHJy5H-y60hjwQTR4dBvC9mfKNNFiYMnFiZSD4pRw/viewform', true, 10)

on conflict (department, form_name) do update
  set url                = excluded.url,
      responsible_person = excluded.responsible_person,
      frequency           = excluded.frequency,
      sort_order          = excluded.sort_order,
      updated_at          = now();

commit;

-- ============================================================================
-- Verify
-- ============================================================================
-- select department, form_name, frequency, send_in_reminder
--   from form_links
--  where department in ('Maintenance', 'Human Resource', 'VMC Shop')
--  order by department, sort_order;
--  expect: 4 rows Maintenance (all send_in_reminder=true),
--          2 rows Human Resource (both send_in_reminder=false),
--          1 row VMC Shop (send_in_reminder=true)
