import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Service-role client for edge functions — bypasses RLS by design.
 * Every edge function in this repo acts as a trusted server-side process
 * (cron job or event handler), never on behalf of a single end user.
 */
export function supabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY edge function secrets.');
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Reads one `plant_config` row's value, with a fallback if the key is missing. */
export async function getPlantConfig<T>(
  db: ReturnType<typeof supabaseAdmin>,
  key: string,
  fallback: T
): Promise<T> {
  const { data } = await db.from('plant_config').select('config_value').eq('config_key', key).single();
  return (data?.config_value as T) ?? fallback;
}
