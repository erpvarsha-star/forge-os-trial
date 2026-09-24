-- PATCH_39: Device lock + checkout QR column
-- 24 Sep 2026
--
-- 1. device_registrations — one device ↔ one employee, permanent until HR resets it.
--    All writes go through register_device() / clear_device_registration() (SECURITY DEFINER)
--    so clients can never insert/update directly.
--
-- 2. attendance_records.check_out_qr_verified — data collection only until 15 Oct 2026.
--    Same pattern as qr_verified (entry); exit QR scanned at the gate when leaving.

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. device_registrations
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.device_registrations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     TEXT        NOT NULL UNIQUE,
  employee_id   UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_reg_employee_id
  ON public.device_registrations(employee_id);

ALTER TABLE public.device_registrations ENABLE ROW LEVEL SECURITY;

-- Employee can see their own registration; management sees all.
CREATE POLICY device_reg_select ON public.device_registrations
  FOR SELECT USING (employee_id = current_employee_id() OR is_management());

-- Only management (HR admin) may delete (= reset) a registration.
CREATE POLICY device_reg_delete ON public.device_registrations
  FOR DELETE USING (is_management());

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. register_device — called from loadEmployee() on every app open.
--    Returns: {allowed: true} or {allowed: false, reason: 'DEVICE_TAKEN', registered_to: emp_code}
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_device(p_device_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id       UUID;
  v_existing_emp_id   UUID;
  v_existing_emp_code TEXT;
BEGIN
  -- Resolve the calling employee (will be NULL if somehow called unauthenticated)
  SELECT id INTO v_employee_id
  FROM employees WHERE auth_user_id = auth.uid();

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'NOT_AUTHENTICATED');
  END IF;

  -- Check for an existing registration on this device to a DIFFERENT employee
  SELECT dr.employee_id, e.emp_code
  INTO v_existing_emp_id, v_existing_emp_code
  FROM device_registrations dr
  JOIN employees e ON e.id = dr.employee_id
  WHERE dr.device_id = p_device_id;

  IF FOUND AND v_existing_emp_id <> v_employee_id THEN
    RETURN jsonb_build_object(
      'allowed',        false,
      'reason',         'DEVICE_TAKEN',
      'registered_to',  v_existing_emp_code
    );
  END IF;

  -- Register (or confirm existing own registration)
  INSERT INTO device_registrations (device_id, employee_id)
  VALUES (p_device_id, v_employee_id)
  ON CONFLICT (device_id) DO UPDATE SET employee_id = EXCLUDED.employee_id;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. clear_device_registration — HR admin resets a device so the employee can
--    log in on a new phone without being locked out.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clear_device_registration(p_employee_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_management() THEN
    RAISE EXCEPTION 'Permission denied: management only';
  END IF;
  DELETE FROM device_registrations WHERE employee_id = p_employee_id;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. checkout QR column — data collection only until 15 Oct 2026
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS check_out_qr_verified BOOLEAN NOT NULL DEFAULT FALSE;
