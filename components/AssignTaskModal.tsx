import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, Modal, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { istDateStr } from '@/lib/istDate'
import { AssignableEmployee, TaskPriority, createAssignedTask } from '@/hooks/useAssignedTasks'
import { formatTaskDate } from '@/components/TaskParts'
import { Check } from 'lucide-react-native'
import { BRAND } from '@/components/theme'

interface Props {
  visible: boolean
  people: AssignableEmployee[]
  onClose: () => void
  /** Called after a successful create so the parent can refetch. */
  onCreated: () => void
}

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent']

/** IST calendar date `days` after today, as YYYY-MM-DD. */
function istPlusDays(days: number): string {
  const [y, m, d] = istDateStr().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

const DUE_CHIPS: { key: string; days: number | null }[] = [
  { key: 'today', days: 0 },
  { key: 'tomorrow', days: 1 },
  { key: 'in3days', days: 3 },
  { key: 'in7days', days: 7 },
  { key: 'noDueDate', days: null },
]

export function AssignTaskModal({ visible, people, onClose, onCreated }: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [personId, setPersonId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDays, setDueDays] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setSearch(''); setPersonId(null); setTitle(''); setDescription('')
      setPriority('normal'); setDueDays(null); setError(null); setBusy(false)
    }
  }, [visible])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return people
    return people.filter(p => p.name.toLowerCase().includes(q) || p.emp_code.toLowerCase().includes(q))
  }, [people, search])

  const selected = people.find(p => p.id === personId) || null
  const canSubmit = !!personId && title.trim().length > 0 && !busy

  const submit = async () => {
    if (!personId) return
    setBusy(true)
    setError(null)
    // Recompute the date at submit time so a modal left open past midnight
    // IST never sends a stale (now-past) due date.
    const dueDate = dueDays === null ? null : istPlusDays(dueDays)
    const { error: err } = await createAssignedTask({ assignedTo: personId, title, description, dueDate, priority })
    setBusy(false)
    if (err) { setError(err); return }
    onCreated()
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl p-5" style={{ maxHeight: '92%' }}>
            <Text className="text-lg font-bold text-ink-900 mb-3">{t('delegatedTasks.assignTask')}</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text className="text-sm font-semibold text-ink-700 mb-1.5">{t('delegatedTasks.assignTo')}</Text>
              {selected ? (
                <TouchableOpacity onPress={() => setPersonId(null)} className="bg-brand-50 rounded-lg p-3 mb-3 flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-ink-900">{selected.name} ({selected.emp_code})</Text>
                    <Text className="text-xs text-ink-500">{selected.department || '—'}</Text>
                  </View>
                  <Text className="text-xs text-brand-700 font-semibold">{t('delegatedTasks.change')}</Text>
                </TouchableOpacity>
              ) : (
                <View className="mb-3">
                  <Input value={search} onChangeText={setSearch} placeholder={t('delegatedTasks.searchPlaceholder')} />
                  <View className="border border-ink-100 rounded-lg mt-2 max-h-48 overflow-hidden">
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {filtered.length === 0 ? (
                        <Text className="text-xs text-ink-500 p-3">{t('delegatedTasks.noMatch')}</Text>
                      ) : filtered.map(p => (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => setPersonId(p.id)}
                          className="px-3 py-2.5 border-b border-ink-100 min-h-touch justify-center"
                        >
                          <Text className="text-sm text-ink-900">{p.name} <Text className="text-xs font-mono text-ink-500">{p.emp_code}</Text></Text>
                          <Text className="text-xs text-ink-500">{p.department || '—'}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}

              <Input
                label={t('delegatedTasks.taskTitle')}
                required
                value={title}
                onChangeText={setTitle}
                maxLength={200}
                placeholder={t('delegatedTasks.taskTitlePlaceholder')}
                className="mb-3"
              />
              <Input
                label={t('delegatedTasks.descriptionOptional')}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                className="mb-3"
              />

              <Text className="text-sm font-semibold text-ink-700 mb-1.5">{t('delegatedTasks.priorityLabel')}</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {PRIORITIES.map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setPriority(p)}
                    className={`px-3 py-2 rounded-full border min-h-[40px] justify-center ${priority === p ? 'bg-brand-600 border-brand-600' : 'bg-white border-ink-200'}`}
                  >
                    <Text className={`text-sm font-semibold ${priority === p ? 'text-white' : 'text-ink-700'}`}>{t(`delegatedTasks.priority.${p}`)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-sm font-semibold text-ink-700 mb-1.5">{t('delegatedTasks.dueLabel')}</Text>
              <View className="flex-row flex-wrap gap-2 mb-1">
                {DUE_CHIPS.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setDueDays(c.days)}
                    className={`px-3 py-2 rounded-full border min-h-[40px] justify-center ${dueDays === c.days ? 'bg-brand-600 border-brand-600' : 'bg-white border-ink-200'}`}
                  >
                    <Text className={`text-sm font-semibold ${dueDays === c.days ? 'text-white' : 'text-ink-700'}`}>{t(`delegatedTasks.dueChips.${c.key}`)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View className="flex-row items-center gap-1 mb-3">
                <Check size={12} color={BRAND[600]} />
                <Text className="text-xs text-ink-500">
                  {dueDays === null ? t('delegatedTasks.noDueDate') : formatTaskDate(istPlusDays(dueDays))}
                </Text>
              </View>

              {error ? <Text className="text-sm text-status-rejected mb-2">{error}</Text> : null}
            </ScrollView>
            <Button title="delegatedTasks.assign" onPress={submit} loading={busy} disabled={!canSubmit} className="mt-2 mb-2" />
            <Button title="common.cancel" variant="ghost" onPress={onClose} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
