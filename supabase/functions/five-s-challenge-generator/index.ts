/**
 * five-s-challenge-generator
 *
 * Generates one 5S housekeeping challenge for today by calling DeepSeek,
 * and writes it to the "5s_challenges" table (quoted — table name starts
 * with a digit) in the shape app/(worker)/5s.tsx actually reads: one row
 * per day (unique on `date`), no per-department rows — the app's own
 * query never filters by department, just `.eq('date', today)`.
 *
 * Intended to run once daily (cron), early morning, before the first shift.
 * Idempotent: upserts on `date`, safe to re-run.
 */

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { istDateStr } from '../_shared/istDate.ts';

interface ChallengeJson {
  challenge_en: string;
  challenge_hi: string;
  category: 'Sort' | 'Set' | 'Shine' | 'Standardise' | 'Sustain';
  verification_hint_en: string;
  verification_hint_hi: string;
}

const PROMPT =
  'You are a 5S workplace organiser for an Indian forging plant with departments: Forge Shop, Press Shop, Heat Treatment, Machine Shop. ' +
  'Generate today\'s 5S challenge. Return only valid JSON: {"challenge_en": "max 20 words", "challenge_hi": "max 20 words in Hindi", ' +
  '"category": "Sort|Set|Shine|Standardise|Sustain", "verification_hint_en": "what photo should show", "verification_hint_hi": "same in Hindi"}';

async function generateChallengeFromDeepSeek(): Promise<ChallengeJson> {
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set');

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: PROMPT }],
      max_tokens: 200,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('DeepSeek returned no content');

  // DeepSeek sometimes wraps JSON in a ```json ... ``` fence — strip it before parsing.
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned) as ChallengeJson;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const db = supabaseAdmin();
  const today = istDateStr();

  try {
    const challenge = await generateChallengeFromDeepSeek();

    const { error: insertError } = await db.from('5s_challenges').upsert(
      {
        date: today,
        challenge_text_en: challenge.challenge_en,
        challenge_text_hi: challenge.challenge_hi,
        department: null, // one plant-wide challenge per day — matches app/(worker)/5s.tsx's query
      },
      { onConflict: 'date' }
    );

    if (insertError) return jsonResponse({ error: insertError.message }, 500);

    return jsonResponse({ date: today, challenge });
  } catch (err) {
    console.error('five-s-challenge-generator failed', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
