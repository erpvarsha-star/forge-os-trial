// accounts-advance-recovery-reminder — nudges whoever matches
// role='manager' AND department='Accounts' (dynamic match — the EXACT
// mechanism the Accounts stage of the staged advance-approval chain already
// uses, see PATCH_53's review_advance_request: `v_my_role = 'manager' and
// v_my_dept = 'Accounts'`. Today this resolves to Bharat Salve (VFL5462),
// but this query never hardcodes his emp_code — if he's replaced or a
// second Accounts manager is added, this keeps working unchanged, exactly
// like the approval RPC itself). Built 5 Nov 2026 (round 6), owner: "create
// plan for this and start working at 5.30 am ist on it" (see PENDING.md
// RESUME STATE "round 6").
//
// Scope ("needs attention"): advance_requests rows where
//   status='pending'
//   OR (status='approved' AND (monthly_deduction IS NULL OR monthly_deduction = 0))
// i.e. both today's live gaps (VFL1556 "Child education" ₹50,000,
// VFL5324 "hospital work" ₹20,000 — both pending, monthly_deduction=0,
// confirmed live before writing this, never hardcoded into the query) AND
// any future approved advance someone forgot to put a real recovery amount
// on. Query is live/dynamic — no employee ids or amounts are baked in.
//
// verify_jwt FALSE, same reminder-function pattern as the rest of this
// project. Cron job (separate patch file) sends a dummy but PRESENT
// Authorization header — never omit it, see
// plant-head-efficiency-reminder's comment / CLAUDE.md for the exact bug
// this avoids (pune-attendance-reminder's cron silently dropped every
// request for 9 days because its header had no Authorization key at all).

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { istDateStr } from '../_shared/istDate.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const db = supabaseAdmin();
    const today = istDateStr();

    const { data: pending, error: pErr } = await db
      .from('advance_requests').select('id, employee_id, amount, reason, status, monthly_deduction')
      .eq('status', 'pending');
    if (pErr) return jsonResponse({ error: pErr.message }, 500);

    const { data: approvedNoDeduction, error: nErr } = await db
      .from('advance_requests').select('id, employee_id, amount, reason, status, monthly_deduction')
      .eq('status', 'approved')
      .or('monthly_deduction.is.null,monthly_deduction.eq.0');
    if (nErr) return jsonResponse({ error: nErr.message }, 500);

    const rowsNeedingAttention = [...(pending ?? []), ...(approvedNoDeduction ?? [])];
    const totalPending = rowsNeedingAttention.length;
    if (totalPending === 0) return jsonResponse({ skipped: 'nothing pending' });

    const pendingCount = pending?.length ?? 0;
    const approvedNoDeductionCount = approvedNoDeduction?.length ?? 0;

    // Dynamic Accounts-stage match — same shape as PATCH_53's
    // review_advance_request RPC, never a hardcoded emp_code.
    const { data: accountsManagers, error: aErr } = await db
      .from('employees').select('emp_code')
      .eq('is_active', true).eq('role', 'manager').eq('department', 'Accounts');
    if (aErr) return jsonResponse({ error: aErr.message }, 500);
    const recipients = [...new Set((accountsManagers ?? []).map((e: any) => e.emp_code))];
    if (!recipients.length) return jsonResponse({ skipped: 'no accounts-manager recipients', totalPending });

    const { data: already, error: dErr } = await db.from('app_notifications').select('employee_code')
      .eq('type', 'accounts_advance_recovery_reminder').eq('payload->>date', today).in('employee_code', recipients);
    if (dErr) return jsonResponse({ error: dErr.message }, 500);
    const done = new Set((already ?? []).map((r: any) => r.employee_code));
    const todo = recipients.filter((c) => !done.has(c));
    if (!todo.length) return jsonResponse({ skipped: 'already reminded', totalPending, date: today });

    const bodyEn = `${totalPending} advance request(s) need a monthly recovery amount set ` +
      `(${pendingCount} pending, ${approvedNoDeductionCount} approved with no deduction).`;
    const bodyHi = `${totalPending} एडवांस रिक्वेस्ट के लिए मासिक रिकवरी राशि तय करनी बाकी है ` +
      `(${pendingCount} लंबित, ${approvedNoDeductionCount} स्वीकृत पर कोई कटौती नहीं)।`;

    const rows = todo.map((employee_code) => ({
      employee_code, type: 'accounts_advance_recovery_reminder',
      title_en: 'Advance recovery amount needed', title_hi: 'एडवांस रिकवरी राशि आवश्यक है',
      body_en: bodyEn, body_hi: bodyHi,
      payload: { date: today, pendingCount, approvedNoDeductionCount, totalPending },
    }));
    const { error: iErr } = await db.from('app_notifications').insert(rows);
    if (iErr) return jsonResponse({ error: iErr.message }, 500);

    let pushed = 0, pushError: string | undefined;
    try {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeCodes: todo, type: 'accounts_advance_recovery_reminder',
          title: 'Advance recovery amount needed / एडवांस रिकवरी राशि आवश्यक है',
          body: bodyEn, skipInApp: true,
        }),
      });
      if (res.ok) pushed = todo.length; else pushError = `push http ${res.status}`;
    } catch (e) { pushError = String(e); }

    return jsonResponse({
      pendingCount, approvedNoDeductionCount, totalPending,
      notified: todo.length, pushed, date: today, ...(pushError ? { pushError } : {}),
    });
  } catch (e) {
    console.error('accounts-advance-recovery-reminder failed', e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
