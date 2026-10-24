import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, Modal, ScrollView, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams } from 'expo-router'
import { CheckCircle2, Circle, X } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useOnboarding, useEmployeeChecklist, formatIst, OnboardingEmployee, OnboardingDept } from '@/hooks/useOnboarding'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { BRAND, INK } from '@/components/theme'

type Filter = 'all' | 'progress' | 'done'

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <View className="h-2 bg-ink-100 rounded-full overflow-hidden">
      <View style={{ width: `${pct}%` }} className={`h-2 rounded-full ${done === total && total > 0 ? 'bg-green-500' : 'bg-brand-600'}`} />
    </View>
  )
}

function OnboardedBadge() {
  const { t } = useTranslation()
  return (
    <View className="bg-green-100 px-2.5 py-0.5 rounded-full">
      <Text className="text-xs font-bold text-green-700">{t('onboarding.onboarded')}</Text>
    </View>
  )
}

function DetailModal({ emp, depts, onClose }: { emp: OnboardingEmployee; depts: OnboardingDept[]; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const { rows, isLoading, error, save } = useEmployeeChecklist(emp.emp_code)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    const m: Record<string, string> = {}
    rows.forEach(r => { m[r.department] = r.notes ?? '' })
    setNotes(prev => ({ ...m, ...prev }))
  }, [rows])

  const byDept = useMemo(() => new Map(rows.map(r => [r.department, r])), [rows])
  const doneCount = depts.filter(d => byDept.get(d.code)?.completed).length
  const allDone = depts.length > 0 && doneCount === depts.length

  const apply = async (code: string, completed: boolean) => {
    setBusy(code)
    const err = await save(code, completed, notes[code] ?? '')
    setBusy(null)
    if (err) Alert.alert(t('onboarding.saveFailed'), err)
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-ink-50">
        <View className="flex-row items-center justify-between p-4 bg-white border-b border-ink-100">
          <View className="flex-1 pr-3">
            <Text className="text-lg font-bold text-ink-900">{emp.name}</Text>
            <Text className="text-xs font-mono text-ink-500">{emp.emp_code}{emp.department ? ` • ${emp.department}` : ''}</Text>
          </View>
          <TouchableOpacity onPress={onClose} accessibilityLabel={t('onboarding.close')} className="p-2"><X size={22} color={INK[500]} /></TouchableOpacity>
        </View>
        <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 40 }}>
          <Card className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-ink-700">{t('onboarding.progress', { done: doneCount, total: depts.length })}</Text>
              {allDone ? <OnboardedBadge /> : null}
            </View>
            <Bar done={doneCount} total={depts.length} />
          </Card>
          {error ? <Text className="text-sm text-red-600 mb-3">{t('onboarding.loadFailed')}: {error}</Text> : null}
          <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{t('onboarding.departments')}</Text>
          {isLoading && rows.length === 0 ? <LoadingScreen /> : depts.map(d => {
            const r = byDept.get(d.code)
            const done = !!r?.completed
            const label = i18n.language === 'hi' ? d.label_hi || d.label_en : d.label_en
            return (
              <Card key={d.code} className="mb-3">
                <TouchableOpacity disabled={!r || busy === d.code} onPress={() => apply(d.code, !done)} className="flex-row items-center gap-3 min-h-touch">
                  {done ? <CheckCircle2 size={26} color="#16A34A" /> : <Circle size={26} color={INK[300]} />}
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-ink-900">{label}</Text>
                    <Text className="text-xs text-ink-500 mt-0.5">
                      {done
                        ? t('onboarding.completedBy', { who: r?.completed_by ?? '—', when: formatIst(r?.completed_at) })
                        : t('onboarding.pending')}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View className="flex-row items-center gap-2 mt-3">
                  <TextInput
                    value={notes[d.code] ?? ''}
                    onChangeText={v => setNotes(p => ({ ...p, [d.code]: v }))}
                    placeholder={t('onboarding.notes')}
                    placeholderTextColor={INK[300]}
                    className="flex-1 border border-ink-200 rounded-lg px-3 py-2 text-sm text-ink-900 bg-white"
                  />
                  <TouchableOpacity disabled={!r || busy === d.code} onPress={() => apply(d.code, done)} className="px-3 py-2 rounded-lg bg-brand-50">
                    <Text className="text-sm font-semibold text-brand-600">{t('onboarding.saveNote')}</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            )
          })}
        </ScrollView>
      </View>
    </Modal>
  )
}

export default function OnboardingScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { code } = useLocalSearchParams<{ code?: string }>()
  const { employees, depts, isLoading, error, refresh, progress } = useOnboarding()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<OnboardingEmployee | null>(null)

  // Deep link from the pending-activations list (?code=VFLxxxx)
  useEffect(() => {
    if (!code || selected) return
    if (isLoading) return
    const hit = employees.find(e => e.emp_code === code)
    if (hit) { setSelected(hit); return }
    // Pending activations are not active yet, so they are not in the list: look the one employee up
    supabase.from('employees').select('id, emp_code, name, department').eq('emp_code', code).maybeSingle()
      .then(({ data }) => { if (data) setSelected(data as OnboardingEmployee) })
  }, [code, employees, isLoading])

  const closeDetail = useCallback(() => { setSelected(null); refresh() }, [refresh])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return employees.filter(e => {
      if (q && !(e.name.toLowerCase().includes(q) || e.emp_code.toLowerCase().includes(q))) return false
      const p = progress(e.emp_code)
      if (filter === 'done') return p.onboarded
      if (filter === 'progress') return !p.onboarded
      return true
    })
  }, [employees, query, filter, progress])

  if (!employee || isLoading) return <LoadingScreen />

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('onboarding.filterAll') },
    { key: 'progress', label: t('onboarding.filterInProgress') },
    { key: 'done', label: t('onboarding.filterOnboarded') },
  ]

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <FlatList
        data={list}
        keyExtractor={e => e.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <View className="mb-3">
            <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('onboarding.title')}</Text>
            <Text className="text-sm text-ink-500 mb-3">{t('onboarding.subtitle')}</Text>
            {error ? <Text className="text-sm text-red-600 mb-2">{t('onboarding.loadFailed')}: {error}</Text> : null}
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('onboarding.search')}
              placeholderTextColor={INK[300]}
              className="border border-ink-200 rounded-lg px-3 py-2.5 text-base text-ink-900 bg-white mb-3"
            />
            <View className="flex-row gap-2">
              {filters.map(f => (
                <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} className={`px-3 py-1.5 rounded-full ${filter === f.key ? 'bg-brand-600' : 'bg-white border border-ink-200'}`}>
                  <Text className={`text-sm font-semibold ${filter === f.key ? 'text-white' : 'text-ink-700'}`}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const p = progress(item.emp_code)
          return (
            <TouchableOpacity onPress={() => setSelected(item)} className="mb-2">
              <Card>
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-bold text-ink-900">{item.name}</Text>
                    <Text className="text-xs font-mono text-ink-500 mt-0.5">{item.emp_code}{item.department ? ` • ${item.department}` : ''}</Text>
                  </View>
                  {p.onboarded ? <OnboardedBadge /> : <Text className="text-sm font-semibold text-brand-600">{t('onboarding.progress', { done: p.done, total: p.total })}</Text>}
                </View>
                <Bar done={p.done} total={p.total} />
              </Card>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={<Text className="text-center text-sm text-ink-500 py-10">{t('onboarding.noEmployees')}</Text>}
      />
      {selected ? <DetailModal emp={selected} depts={depts} onClose={closeDetail} /> : null}
    </View>
  )
}
