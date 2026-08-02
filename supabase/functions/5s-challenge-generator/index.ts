/**
 * 5s-challenge-generator
 *
 * Generates one daily 5S housekeeping challenge per department to drive
 * floor engagement (supports Module 3 "brownie points" — completing a 5S
 * challenge is one of the ways a Member/Operator earns extra points).
 * Intended to run once daily (cron), early morning.
 *
 * Rotates through a fixed bank of prompts across the five 5S categories
 * (Sort, Set in Order, Shine, Standardize, Sustain) so the same department
 * doesn't see the same prompt too often — the rotation offset is derived
 * from the day-of-year and the department id so departments don't all get
 * the same prompt on the same day.
 */

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

interface ChallengeTemplate {
  category: 'sort' | 'set_in_order' | 'shine' | 'standardize' | 'sustain';
  en: string;
  hi: string;
}

const TEMPLATES: ChallengeTemplate[] = [
  { category: 'sort', en: 'Remove one item you don’t need from your workstation today.', hi: 'आज अपने वर्कस्थेशन से एक अनावश्यक वस्तु हटाएं।' },
  { category: 'sort', en: 'Check your toolbox — separate daily-use tools from rarely-used ones.', hi: 'अपना टूलबॉक्स चेक करें — रोज़ के इस्तेमाल वाले औज़ारों को कम इस्तेमाल वालों से अलग करें।' },
  { category: 'set_in_order', en: 'Label one unlabelled bin or shelf near your machine.', hi: 'अपनी मशीन के पास एक बिना लेबल वाले डब्बे या शेल्फ पर लेबल लगाएं।' },
  { category: 'set_in_order', en: 'Return every tool to its marked place before you leave today.', hi: 'आज जाने से पहले हर औज़ार को उसकी चिह्नित जगह पर वापस रखें।' },
  { category: 'shine', en: 'Wipe down your machine surface and control panel before shift end.', hi: 'शिफ्ट खत्म होने से पहले अपनी मशीन की सतह और कंट्रोल पैनल साफ करें।' },
  { category: 'shine', en: 'Clean up any oil or coolant spill in your work area.', hi: 'अपने कार्य क्षेत्र में किसी भी तेल या कूलेंट रिसाव को साफ करें।' },
  { category: 'standardize', en: 'Check the checklist for your station — is it up to date and visible?', hi: 'अपने स्थान की चेकलिस्ट देखें — क्या यह अप-टू-डेट और दिखने में है?' },
  { category: 'standardize', en: 'Confirm PPE (gloves, goggles, shoes) is being worn correctly by your team.', hi: 'पुष्टि करें कि आपकी टीम सही तरीके से PPE (ग्लव्स, चश्मा, जूते) पहन रही है।' },
  { category: 'sustain', en: 'Do a 2-minute walkthrough of your area and note one improvement idea.', hi: 'अपने क्षेत्र का 2 मिनट का वॉकथ्रू करें और एक सुधार विचार नोट करें।' },
  { category: 'sustain', en: 'Share one 5S tip with a colleague on your shift today.', hi: 'आज अपनी शिफ्ट में किसी साथी कर्मचारी के साथ एक 5S टिप साझा करें।' },
];

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start;
  return Math.floor(diff / 86400000);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const db = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const doy = dayOfYear(new Date());

  try {
    const { data: departments, error } = await db.from('departments').select('id, name');
    if (error) return jsonResponse({ error: error.message }, 500);

    const created: Array<{ department: string; category: string }> = [];

    for (const dept of departments ?? []) {
      const offset = (doy + hashString(dept.id)) % TEMPLATES.length;
      const template = TEMPLATES[offset];

      const { error: insertError } = await db
        .from('five_s_challenges')
        .upsert(
          {
            department_id: dept.id,
            challenge_date: today,
            challenge_text_en: template.en,
            challenge_text_hi: template.hi,
            category: template.category,
            points: 5,
          },
          { onConflict: 'department_id,challenge_date', ignoreDuplicates: true }
        );

      if (!insertError) created.push({ department: dept.name, category: template.category });
    }

    return jsonResponse({ date: today, generated: created.length, challenges: created });
  } catch (err) {
    console.error('5s-challenge-generator failed', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
