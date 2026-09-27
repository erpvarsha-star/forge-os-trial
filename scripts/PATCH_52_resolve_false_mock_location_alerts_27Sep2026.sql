-- PATCH_52 — resolve false-positive mock_location fraud_alerts for VFL4057
-- (27 Sep 2026, session continuation)
--
-- Root cause found and fixed in the app code (app/(worker)/home.tsx +
-- components/CheckInCard.tsx): the mock-location fraud check used
-- `!Location.getProviderStatusAsync().gpsAvailable` as its mock-GPS signal.
-- That's wrong — it answers "is a GPS satellite fix currently available",
-- not "is this location spoofed". It is false for perfectly legitimate
-- check-ins with a weak/no satellite fix, e.g. indoors in this plant's
-- steel-frame shop buildings. Replaced with the real signal expo-location
-- (~17.0.0, already installed) exposes for this:
-- `location.coords.mocked` (Android only).
--
-- VFL4057 (Devendrakumar Jagdish Singh, Maintenance supervisor) hit this
-- exactly: 10 open, high-severity mock_location alerts on 26 Sep 2026,
-- zero ever-recorded attendance rows, device re-registered that same
-- morning. He was never using fake GPS — the app was misreading a weak
-- indoor fix as fraud and silently blocking his check-in every time.
--
-- This patch only resolves the 10 stale false-positive alerts so the
-- fraud_alerts list (app/(owner)/alerts.tsx) doesn't keep showing them as
-- open high-severity items. It does not touch any other employee's alerts.

update fraud_alerts
set
  status = 'resolved',
  description = description || ' — RESOLVED 27 Sep 2026: false positive, caused by a mock-location detection bug (checked GPS-provider availability, not actual mock-GPS) fixed the same day. Not an actual fraud case.'
where employee_id = (select id from employees where emp_code = 'VFL4057')
  and type = 'mock_location'
  and status = 'open'
  and created_at::date = '2026-09-26';
