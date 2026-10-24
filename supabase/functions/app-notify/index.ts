// Forge OS — app-notify (edge function, deploy with verify_jwt TRUE; self-contained, not in deploy.sh).
// Actions (POST body.action):
//   advance_decision { advanceId }  -> notify requester once the advance is finally approved/rejected
//                                      (caller role: owner / plant_head / hr_admin / manager)
//   mark_read { ids? }              -> mark the caller's own unread app_notifications as read
// Caller identity always comes from the JWT; no client-supplied employee code is trusted.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const inr = (n: number) => '₹' + Number(n).toLocaleString('en-IN');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const { action } = body ?? {};

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);
  const { data: caller } = await supabase
    .from('employees').select('emp_code, role').eq('auth_user_id', user.id).single();
  if (!caller) return json({ error: 'forbidden' }, 403);

  try {
    // ------------------------------------------------------- advance_decision
    if (action === 'advance_decision') {
      if (!['owner', 'plant_head', 'hr_admin', 'manager'].includes(caller.role)) {
        return json({ error: 'forbidden' }, 403);
      }
      const { advanceId } = body;
      if (!advanceId) return json({ error: 'advanceId required' }, 400);
      const { data: adv } = await supabase
        .from('advance_requests').select('id, employee_id, amount, status').eq('id', advanceId).single();
      if (!adv) return json({ error: 'advance not found' }, 404);
      // Intermediate stage approvals leave status 'pending' (PATCH_53): do not notify.
      if (adv.status !== 'approved' && adv.status !== 'rejected') {
        return json({ ok: true, notified: false, status: adv.status });
      }
      const type = adv.status === 'approved' ? 'advance_approved' : 'advance_rejected';
      const { data: dup } = await supabase.from('app_notifications').select('id')
        .eq('type', type).eq('payload->>advance_id', String(adv.id)).limit(1);
      if (dup?.length) return json({ ok: true, notified: false, status: adv.status });

      const { data: emp } = await supabase.from('employees').select('emp_code').eq('id', adv.employee_id).single();
      if (!emp?.emp_code) return json({ error: 'requester not found' }, 404);

      const amt = inr(adv.amount);
      const approved = adv.status === 'approved';
      const row = {
        employee_code: emp.emp_code, type,
        title_en: approved ? 'Advance approved' : 'Advance rejected',
        title_hi: approved ? 'अग्रिम स्वीकृत' : 'अग्रिम अस्वीकृत',
        body_en: approved ? `Your advance request of ${amt} has been approved.` : `Your advance request of ${amt} was not approved.`,
        body_hi: approved ? `आपका ${amt} का अग्रिम अनुरोध स्वीकृत हो गया है।` : `आपका ${amt} का अग्रिम अनुरोध स्वीकृत नहीं हुआ।`,
        payload: { advance_id: adv.id, amount: adv.amount },
      };
      const { error: insErr } = await supabase.from('app_notifications').insert(row);
      if (insErr) return json({ error: insErr.message }, 500);

      // Push is best-effort; the in-app row above is the record.
      try {
        await fetch(`${url}/functions/v1/send-push-notification`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeCodes: [emp.emp_code], type,
            title: `${row.title_en} / ${row.title_hi}`, body: row.body_en,
            relatedEntityType: 'advance_requests', relatedEntityId: String(adv.id), skipInApp: true,
          }),
        });
      } catch (e) { console.error('push failed', String(e)); }
      return json({ ok: true, notified: true, status: adv.status });
    }

    // -------------------------------------------------------------- mark_read
    if (action === 'mark_read') {
      let q = supabase.from('app_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('employee_code', caller.emp_code).is('read_at', null);
      if (Array.isArray(body.ids) && body.ids.length) q = q.in('id', body.ids);
      const { data, error } = await q.select('id');
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, updated: data?.length ?? 0 });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
