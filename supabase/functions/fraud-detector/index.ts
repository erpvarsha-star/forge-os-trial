/**
 * fraud-detector
 *
 * Implements Workflow 11 (Fraud Detection) from the Master System Definition.
 *
 * 1. `{ "action": "gps_check", ... }` — called from `worker/home.tsx` on every
 *    check-in (added 13 Aug; this function was deployed but never invoked by
 *    anything before that). Client-side geofence math already blocks an
 *    obviously-outside check-in even offline, but never wrote a record
 *    anywhere — this is the only place that logs a `fraud_alerts` row for a
 *    detected mock-location app, and it's the one check a modified client
 *    can't silently skip. Rejects the check-in outright on either mock
 *    location or outside-geofence, but only mock location raises a
 *    management alert — being far from the plant on its own isn't fraud.
 *
 * 2. `{ "action": "bulk_confirmation_check", ... }` — NOT currently called by
 *    anything. `supervisor/team.tsx` has its own parallel, in-memory
 *    implementation of the same >10-in-90-seconds rule (see the comment
 *    there) that already writes to `fraud_alerts` correctly, but resets on
 *    remount and has no month-based escalation tiers. This action exists so
 *    that gap can be closed later by having team.tsx call here instead of
 *    duplicating the check client-side — not done now because it hasn't been
 *    tested against a real device pattern of confirmations. Escalates based
 *    on how many `fraud_alerts` this supervisor has this month (2 = notify
 *    HR Admin, 3+ = red alert to Owner + Plant Head) — tiers that never fire
 *    today because this path is unused.
 *
 * Both actions write to `fraud_alerts` (not `fraud_flags` — found and fixed
 * 13 Aug. `fraud_flags` is reserved for the buddy-device check only per
 * FINAL_SCHEMA's own "SECTION O" comment; writing here made mock-location and
 * bulk-confirm fraud invisible on every owner-facing screen, since
 * alerts.tsx/kpi.tsx/dashboard/index.html all read `fraud_alerts` only).
 */

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin, getPlantConfig } from '../_shared/supabaseAdmin.ts';
import { notifyEmployees } from '../_shared/push.ts';
import { distanceMeters } from '../_shared/geo.ts';

type GpsCheckBody = {
  action: 'gps_check';
  employeeId: string;
  lat: number;
  lng: number;
  mockLocationDetected?: boolean;
};

type BulkConfirmationCheckBody = {
  action: 'bulk_confirmation_check';
  supervisorId: string;
  employeeId: string;
  shiftDate: string; // YYYY-MM-DD
};

async function getManagementIds(db: ReturnType<typeof supabaseAdmin>, roles: string[]) {
  const { data } = await db.from('employees').select('id').in('role', roles).eq('is_active', true);
  return (data ?? []).map((e: { id: string }) => e.id);
}

async function handleGpsCheck(db: ReturnType<typeof supabaseAdmin>, body: GpsCheckBody) {
  // PATCH_21 — multi-point geofence (11 named campus locations: shops, the
  // office, the raw material yard — the campus is one contiguous site, so
  // any one of them counts). Falls back to the single-point plant_config
  // geofence when plant_locations is empty (PATCH_22 not yet run with real
  // coordinates) or doesn't exist yet, so this is safe to deploy ahead of
  // the seed data — behaviour is unchanged until that patch runs.
  const { data: locations } = await db
    .from('plant_locations')
    .select('latitude, longitude, radius_meters')
    .eq('is_active', true);

  let distance: number;
  let outsideGeofence: boolean;
  let geofenceMeters: number;

  if (locations && locations.length > 0) {
    const candidates = (locations as { latitude: number; longitude: number; radius_meters: number }[]).map((loc) => ({
      distance: distanceMeters(body.lat, body.lng, loc.latitude, loc.longitude),
      radius: loc.radius_meters,
    }));
    const nearest = candidates.reduce((a, b) => (b.distance < a.distance ? b : a));
    distance = nearest.distance;
    geofenceMeters = nearest.radius;
    outsideGeofence = !candidates.some((c) => c.distance <= c.radius);
  } else {
    const plantLat = await getPlantConfig(db, 'plant_lat', 19.8383935925407);
    const plantLng = await getPlantConfig(db, 'plant_lng', 75.23638998304483);
    geofenceMeters = await getPlantConfig(db, 'geofence_radius_meters', 100);
    distance = distanceMeters(body.lat, body.lng, plantLat, plantLng);
    outsideGeofence = distance > geofenceMeters;
  }

  const mockLocation = Boolean(body.mockLocationDetected);
  const blocked = outsideGeofence || mockLocation;

  // Only mock_location is a fraud_alerts type the schema recognises (CHECK:
  // mock_location/buddy_punching/bulk_confirm) — an employee who is simply
  // too far from the plant isn't fraud on its own, so outsideGeofence blocks
  // the check-in below but doesn't raise a management alert for it.
  if (mockLocation) {
    const { data: emp } = await db.from('employees').select('name').eq('id', body.employeeId).single();

    await db.from('fraud_alerts').insert({
      type: 'mock_location',
      employee_id: body.employeeId,
      description: `${emp?.name ?? 'An employee'}'s check-in was flagged for a mock-location app (${Math.round(distance)}m from plant)`,
      severity: 'high',
      status: 'open',
    });

    const managementIds = await getManagementIds(db, ['plant_head', 'owner']);
    await notifyEmployees(db, {
      employeeIds: managementIds,
      type: 'fraud_alert',
      title: 'Mock location detected',
      body: `${emp?.name ?? 'An employee'}'s check-in was flagged for a mock-location app`,
      relatedEntityType: 'fraud_alerts',
    });
  }

  return jsonResponse({
    allowed: !blocked,
    distanceMeters: Math.round(distance),
    geofenceMeters,
    reason: mockLocation ? 'mock_location_detected' : outsideGeofence ? 'outside_geofence' : null,
  });
}

async function handleBulkConfirmationCheck(db: ReturnType<typeof supabaseAdmin>, body: BulkConfirmationCheckBody) {
  const threshold = await getPlantConfig(db, 'bulk_confirmation_threshold', { count: 10, seconds: 90 });
  const windowStart = new Date(Date.now() - threshold.seconds * 1000).toISOString();

  const { data: recentConfirmations, error } = await db
    .from('attendance_records')
    .select('id, checkpoint3_at')
    .eq('checkpoint3_confirmed_by', body.supervisorId)
    .eq('date', body.shiftDate)
    .gte('checkpoint3_at', windowStart);

  if (error) return jsonResponse({ error: error.message }, 500);

  const count = recentConfirmations?.length ?? 0;
  if (count <= threshold.count) {
    return jsonResponse({ flagged: false, count });
  }

  const { data: supervisor } = await db
    .from('employees')
    .select('name')
    .eq('id', body.supervisorId)
    .single();

  // fraud_alerts, not fraud_flags — this is the type CHECK ('mock_location',
  // 'buddy_punching', 'bulk_confirm') recognises, and the table every
  // owner-facing screen (alerts.tsx, kpi.tsx, dashboard/index.html) actually
  // reads. fraud_flags is reserved for the buddy-device check only (see the
  // "SECTION O" comment in FINAL_SCHEMA) — writing bulk-confirm flags there
  // made them invisible everywhere management looks for them.
  await db.from('fraud_alerts').insert({
    type: 'bulk_confirm',
    employee_id: body.supervisorId,
    description: `${supervisor?.name ?? 'A supervisor'} confirmed ${count} workers in ${threshold.seconds} seconds`,
    severity: 'high',
    status: 'open',
  });

  const plantHeadIds = await getManagementIds(db, ['plant_head']);
  await notifyEmployees(db, {
    employeeIds: plantHeadIds,
    type: 'fraud_alert',
    title: 'Fraud alert',
    body: `${supervisor?.name ?? 'A supervisor'} confirmed ${count} workers in ${threshold.seconds} seconds`,
    relatedEntityType: 'fraud_alerts',
  });

  // Escalation tiers based on this supervisor's bulk-confirm alert count this month.
  const monthStart = new Date(body.shiftDate);
  monthStart.setDate(1);
  const { count: monthFlagCount } = await db
    .from('fraud_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', body.supervisorId)
    .eq('type', 'bulk_confirm')
    .gte('created_at', monthStart.toISOString());

  const flagsThisMonth = monthFlagCount ?? 0;

  if (flagsThisMonth === 2) {
    const hrAdminIds = await getManagementIds(db, ['hr_admin']);
    await notifyEmployees(db, {
      employeeIds: hrAdminIds,
      type: 'fraud_alert_escalation',
      title: '2nd fraud flag this month',
      body: `${supervisor?.name ?? 'A supervisor'} has 2 fraud flags this month — review recommended`,
      relatedEntityType: 'fraud_alerts',
    });
  } else if (flagsThisMonth >= 3) {
    const ownerAndPlantHeadIds = await getManagementIds(db, ['owner', 'plant_head']);
    await notifyEmployees(db, {
      employeeIds: ownerAndPlantHeadIds,
      type: 'fraud_alert_red',
      title: 'Red alert — repeat fraud flags',
      body: `${supervisor?.name ?? 'A supervisor'} has ${flagsThisMonth} fraud flags this month — HR Admin review mandatory`,
      relatedEntityType: 'fraud_alerts',
    });
  }

  return jsonResponse({ flagged: true, count, flagsThisMonth });
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: GpsCheckBody | BulkConfirmationCheckBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const db = supabaseAdmin();

  try {
    if (body.action === 'gps_check') return await handleGpsCheck(db, body);
    if (body.action === 'bulk_confirmation_check') return await handleBulkConfirmationCheck(db, body);
    return jsonResponse({ error: 'Unknown action. Use "gps_check" or "bulk_confirmation_check".' }, 400);
  } catch (err) {
    console.error('fraud-detector failed', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
