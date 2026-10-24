// payslip_ready notifications (function-local). Best-effort: callers must never fail a finalize on this.

export const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];
export const MONTHS_HI = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त',
  'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];

export const monthLabelEn = (m: number, y: number) => `${MONTHS_EN[m - 1]} ${y}`;
export const monthLabelHi = (m: number, y: number) => `${MONTHS_HI[m - 1]} ${y}`;

export function buildPayslipRows(empCodes: string[], runId: string, month: number, year: number) {
  return [...new Set(empCodes)].map((employee_code) => ({
    employee_code,
    type: 'payslip_ready',
    title_en: 'Payslip ready',
    title_hi: 'वेतन पर्ची तैयार है',
    body_en: `Your payslip for ${monthLabelEn(month, year)} is ready.`,
    body_hi: `${monthLabelHi(month, year)} की आपकी वेतन पर्ची तैयार है।`,
    payload: { run_id: runId, month, year },
  }));
}

export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export interface NotifyResult { inserted: number; pushed: number; skipped?: string; error?: string }

/** Never throws. `supabase` is a service-role client. */
export async function notifyPayslipReady(
  supabase: any, supabaseUrl: string, runId: string, month: number, year: number,
): Promise<NotifyResult> {
  const result: NotifyResult = { inserted: 0, pushed: 0 };
  try {
    const { data: existing, error: exErr } = await supabase.from('app_notifications')
      .select('id').eq('type', 'payslip_ready').eq('payload->>run_id', runId).limit(1);
    if (exErr) throw new Error('idempotency check: ' + exErr.message);
    if (existing?.length) return { ...result, skipped: 'already notified' };

    const { data: items, error: iErr } = await supabase
      .from('pay_run_items').select('employee_id').eq('pay_run_id', runId);
    if (iErr) throw new Error('items: ' + iErr.message);
    const ids = [...new Set((items ?? []).map((i: any) => i.employee_id))];
    const codes: string[] = [];
    for (const part of chunk(ids, 100)) {
      const { data: emps, error: eErr } = await supabase.from('employees').select('emp_code').in('id', part);
      if (eErr) throw new Error('employees: ' + eErr.message);
      for (const e of emps ?? []) if (e.emp_code) codes.push(e.emp_code);
    }
    const rows = buildPayslipRows(codes, runId, month, year);
    for (const part of chunk(rows, 100)) {
      const { error } = await supabase.from('app_notifications').insert(part);
      if (error) { result.error = 'insert: ' + error.message; break; }
      result.inserted += part.length;
    }
    if (result.inserted > 0) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeCodes: rows.map((r) => r.employee_code), type: 'payslip_ready',
            title: 'Payslip ready / वेतन पर्ची तैयार', body: rows[0].body_en,
            relatedEntityType: 'pay_runs', relatedEntityId: runId, skipInApp: true,
          }),
        });
        if (res.ok) result.pushed = rows.length;
        else result.error = (result.error ? result.error + '; ' : '') + `push http ${res.status}`;
      } catch (e) { result.error = (result.error ? result.error + '; ' : '') + 'push: ' + String(e); }
    }
  } catch (e) {
    result.error = String(e);
  }
  return result;
}
