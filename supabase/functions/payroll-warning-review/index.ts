// Forge OS — payroll-warning-review (edge function, deploy with verify_jwt TRUE; self-contained).
// POST { warningId }: an AI second opinion on a decided (waived/deduct) pay_run_warnings row.
// Owner / hr_admin only. Idempotent: an already-reviewed warning is returned as-is.
// On LLM/network/parse failure NOTHING is written (502), so the caller can retry.
// LLM logic lives in ../_shared/warningReview.ts (single copy). Secret: ANTHROPIC_API_KEY (Supabase -> Edge Functions -> Secrets).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { reviewWarning } from '../_shared/warningReview.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);
  const { data: caller } = await supabase
    .from('employees').select('emp_code, role').eq('auth_user_id', user.id).single();
  if (!caller || !['owner', 'hr_admin'].includes(caller.role)) return json({ error: 'forbidden' }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const warningId = body?.warningId;
  if (!warningId || typeof warningId !== 'string') return json({ error: 'warningId required' }, 400);

  const r = await reviewWarning(supabase, warningId, { supabaseUrl: url, notifyOwner: true });
  return r.ok ? json(r.body) : json({ error: r.error }, r.status);
});
