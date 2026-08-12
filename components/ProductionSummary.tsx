import React, { useCallback, useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Factory } from 'lucide-react-native'
import { Card } from '@/components/Card'
import { BRAND } from '@/components/theme'
import { supabase } from '@/lib/supabase'

/**
 * Department production for the current month, from `production_records`
 * (PATCH_15), which the Operations Dashboard Apps Script pushes every 15
 * minutes.
 *
 * This data has existed since 1 April and the app showed none of it. It is
 * production per machine / furnace / process per shift — NOT per employee —
 * so it belongs on a department dashboard and must never feed an individual's
 * score. That is why removing production from nightly-scoring stays correct
 * even though the data turned out to exist.
 *
 * `department` scopes it to one shop (manager view). Omitting it groups every
 * department together (owner view).
 *
 * Renders nothing at all when there are no rows, so it is safe to mount before
 * the sync has ever run — which is the state every install is in until Yash
 * sets the two Script Properties.
 */

interface Bucket {
  label: string
  qty: number
}

interface Props {
  department?: string
}

export function ProductionSummary({ department }: Props) {
  const { t } = useTranslation()
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [total, setTotal] = useState(0)
  const [hasLoaded, setHasLoaded] = useState(false)

  const load = useCallback(async () => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

    let query = supabase
      .from('production_records')
      .select('department, unit, qty')
      .gte('date', monthStart)
      .lte('date', monthEnd)

    if (department) query = query.eq('department', department)

    const { data } = await query

    // Grouped by machine within one shop, or by shop across the plant.
    const grouped = new Map<string, number>()
    let sum = 0
    for (const row of (data ?? []) as { department: string; unit: string | null; qty: number | null }[]) {
      const key = (department ? row.unit : row.department) || '—'
      const qty = Number(row.qty ?? 0)
      if (!Number.isFinite(qty)) continue
      grouped.set(key, (grouped.get(key) ?? 0) + qty)
      sum += qty
    }

    setBuckets([...grouped.entries()].map(([label, qty]) => ({ label, qty })).sort((a, b) => b.qty - a.qty).slice(0, 8))
    setTotal(sum)
    setHasLoaded(true)
  }, [department])

  useEffect(() => {
    load()
  }, [load])

  // Nothing synced yet — stay out of the way rather than showing an empty box.
  if (!hasLoaded || buckets.length === 0) return null

  const max = Math.max(...buckets.map(b => b.qty), 1)

  return (
    <Card className="mb-4">
      <View className="flex-row items-center gap-3 mb-3">
        <View className="w-9 h-9 rounded-full bg-brand-50 items-center justify-center">
          <Factory size={18} color={BRAND[600]} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-ink-900 tracking-tight">{t('production.title')}</Text>
          <Text className="text-xs text-ink-500 mt-0.5">
            {t('production.monthTotal', { qty: total.toLocaleString() })}
          </Text>
        </View>
      </View>

      {buckets.map(b => (
        <View key={b.label} className="mb-2">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-xs text-ink-700 flex-1 pr-2" numberOfLines={1}>{b.label}</Text>
            <Text className="text-xs font-bold text-ink-900">{b.qty.toLocaleString()}</Text>
          </View>
          <View className="h-2 rounded-full bg-ink-100 overflow-hidden">
            <View className="h-2 rounded-full" style={{ width: `${(b.qty / max) * 100}%`, backgroundColor: BRAND[600] }} />
          </View>
        </View>
      ))}

      <Text className="text-xs text-ink-400 mt-2">{t('production.footnote')}</Text>
    </Card>
  )
}
