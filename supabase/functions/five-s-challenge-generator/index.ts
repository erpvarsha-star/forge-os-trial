/**
 * five-s-challenge-generator
 *
 * Generates one 5S housekeeping challenge for today by calling Gemini,
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

interface GeminiChallenge {
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

async function generateChallengeFromGemini(): Promise<GeminiChallenge> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }] }],
        generationConfig: { maxOutputTokens: 200, responseMimeType: 'application/json' },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content');

  // Gemini sometimes wraps JSON in a ```json ... ``` fence — strip it before parsing.
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned) as GeminiChallenge;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const db = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const challenge = await generateChallengeFromGemini();

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
