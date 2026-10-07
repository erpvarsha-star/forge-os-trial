import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useQuoteOfTheDay } from '@/hooks/useQuoteOfTheDay'
import { Card } from './Card'
import { Sparkles } from 'lucide-react-native'

// Yash, 6 Oct 2026, widened 7 Oct 2026: a motivational/spiritual quote
// shown to everyone, every role (including the owner), right after
// check-in — same quote for everyone on a given day. The quote set lives
// in the daily_quotes table (PATCH_82), picked once per real IST calendar
// day by get_quote_of_the_day() — never a device-local
// Date.getDay()/getDate() read — so Claude can add more quotes any time
// via SQL with no app rebuild, and every employee still sees the
// identical quote on the same real day. See hooks/useQuoteOfTheDay.ts.
export function QuoteOfTheDay() {
  const { t, i18n } = useTranslation()
  const quote = useQuoteOfTheDay()
  const isHindi = i18n.language === 'hi'

  // Fails silently (no banner) rather than showing a loading spinner or
  // broken state — this is a decorative extra, never something that should
  // draw attention to itself failing.
  if (!quote) return null

  return (
    <Card variant="flat" className="bg-brand-50 border-brand-200">
      <View className="flex-row items-start gap-3">
        <View className="w-8 h-8 rounded-full bg-white items-center justify-center mt-0.5">
          <Sparkles size={18} color="#E65C00" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-brand-700 mb-1">{t('worker.quoteOfTheDay')}</Text>
          <Text className="text-sm text-ink-800 leading-relaxed italic">
            {isHindi ? quote.hi : quote.en}
          </Text>
          {isHindi && (
            <Text className="text-xs text-ink-500 mt-1 italic">{quote.en}</Text>
          )}
          <Text className="text-xs text-ink-400 mt-1.5">— {quote.source}</Text>
          <View className="h-px bg-brand-200 my-2" />
          <Text className="text-xs font-semibold text-ink-600 mb-0.5">{t('worker.quoteMeaning')}</Text>
          <Text className="text-xs text-ink-700 leading-relaxed">
            {isHindi ? quote.meaning_hi : quote.meaning_en}
          </Text>
        </View>
      </View>
    </Card>
  )
}
