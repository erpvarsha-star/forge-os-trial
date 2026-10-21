import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { istMonthYear } from '@/lib/istDate'
import { BRAND, INK } from '@/components/theme'
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react-native'

type RateRow = { month: string; year: number; vda_per_day_rate: number }

export default function PayrollRatesScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const now = istMonthYear()
  const [month, setMonth] = useState(Number(now.month))
  const [year, setYear] = useState(now.year)
  const [rates, setRates] = useState<RateRow[]>([])
  const [value, setValue] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const monthKey = String(month).padStart(2, '0')
  const sameMonth = (r: RateRow) => String(r.month).padStart(2, '0') === monthKey && Number(r.year) === year
  const current = rates.find(sameMonth)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    const { data } = await supabase
      .from('payroll_monthly_rates').select('month,year,vda_per_day_rate')
      .order('year', { ascending: false }).order('month', { ascending: false })
    setRates((data ?? []) as RateRow[])
    setIsLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])
  // Pre-fill the input with the saved rate for whichever month is showing
  useEffect(() => { setValue(current ? String(current.vda_per_day_rate) : '') }, [month, year, rates])

  if (!employee) return <LoadingScreen />

  const shiftMonth = (d: number) => {
    let m = month + d, y = year
    if (m < 1) { m = 12; y-- } else if (m > 12) { m = 1; y++ }
    setMonth(m); setYear(y)
  }

  const save = async () => {
    const rate = Number(value)
    if (value.trim() === '' || isNaN(rate) || rate <= 0) { Alert.alert(t('common.error'), t('payroll.vdaInvalid')); return }
    setSaving(true)
    const { error } = await supabase.rpc('set_monthly_vda_rate', { p_month: monthKey, p_year: year, p_rate: rate })
    setSaving(false)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    Alert.alert(t('common.success'), t('payroll.vdaSaved'))
    refresh()
  }

  const monthLabel = `${t(`payroll.months.${month}`)} ${year}`

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-3">{t('payroll.ratesTitle')}</Text>

        <Card className="mb-3 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => shiftMonth(-1)} className="p-2"><ChevronLeft size={22} color={INK[500]} /></TouchableOpacity>
          <Text className="text-lg font-bold text-ink-900">{monthLabel}</Text>
          <TouchableOpacity onPress={() => shiftMonth(1)} className="p-2"><ChevronRight size={22} color={INK[500]} /></TouchableOpacity>
        </Card>

        {isLoading ? <ActivityIndicator color={BRAND[600]} /> : (
          <>
            {!current && (
              <View className="flex-row items-start gap-2 mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle size={16} color="#B45309" />
                <Text className="text-sm text-amber-700 flex-1">{t('payroll.vdaNoRate', { month: monthLabel })}</Text>
              </View>
            )}

            <Card className="mb-3">
              <Text className="text-sm font-semibold text-ink-900 mb-2">{t('payroll.vdaPerDay')}</Text>
              <TextInput value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="0"
                className="bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-base text-ink-900 font-mono" />
              <Button title="common.save" variant="primary" size="md" className="mt-3" loading={saving} onPress={save} />
            </Card>

            <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{t('payroll.ratesHistory')}</Text>
            {rates.length === 0 ? (
              <Text className="text-sm text-ink-500 px-1">{t('payroll.noRates')}</Text>
            ) : rates.map(r => (
              <Card key={`${r.year}-${r.month}`} className="mb-2 flex-row items-center justify-between">
                <Text className="text-base text-ink-900">{t(`payroll.months.${Number(r.month)}`)} {r.year}</Text>
                <Text className="text-base font-bold text-ink-900 font-mono tabular-nums">₹{Number(r.vda_per_day_rate).toLocaleString('en-IN')}</Text>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  )
}
