/**
 * Firebase Cloud Messaging v1 — send push directly, without Expo in the middle.
 *
 * WHY THIS EXISTS. Expo's push service is only a relay: it takes an
 * ExponentPushToken, looks up the FCM credentials you uploaded to your Expo
 * account, and forwards to FCM. That upload is a five-step wizard in the Expo
 * dashboard which asks for an Android upload keystore we do not have and do
 * not need — this project's APKs are built by GitHub Actions and signed with
 * the debug keystore, never by EAS. The wizard was blocking push entirely.
 *
 * Talking to FCM ourselves removes that dependency: no Expo account
 * credentials, no keystore, no wizard. The only thing needed is the Firebase
 * service account JSON, set once as a Supabase edge function secret.
 *
 * Trade-off, stated honestly: Expo's relay also handles iOS. This project is
 * Android-only (sideloaded APK, no Play Store, no iOS build), so that costs
 * us nothing today. If iOS ever happens, the Expo path is still in this file's
 * sibling push.ts and still works — see the token routing there.
 *
 * SETUP (one paste, in the Supabase dashboard):
 *   Edge Functions → Secrets → add FCM_SERVICE_ACCOUNT_JSON, pasting the whole
 *   service account JSON from Firebase → Project Settings → Service accounts →
 *   Generate new private key.
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
}

export interface FcmMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

/** Cached across calls within one function instance — the token lasts an hour. */
let cachedToken: { value: string; expiresAt: number } | null = null;

function loadServiceAccount(): ServiceAccount | null {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
      console.error('FCM_SERVICE_ACCOUNT_JSON is missing client_email, private_key or project_id');
      return null;
    }
    return parsed;
  } catch (err) {
    console.error('FCM_SERVICE_ACCOUNT_JSON is not valid JSON', err);
    return null;
  }
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** PEM (PKCS#8) → raw DER bytes for crypto.subtle.importKey. */
function pemToBytes(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    // Secrets managers often store the key with literal \n rather than newlines.
    .replace(/\\n/g, '')
    .replace(/\s/g, '');
  const binary = atob(body);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Google OAuth2 access token, via a service-account JWT assertion. */
async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value;

  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const enc = new TextEncoder();
  const unsigned =
    `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(claims)))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned))
  );
  const assertion = `${unsigned}.${b64url(signature)}`;

  const res = await fetch(claims.aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    console.error('FCM token exchange failed', res.status, await res.text());
    return null;
  }

  const json = await res.json() as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: now + (json.expires_in ?? 3600) };
  return json.access_token;
}

/**
 * Sends to FCM v1. Returns how many were accepted.
 *
 * v1 has no batch endpoint, so this is one request per device, ten at a time.
 * At 129 employees that is thirteen rounds — well within an edge function's
 * budget, and far simpler than the deprecated batch API.
 *
 * A 404 or 400 UNREGISTERED from FCM means the device uninstalled or the token
 * rotated; that token is returned in `stale` so the caller can delete it
 * rather than retrying it forever.
 */
export async function sendFcm(messages: FcmMessage[]): Promise<{ sent: number; stale: string[] }> {
  if (messages.length === 0) return { sent: 0, stale: [] };

  const sa = loadServiceAccount();
  if (!sa) {
    console.warn('FCM_SERVICE_ACCOUNT_JSON not set — skipping push (in-app notifications still delivered)');
    return { sent: 0, stale: [] };
  }

  const accessToken = await getAccessToken(sa);
  if (!accessToken) return { sent: 0, stale: [] };

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  let sent = 0;
  const stale: string[] = [];

  for (let i = 0; i < messages.length; i += 10) {
    const batch = messages.slice(i, i + 10);
    await Promise.all(batch.map(async (m) => {
      // FCM requires every data value to be a string.
      const data: Record<string, string> = {};
      for (const [k, v] of Object.entries(m.data ?? {})) {
        if (v !== undefined && v !== null) data[k] = String(v);
      }

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: m.token,
              notification: { title: m.title, body: m.body },
              data,
              android: { priority: 'high', notification: { channel_id: 'default' } },
            },
          }),
        });

        if (res.ok) { sent++; return; }

        const text = await res.text();
        if (res.status === 404 || text.includes('UNREGISTERED') || text.includes('INVALID_ARGUMENT')) {
          stale.push(m.token);
        }
        console.error('FCM send failed', res.status, text);
      } catch (err) {
        console.error('FCM send error', err);
      }
    }));
  }

  return { sent, stale };
}
