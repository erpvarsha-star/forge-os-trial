import React, { useState } from 'react'
import { View, Text, Modal, ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { NeedsYourCallShiftItem, Shift, ShiftReviewOutcome } from '@/types'
import { ShieldCheck } from 'lucide-react-native'
import { STATUS } from '@/components/theme'

interface Props {
  items: NeedsYourCallShiftItem[]
  shifts: Shift[]
  isLoading: boolean
  actingId: string | null
  onResolve: (id: string, outcome: ShiftReviewOutcome, correctedShiftId?: string, note?: string) => Promise<{ error: any }>
}

// Pending action between tapping a button and confirming the note modal.
// "corrected" always carries a shiftId (picked first, via the shift-list
// modal below); "flagged_for_logic_review" requires a non-empty note —
// this is the raw material Claude periodically reviews to fix the
// underlying rule, so a blank flag with nothing to go on isn't useful.
type Pending = { id: string; outcome: 'corrected' | 'flagged_for_logic_review'; shiftId?: string }

export function NeedsYourCallReview({ items, shifts, isLoading, actingId, onResolve }: Props) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<Pending | null>(null)
  const [note, setNote] = useState('')
  const [pickingShiftFor, setPickingShiftFor] = useState<string | null>(null)

  if (isLoading) return <LoadingScreen />

  const confirmPending = async () => {
    if (!pending) return
    await onResolve(pending.id, pending.outcome, pending.shiftId, note)
    setPending(null)
    setNote('')
  }

  const flagNeedsNote = pending?.outcome === 'flagged_for_logic_review'

  if (items.length === 0) {
    return (
      <Card className="items-center py-10">
        <ShieldCheck size={32} color={STATUS.approved.fg} />
        <Text className="text-sm text-ink-500 mt-3 text-center">{t('needsYourCall.empty')}</Text>
        <Text className="text-xs text-ink-400 mt-1 text-center">{t('needsYourCall.emptyBody')}</Text>
      </Card>
    )
  }

  return (
    <>
      {items.map(item => (
        <Card key={item.item_id} className="mb-3">
          <View className="flex-row items-start justify-between mb-1">
            <Text className="text-base font-bold text-ink-900">{item.employee_name}</Text>
            <Text className="text-xs font-mono text-ink-500">{item.emp_code}</Text>
          </View>
          <View className="bg-ink-100 rounded-full px-2 py-0.5 self-start mb-2">
            <Text className="text-xs font-semibold text-ink-600">{t(`needsYourCall.sourceLabels.${item.subtype}`)}</Text>
          </View>
          <Text className="text-sm text-ink-600 mb-3">{item.description}</Text>
          <View className="flex-row gap-2 flex-wrap">
            <Button
              title="needsYourCall.looksRight"
              size="sm"
              variant="primary"
              className="flex-1"
              loading={actingId === item.item_id}
              onPress={() => onResolve(item.item_id, 'confirmed_correct')}
            />
            <Button
              title="needsYourCall.changeShift"
              size="sm"
              variant="secondary"
              className="flex-1"
              onPress={() => setPickingShiftFor(item.item_id)}
            />
            <Button
              title="needsYourCall.flagForReview"
              size="sm"
              variant="outline"
              className="flex-1"
              onPress={() => setPending({ id: item.item_id, outcome: 'flagged_for_logic_review' })}
            />
          </View>
        </Card>
      ))}

      {/* Shift picker — choose the correct shift, then confirm with a note */}
      <Modal visible={!!pickingShiftFor} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl p-6 max-h-[70%]">
            <Text className="text-lg font-bold text-ink-900 mb-3">{t('needsYourCall.pickShift')}</Text>
            <ScrollView>
              {shifts.map(s => (
                <TouchableOpacity
                  key={s.id}
                  className="mb-2 min-h-touch"
                  onPress={() => {
                    setPending({ id: pickingShiftFor!, outcome: 'corrected', shiftId: s.id })
                    setPickingShiftFor(null)
                  }}
                >
                  <Card className="flex-row items-center justify-between">
                    <Text className="text-sm text-ink-900">{s.name}</Text>
                    <Text className="text-xs text-ink-500">{s.start_time}–{s.end_time}</Text>
                  </Card>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button title="common.cancel" variant="ghost" onPress={() => setPickingShiftFor(null)} className="mt-2" />
          </View>
        </View>
      </Modal>

      {/* Shared note / confirm modal for "corrected" and "flagged_for_logic_review" */}
      <Modal visible={!!pending} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold text-ink-900 mb-2">
              {pending?.outcome === 'corrected' ? t('needsYourCall.changeShift') : t('needsYourCall.flagForReview')}
            </Text>
            {flagNeedsNote && <Text className="text-xs text-ink-500 mb-2">{t('needsYourCall.flagForReviewHint')}</Text>}
            <Input
              value={note}
              onChangeText={setNote}
              placeholder={t('needsYourCall.notePlaceholder')}
              multiline
              numberOfLines={3}
              className="mb-4"
            />
            <Button
              title="common.confirm"
              onPress={confirmPending}
              variant="primary"
              className="mb-2"
              disabled={flagNeedsNote && note.trim().length === 0}
            />
            <Button title="common.cancel" onPress={() => { setPending(null); setNote('') }} variant="ghost" />
          </View>
        </View>
      </Modal>
    </>
  )
}
