// Forge OS — payroll-warning-review-batch (edge function, deployed with --no-verify-jwt via deploy.sh).
// POST { runId, limit? }: AI-reviews every decided (waived/deduct) warning of one pay run that has not
// been reviewed yet, sequentially, using the SAME logic as payroll-warning-review (_shared/warningReview.ts).
// WRITES ONLY the verdict fields (agent_verdict/agent_notes/agent_reviewed_at). Never inserts/updates/clears a
// decision, never inserts a payroll_adjustments row, never touches pay_runs. Per-row owner alerts are OFF.
// Invoked server-side (pg_net) with no Authorization header, so no key is written to SQL or chat.
// Because verify_jwt is off, this does nothing a retry of the existing review wouldn't do; it is idempotent.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { reviewWarning } from '../_shared/warningReview.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DEFAULT_LIMIT = 150;
const HARD_CAP = 300;
const DELAY_MS = 300;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const runId = body?.runId;
  if (!runId || typeof runId !== 'string') return json({ error: 'runId required' }, 400);
  let limit = Number(body?.limit ?? DEFAULT_LIMIT);
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  limit = Math.min(Math.floor(limit), HARD_CAP);

  const url = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: rows, error: qErr } = await supabase
    .from('pay_run_warnings')
    .select('id, employee_code')
    .eq('run_id', runId).in('decision', ['waived', 'deduct']).is('agent_reviewed_at', null)
    .order('created_at', { ascending: true }).limit(limit);
  if (qErr) {
    console.error('payroll-warning-review-batch: candidate query failed: ' + qErr.message);
    return json({ error: qErr.message }, 500);
  }
  const candidates = rows ?? [];

  let reviewed = 0, agreed = 0, failed = 0;
  const concern: { warningId: string; employeeCode: string; notes?: string }[] = [];
  const errors: { warningId: string; message: string }[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    try {
      const r = await reviewWarning(supabase, c.id, { supabaseUrl: url, notifyOwner: false });
      if (!r.ok) {
        failed++;
        console.error(`payroll-warning-review-batch: ${c.id} (${c.employee_code}) failed ${r.status}: ${r.error}`);
        errors.push({ warningId: c.id, message: `${r.status}: ${r.error}` });
      } else if (r.skipped) {
        // already reviewed by someone else meanwhile; not counted
      } else {
        reviewed++;
        if (r.verdict === 'concern') concern.push({ warningId: c.id, employeeCode: c.employee_code, notes: r.notes });
        else agreed++;
      }
    } catch (e) {
      failed++;
      console.error(`payroll-warning-review-batch: ${c.id} (${c.employee_code}) threw: ${String(e)}`);
      errors.push({ warningId: c.id, message: String(e) });
    }
    if (i < candidates.length - 1) await sleep(DELAY_MS);
  }

  let readyToCalculate: boolean | null = null;
  const { data: ready, error: rErr } = await supabase.rpc('pay_run_ready_to_calculate', { p_run_id: runId });
  if (rErr) console.error('payroll-warning-review-batch: readiness rpc failed: ' + rErr.message);
  else readyToCalculate = ready === true;

  return json({ runId, candidates: candidates.length, reviewed, agreed, concern, failed, readyToCalculate, errors });
});
