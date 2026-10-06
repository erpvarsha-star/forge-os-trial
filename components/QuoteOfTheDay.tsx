import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { DAILY_QUOTES } from '@/constants'
import { istDayIndex } from '@/lib/istDate'
import { Card } from './Card'
import { Sparkles } from 'lucide-react-native'

// Yash, 6 Oct 2026: a motivational/spiritual quote shown to everyone, every
// role (including the owner), right after check-in — same quote for
// everyone on a given day. Picked from the IST calendar day, never a
// device-local Date.getDay()/getDate() read (the locked IST rule) — so
// every employee sees the identical quote on the same real day regardless
// of device clock/timezone. See constants/dailyQuotes.ts for the quote set
// and the accuracy notes on each one.
export function QuoteOfTheDay() {
  const { t, i18n } = useTranslation()
  const index = istDayIndex() % DAILY_QUOTES.length
  const quote = DAILY_QUOTES[index]
  const isHindi = i18n.language === 'hi'

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
