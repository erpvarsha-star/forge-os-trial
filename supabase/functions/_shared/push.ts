import type { supabaseAdmin } from './supabaseAdmin.ts';

export interface NotifyInput {
  employeeIds: string[];
  type: string;
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

interface ExpoMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Writes an in-app `notifications` row for each employee and, if they have a
 * registered device, sends an Expo push message. Used by every edge function
 * that needs to alert someone (nightly-scoring, fraud-detector,
 * shift-reminder, mrm-reminder) so the delivery logic lives in one place —
 * the same logic `send-push-notification` exposes over HTTP for the app.
 */
export async function notifyEmployees(db: ReturnType<typeof supabaseAdmin>, input: NotifyInput) {
  const { employeeIds, type, title, body, relatedEntityType, relatedEntityId } = input;
  if (employeeIds.length === 0) return { notified: 0, pushed: 0 };

  const rows = employeeIds.map((user_id) => ({
    user_id,
    type,
    title,
    body,
    related_entity_type: relatedEntityType ?? null,
    related_entity_id: relatedEntityId ?? null,
  }));

  await db.from('notifications').insert(rows);

  const { data: tokens } = await db
    .from('push_tokens')
    .select('token')
    .in('user_id', employeeIds);

  const pushed = await sendExpoPush(
    (tokens ?? []).map((t: { token: string }) => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      data: { type, relatedEntityType, relatedEntityId },
    }))
  );

  return { notified: rows.length, pushed };
}

/** Sends messages to the Expo push API in batches of 100 (Expo's per-request limit). */
export async function sendExpoPush(messages: ExpoMessage[]): Promise<number> {
  if (messages.length === 0) return 0;

  const batches: ExpoMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) batches.push(messages.slice(i, i + 100));

  let sent = 0;
  for (const batch of batches) {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
      else console.error('Expo push batch failed', await res.text());
    } catch (err) {
      console.error('Expo push batch error', err);
    }
  }
  return sent;
}
