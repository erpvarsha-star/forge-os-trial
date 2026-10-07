import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { istDateStr } from '@/lib/istDate'

export interface DailyQuote {
  en: string
  hi: string
  meaning_en: string
  meaning_hi: string
  source: string
  category: string
}

const CACHE_KEY_PREFIX = 'quote_of_the_day_'

// Yash, 7 Oct 2026: moved the quote set from a bundled static array
// (constants/dailyQuotes.ts, now removed) into a Supabase table +
// get_quote_of_the_day() RPC, specifically so new quotes can be added any
// time via SQL with no app rebuild or reinstall needed. Still exactly one
// quote per real IST calendar day, same for everyone — the rotation math
// now lives in the RPC (see PATCH_82), not here.
//
// Cached in AsyncStorage per IST date (same pattern as useAppVersion.ts's
// 6h cache) so this is a single network call per day per device, not one
// per render/navigation — and fails silently (no quote shown) rather than
// ever blocking or disrupting check-in, since this is a decorative
// banner, not a critical path.
export function useQuoteOfTheDay() {
  const [quote, setQuote] = useState<DailyQuote | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const today = istDateStr()
      const cacheKey = `${CACHE_KEY_PREFIX}${today}`

      try {
        const cached = await AsyncStorage.getItem(cacheKey)
        if (cached) {
          if (!cancelled) setQuote(JSON.parse(cached))
          return
        }
      } catch {
        // AsyncStorage can throw (private mode, cleared storage) — fall through to a fresh fetch.
      }

      const { data, error } = await supabase.rpc('get_quote_of_the_day')
      if (error || !data || data.length === 0) {
        if (error) console.warn('get_quote_of_the_day failed', error.message)
        return
      }

      const today_quote = data[0] as DailyQuote
      if (!cancelled) setQuote(today_quote)
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(today_quote))
      } catch {
        // Non-fatal — just means tomorrow re-fetches instead of reading a stale cache.
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return quote
}
