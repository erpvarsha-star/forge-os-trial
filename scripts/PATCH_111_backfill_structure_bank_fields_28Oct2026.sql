-- ============================================================================
-- PATCH_111 (REVISED 28 Oct after read-only dry-run): stage + import employee
-- bank/UAN/PAN fields from the HR OS statutory master, NULL-fill only.
-- Date: 2026-10-28
-- Author: Kimi Code
-- Applied by: HUMAN after review, in Supabase SQL Editor. Never auto-applied.
-- Status: PREPARED, NOT APPLIED
-- ============================================================================
-- WHY (verified read-only 28 Oct): 14 structure rows with effective_from >=
-- 2026-07-26 are missing bank fields, AND a dry-run of the original
-- "copy from the employee's own older row" idea filled NOTHING — for all 14,
-- no older row holds the missing values either. The data exists in the
-- HR OS 2026 27 workbook (EMPLOYEE_STATUTORY_IDS: 329 rows; bank on 305,
-- UAN on 325, PAN on 326), cross-checkable against the Waluj master and the
-- Master salary sheet.
-- REDACTION: this public file contains NO personal values. The values travel
-- in a separate private file (generated locally, never committed) that the
-- human pastes into the staging table in STEP 2.
-- SAFETY: NULL-fill only (never overwrites), transaction-wrapped, preview +
-- post-check + rollback. Engine untouched; no DELETE; no schema change to
-- existing tables (staging table is new, dropped at the end).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: staging table (once; re-runnable).
CREATE TABLE IF NOT EXISTS _patch111_staging (
  emp_code     text PRIMARY KEY,
  bank_name    text,
  account_no   text,
  ifsc         text,
  uan          text,
  pan          text
);

-- STEP 2: paste rows into _patch111_staging from the PRIVATE value file
-- (owner's copy; produced from HR OS EMPLOYEE_STATUTORY_IDS, codes only keyed).
-- INSERT INTO _patch111_staging (emp_code, bank_name, account_no, ifsc, uan, pan)
-- VALUES (...), (...);

-- STEP 3: preview — what would change, per code and field (NULL-fill only).
SELECT e.emp_code,
       s.effective_from,
       (s.bank_name  IS NULL AND st.bank_name  IS NOT NULL) AS fills_bank_name,
       (s.account_no IS NULL AND st.account_no IS NOT NULL) AS fills_account_no,
       (s.ifsc       IS NULL AND st.ifsc       IS NOT NULL) AS fills_ifsc,
       (s.uan        IS NULL AND st.uan        IS NOT NULL) AS fills_uan,
       (s.pan        IS NULL AND st.pan        IS NOT NULL) AS fills_pan
FROM employee_salary_structure s
JOIN employees e            ON e.id = s.employee_id
JOIN _patch111_staging st   ON st.emp_code = e.emp_code
WHERE s.effective_from >= DATE '2026-07-26'
  AND ( (s.bank_name  IS NULL AND st.bank_name  IS NOT NULL)
     OR (s.account_no IS NULL AND st.account_no IS NOT NULL)
     OR (s.ifsc       IS NULL AND st.ifsc       IS NOT NULL)
     OR (s.uan        IS NULL AND st.uan        IS NOT NULL)
     OR (s.pan        IS NULL AND st.pan        IS NOT NULL) )
ORDER BY e.emp_code;

-- STEP 4: apply inside a transaction (rollback if the preview surprised you).
BEGIN;

UPDATE employee_salary_structure s
SET bank_name  = COALESCE(s.bank_name,  st.bank_name),
    account_no = COALESCE(s.account_no, st.account_no),
    ifsc       = COALESCE(s.ifsc,       st.ifsc),
    uan        = COALESCE(s.uan,        st.uan),
    pan        = COALESCE(s.pan,        st.pan)
FROM _patch111_staging st
JOIN employees e ON e.id = s.employee_id AND e.emp_code = st.emp_code
WHERE s.effective_from >= DATE '2026-07-26';

-- STEP 5: post-check — rows still missing any field (need manual HR entry).
SELECT e.emp_code, s.effective_from,
       s.bank_name IS NULL AS still_no_bank_name,
       s.account_no IS NULL AS still_no_account_no,
       s.ifsc IS NULL AS still_no_ifsc
FROM employee_salary_structure s
JOIN employees e ON e.id = s.employee_id
WHERE s.effective_from >= DATE '2026-07-26'
  AND (s.bank_name IS NULL OR s.account_no IS NULL OR s.ifsc IS NULL)
ORDER BY e.emp_code;

-- If satisfied: COMMIT; otherwise ROLLBACK. Then drop the staging table:
-- DROP TABLE _patch111_staging;
