// Forge OS — shared AI review of ONE decided pay_run_warnings row.
// Single copy of the LLM logic: used by payroll-warning-review (one warning, owner alert ON)
// and payroll-warning-review-batch (whole run, owner alert OFF). Do not duplicate this elsewhere.
// Writes ONLY agent_verdict / agent_notes / agent_reviewed_at. Never touches decision or adjustments.
// On LLM/network/parse failure NOTHING is written, so the caller can retry.
// Secret: ANTHROPIC_API_KEY (Supabase -> Edge Functions -> Secrets).
import { buildUserPrompt, cutoffDateIst, extractReview, MODEL, ownerAlertRow, SYSTEM_PROMPT } from '../payroll-warning-review/lib/review.ts';

export type ReviewResult =
  | { ok: true; status: 200; body: Record<string, unknown>; skipped?: boolean; verdict?: string; notes?: string }
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string): ReviewResult => ({ ok: false, status, error });

export async function reviewWarning(
  supabase: any,
  warningId: string,
  opts: { supabaseUrl: string; notifyOwner?: boolean },
): Promise<ReviewResult> {
  const notifyOwner = opts.notifyOwner ?? true;
  const url = opts.supabaseUrl;
  try {
    const { data: w, error: wErr } = await supabase
      .from('pay_run_warnings')
      .select('id, run_id, employee_code, warning_type, detail, decision, agent_verdict, agent_notes, agent_reviewed_at')
      .eq('id', warningId).maybeSingle();
    if (wErr) return fail(500, wErr.message);
    if (!w) return fail(404, 'warning not found');
    if (w.decision === 'pending') return fail(409, 'warning not decided');
    if (w.agent_reviewed_at) {
      return { ok: true, status: 200, skipped: true, verdict: w.agent_verdict, notes: w.agent_notes,
        body: { ok: true, skipped: 'already reviewed', verdict: w.agent_verdict, notes: w.agent_notes } };
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
    if (!apiKey) {
      console.error('payroll-warning-review: ANTHROPIC_API_KEY not configured');
      return fail(502, 'ANTHROPIC_API_KEY not configured');
    }
    let text = '';
    let stopReason: string | null = null;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODEL, max_tokens: 4096, output_config: { effort: 'low' }, system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        let bodyText = '';
        try { bodyText = await res.text(); } catch (readErr) { bodyText = '<failed to read body: ' + String(readErr) + '>'; }
        console.error(`payroll-warning-review: llm http ${res.status}`, bodyText);
        return fail(502, `llm http ${res.status}`);
      }
      const out = await res.json();
      stopReason = out?.stop_reason ?? null;
      text = (out?.content ?? []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n');
    } catch (e) {
      console.error('payroll-warning-review: llm request failed: ' + String(e));
      return fail(502, 'llm request failed: ' + String(e));
    }

    const review = extractReview(text);
    if (!review) {
      console.error('payroll-warning-review: could not parse llm response', 'stop_reason=' + stopReason, text);
      return fail(502, 'could not parse llm response');
    }

    // ---- persist (only if still unreviewed)
    const { error: uErr } = await supabase.from('pay_run_warnings')
      .update({ agent_verdict: review.verdict, agent_notes: review.notes, agent_reviewed_at: new Date().toISOString() })
      .eq('id', w.id).is('agent_reviewed_at', null);
    if (uErr) {
      console.error('payroll-warning-review: save failed: ' + uErr.message);
      return fail(500, 'save failed: ' + uErr.message);
    }

    // ---- owner alert on concern (single mode only; best-effort; the review itself is already saved)
    let notified = false;
    if (notifyOwner && review.verdict === 'concern') {
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
    return { ok: true, status: 200, verdict: review.verdict, notes: review.notes,
      body: { ok: true, verdict: review.verdict, notes: review.notes, notified } };
  } catch (e) {
    console.error('payroll-warning-review: unexpected: ' + String(e));
    return fail(500, String(e));
  }
}
