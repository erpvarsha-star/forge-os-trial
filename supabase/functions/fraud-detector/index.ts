/**
 * fraud-detector
 *
 * Implements Workflow 11 (Fraud Detection) from the Master System Definition.
 * Called by the app at two points:
 *
 * 1. After every Checkpoint 1 GPS+QR check-in — `{ "action": "gps_check", ... }`
 *    - Rejects check-in outright if outside the 100m geofence (not just a
 *      warning) and flags mock-location apps if the client detected one.
 *
 * 2. After every Checkpoint 3 supervisor confirmation on the Team tab —
 *    `{ "action": "bulk_confirmation_check", ... }`
 *    - Flags a supervisor who confirms more than 10 employees within 90
 *      seconds, and escalates based on how many flags they've accumulated
 *      this month (2 = notify HR Admin, 3+ = red alert to Owner + Plant Head).
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
  const plantLat = await getPlantConfig(db, 'gps_lat', 19.8383935925407);
  const plantLng = await getPlantConfig(db, 'gps_lng', 75.23638998304483);
  const geofenceMeters = await getPlantConfig(db, 'geofence_meters', 100);

  const distance = distanceMeters(body.lat, body.lng, plantLat, plantLng);
  const outsideGeofence = distance > geofenceMeters;
  const mockLocation = Boolean(body.mockLocationDetected);
  const blocked = outsideGeofence || mockLocation;

  if (mockLocation) {
    await db.from('fraud_flags').insert({
      flag_type: 'mock_location',
      employee_id: body.employeeId,
      details: { lat: body.lat, lng: body.lng, distance_meters: distance },
    });
  } else if (outsideGeofence) {
    await db.from('fraud_flags').insert({
      flag_type: 'gps_outside_radius',
      employee_id: body.employeeId,
      details: { lat: body.lat, lng: body.lng, distance_meters: distance, geofence_meters: geofenceMeters },
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
    .from('attendance')
    .select('id, checkpoint3_at')
    .eq('checkpoint3_confirmed_by', body.supervisorId)
    .eq('shift_date', body.shiftDate)
    .gte('checkpoint3_at', windowStart);

  if (error) return jsonResponse({ error: error.message }, 500);

  const count = recentConfirmations?.length ?? 0;
  if (count <= threshold.count) {
    return jsonResponse({ flagged: false, count });
  }

  await db.from('fraud_flags').insert({
    flag_type: 'bulk_confirmation',
    supervisor_id: body.supervisorId,
    employee_id: body.employeeId,
    confirmations_count: count,
    seconds_elapsed: threshold.seconds,
    details: { shift_date: body.shiftDate },
  });

  const { data: supervisor } = await db
    .from('employees')
    .select('full_name')
    .eq('id', body.supervisorId)
    .single();

  const plantHeadIds = await getManagementIds(db, ['plant_head']);
  await notifyEmployees(db, {
    employeeIds: plantHeadIds,
    type: 'fraud_alert',
    title: 'Fraud alert',
    body: `${supervisor?.full_name ?? 'A supervisor'} confirmed ${count} workers in ${threshold.seconds} seconds`,
    relatedEntityType: 'fraud_flags',
  });

  // Escalation tiers based on this supervisor's flag count this month.
  const monthStart = new Date(body.shiftDate);
  monthStart.setDate(1);
  const { count: monthFlagCount } = await db
    .from('fraud_flags')
    .select('id', { count: 'exact', head: true })
    .eq('supervisor_id', body.supervisorId)
    .gte('created_at', monthStart.toISOString());

  const flagsThisMonth = monthFlagCount ?? 0;

  if (flagsThisMonth === 2) {
    const hrAdminIds = await getManagementIds(db, ['hr_admin']);
    await notifyEmployees(db, {
      employeeIds: hrAdminIds,
      type: 'fraud_alert_escalation',
      title: '2nd fraud flag this month',
      body: `${supervisor?.full_name ?? 'A supervisor'} has 2 fraud flags this month — review recommended`,
      relatedEntityType: 'fraud_flags',
    });
  } else if (flagsThisMonth >= 3) {
    const ownerAndPlantHeadIds = await getManagementIds(db, ['owner', 'plant_head']);
    await notifyEmployees(db, {
      employeeIds: ownerAndPlantHeadIds,
      type: 'fraud_alert_red',
      title: 'Red alert — repeat fraud flags',
      body: `${supervisor?.full_name ?? 'A supervisor'} has ${flagsThisMonth} fraud flags this month — HR Admin review mandatory`,
      relatedEntityType: 'fraud_flags',
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
