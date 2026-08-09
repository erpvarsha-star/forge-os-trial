/**
 * send-push-notification
 *
 * Generic notification dispatcher used by the app (e.g. a manager assigning
 * a task) and callable by any other edge function. Writes an in-app
 * `notifications` row per recipient and, if a device is registered, sends an
 * Expo push message.
 *
 * POST body:
 * {
 *   "employeeIds": ["uuid", ...],   // or "employeeCodes": ["VFL1001", ...]
 *   "type": "task_assigned",
 *   "title": "New task assigned",
 *   "body": "Fill weekly shift plan by Thursday 18:00",
 *   "relatedEntityType": "tasks",   // optional
 *   "relatedEntityId": "uuid"       // optional
 * }
 */

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { notifyEmployees } from '../_shared/push.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { type, title, body } = payload as { type?: string; title?: string; body?: string };
  let employeeIds = (payload.employeeIds as string[] | undefined) ?? [];
  const employeeCodes = payload.employeeCodes as string[] | undefined;

  if (!type || !title || !body) {
    return jsonResponse({ error: 'type, title, and body are required' }, 400);
  }
  if (employeeIds.length === 0 && (!employeeCodes || employeeCodes.length === 0)) {
    return jsonResponse({ error: 'employeeIds or employeeCodes is required' }, 400);
  }

  const db = supabaseAdmin();

  if (employeeIds.length === 0 && employeeCodes && employeeCodes.length > 0) {
    const { data, error } = await db.from('employees').select('id').in('emp_code', employeeCodes);
    if (error) return jsonResponse({ error: error.message }, 500);
    employeeIds = (data ?? []).map((e: { id: string }) => e.id);
  }

  try {
    const result = await notifyEmployees(db, {
      employeeIds,
      type,
      title,
      body,
      relatedEntityType: payload.relatedEntityType as string | undefined,
      relatedEntityId: payload.relatedEntityId as string | undefined,
    });
    return jsonResponse({ success: true, ...result });
  } catch (err) {
    console.error('send-push-notification failed', err);
    return jsonResponse({ error: 'Failed to send notifications' }, 500);
  }
});
