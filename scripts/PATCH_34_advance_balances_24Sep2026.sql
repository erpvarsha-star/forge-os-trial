-- PATCH_34: Salary consolidation — real advance balances from Yash
-- (24 Sep 2026), with monthly deduction amounts until each is cleared.
--
-- advance_requests had no column for a fixed monthly deduction amount
-- (only `repayment_months`, an integer count, and `outstanding_balance`) —
-- Yash's list gives a real rupee figure per month, not a month count, so
-- this adds `monthly_deduction` rather than force-fitting it into
-- `repayment_months` (which would require guessing a month count by
-- dividing, not something actually confirmed).
--
-- 8 names given; 7 matched against the live employees table. The 8th,
-- Ganesh Laxmanrao Kausadkar, is NOT in Forge OS at all — no match on
-- "Ganesh" anywhere in the table. Same class of gap as Nidhi Kumari
-- (PATCH_29/33): a real person in Yash's own records with no employees
-- row yet. Not fabricated here — needs a real emp_code from Yash before
-- this one row can be added.
--
-- One deliberate disambiguation: "Shrawan Rewant Singh" matches VFL1520
-- exactly by full name. VFL1527 "Sharwan Singh Jodha" is a DIFFERENT
-- person that CLAUDE.md already documents as historically confused with
-- VFL1520 ("phone... duplicate of VFL1520") -- this advance goes to
-- VFL1520, not VFL1527.
--
-- Each row is inserted as status='approved' (these are already-active,
-- ongoing advances being recorded, not new pending requests) with
-- outstanding_balance = the given current balance and monthly_deduction =
-- the given monthly figure. repayment_months is left at its default (1,
-- meaningless here) since no month count was given -- only a rupee/month
-- figure.

BEGIN;

alter table advance_requests add column if not exists monthly_deduction numeric default 0;

insert into advance_requests (employee_id, amount, outstanding_balance, monthly_deduction, status, reason)
select e.id, v.amount, v.amount, v.monthly_deduction, 'approved', 'Opening balance recorded from Yash, 24 Sep 2026'
from (values
  ('VFL1389', 95000,  5000),  -- Tushar Abasaheb Shirgire
  ('VFL1482', 18000,  3000),  -- Brahmanand Kaduba Tajne
  ('VFL1441', 253000, 5000),  -- Jitendrasingh Nainsingh
  ('VFL1528', 12000,  5000),  -- Bhupendra Kashinath Bharude
  ('VFL1567', 168000, 8000),  -- Kajal Balkrishna Sutar
  ('VFL1520', 142000, 4000),  -- Shrawan Rewant Singh (NOT VFL1527)
  ('VFL5079', 169000, 5000)   -- Sudeep Singh
) as v(emp_code, amount, monthly_deduction)
join employees e on e.emp_code = v.emp_code;

COMMIT;
