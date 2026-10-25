// Forge OS — payroll-warning-review (edge function, deploy with verify_jwt TRUE; self-contained).
// POST { warningId }: an AI second opinion on a decided (waived/deduct) pay_run_warnings row.
// Owner / hr_admin only. Idempotent: an already-reviewed warning is returned as-is.
// On LLM/network/parse failure NOTHING is written (502), so the caller can retry.
// Secret: ANTHROPIC_API_KEY (Supabase -> Edge Functions -> Secrets).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildUserPrompt, cutoffDateIst, extractReview, MODEL, ownerAlertRow, SYSTEM_PROMPT } from './lib/review.ts';

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

  try {
    const { data: w, error: wErr } = await supabase
      .from('pay_run_warnings')
      .select('id, run_id, employee_code, warning_type, detail, decision, agent_verdict, agent_notes, agent_reviewed_at')
      .eq('id', warningId).maybeSingle();
    if (wErr) return json({ error: wErr.message }, 500);
    if (!w) return json({ error: 'warning not found' }, 404);
    if (w.decision === 'pending') return json({ error: 'warning not decided' }, 409);
    if (w.agent_reviewed_at) {
      return json({ ok: true, skipped: 'already reviewed', verdict: w.agent_verdict, notes: w.agent_notes });
    }

    // ---- context (all keyed by employee_code)
    const { data: emp } = await supabase.from('employees').select('id').eq('emp_code', w.employee_code).maybeSingle();
    const since = cutoffDateIst(Date.now(), 3);
    let lateHistory: any[] = [];
    if (emp?.id) {
      const { data } = await supabase.from('attendance_records')
        .select('date, late_minutes, late_reason').eq('employee_id', emp.id)
        .gt('late_minutes', 0).gte('date', since).order('date', { ascending: true });
      lateHistory = data ?? [];
    }
    const { data: prior } = await supabase.from('pay_run_warnings')
      .select('warning_type, decision, detail').eq('employee_code', w.employee_code).neq('id', w.id)
      .order('created_at', { ascending: false }).limit(60);
    const count = async (decisions: string[]) => {
      const { count: c } = await supabase.from('pay_run_warnings')
        .select('id', { count: 'exact', head: true }).in('decision', decisions);
      return c ?? 0;
    };
    const [waived, decided] = await Promise.all([count(['waived']), count(['waived', 'deduct'])]);

    const prompt = buildUserPrompt({
      employeeCode: w.employee_code,
      warning: { type: w.warning_type, decision: w.decision, detail: w.detail },
      lateHistory,
      priorWarnings: (prior ?? []).map((p: any) => ({
        warning_type: p.warning_type, decision: p.decision, date: p.detail?.date ?? null })),
      plantWide: { waived, decided },
    });

    // ---- Anthropic Messages API
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 502);
    let text = '';
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODEL, max_tokens: 400, temperature: 0, system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) return json({ error: `llm http ${res.status}` }, 502);
      const out = await res.json();
      text = (out?.content ?? []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n');
    } catch (e) { return json({ error: 'llm request failed: ' + String(e) }, 502); }

    const review = extractReview(text);
    if (!review) return json({ error: 'could not parse llm response' }, 502);

    // ---- persist (only if still unreviewed)
    const { error: uErr } = await supabase.from('pay_run_warnings')
      .update({ agent_verdict: review.verdict, agent_notes: review.notes, agent_reviewed_at: new Date().toISOString() })
      .eq('id', w.id).is('agent_reviewed_at', null);
    if (uErr) return json({ error: 'save failed: ' + uErr.message }, 500);

    // ---- owner alert on concern (best-effort; the review itself is already saved)
    let notified = false;
    if (review.verdict === 'concern') {
      try {
        const { data: dup } = await supabase.from('app_notifications').select('id')
          .eq('type', 'clean_chit_alert').eq('payload->>warning_id', w.id).limit(1);
        if (!dup?.length) {
          const { data: owners } = await supabase.from('employees')
            .select('emp_code').eq('role', 'owner').eq('is_active', true);
          const codes = (owners ?? []).map((o: any) => o.emp_code).filter(Boolean);
          const rows = codes.map((c: string) => ownerAlertRow(c, {
            warningId: w.id, employeeCode: w.employee_code, decision: w.decision, notes: review.notes }));
          if (rows.length) {
            const { error: iErr } = await supabase.from('app_notifications').insert(rows);
            if (iErr) throw new Error(iErr.message);
            notified = true;
            try {
              await fetch(`${url}/functions/v1/send-push-notification`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  employeeCodes: codes, type: 'clean_chit_alert',
                  title: `${rows[0].title_en} / ${rows[0].title_hi}`, body: rows[0].body_en,
                  relatedEntityType: 'pay_run_warnings', relatedEntityId: w.id, skipInApp: true,
                }),
              });
            } catch (e) { console.error('push failed', String(e)); }
          }
        }
      } catch (e) { console.error('owner alert failed', String(e)); }
    }
    return json({ ok: true, verdict: review.verdict, notes: review.notes, notified });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
