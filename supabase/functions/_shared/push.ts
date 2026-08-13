import type { supabaseAdmin } from './supabaseAdmin.ts';
import { sendFcm } from './fcm.ts';

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

  // Never swallow this. It failed silently for every edge function until
  // 12 Aug, because push.ts writes related_entity_type/related_entity_id and
  // the deployed schema (FINAL_SCHEMA) had neither column — PostgREST
  // rejected the insert with PGRST204 and nobody saw it. PATCH_14 adds the
  // columns; this check is what stops the next such mismatch from hiding.
  const { error: insertError } = await db.from('notifications').insert(rows);
  if (insertError) {
    console.error('notifications insert failed', { type, count: rows.length, error: insertError });
    throw new Error(`notifications insert failed: ${insertError.message}`);
  }

  const { data: tokens } = await db
    .from('push_tokens')
    .select('token')
    .in('user_id', employeeIds);

  const all = (tokens ?? []).map((t: { token: string }) => t.token).filter(Boolean);

  // Two kinds of token can be in this table, so route on shape rather than on
  // a config flag that could disagree with reality:
  //   ExponentPushToken[…]  — issued by getExpoPushTokenAsync, relayed by Expo
  //   anything else         — a native FCM registration token, sent directly
  //
  // Devices registered before 13 Aug hold Expo tokens; devices on the build
  // after it hold FCM ones. Both work, so the switch needs no flag day and no
  // forced reinstall to avoid breaking the ones already out there.
  const expoTokens = all.filter((t: string) => t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'));
  const fcmTokens = all.filter((t: string) => !expoTokens.includes(t));

  const expoSent = await sendExpoPush(
    expoTokens.map((to: string) => ({
      to,
      sound: 'default' as const,
      title,
      body,
      data: { type, relatedEntityType, relatedEntityId },
    }))
  );

  const fcm = await sendFcm(
    fcmTokens.map((token: string) => ({
      token,
      title,
      body,
      data: { type, relatedEntityType, relatedEntityId },
    }))
  );

  // A token FCM rejects as unregistered belongs to an uninstalled app. Left in
  // place it is retried on every notification forever, so it is cleared here.
  if (fcm.stale.length > 0) {
    await db.from('push_tokens').delete().in('token', fcm.stale);
    console.log(`cleared ${fcm.stale.length} stale push token(s)`);
  }

  return { notified: rows.length, pushed: expoSent + fcm.sent };
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
