import React, { useEffect, useState } from 'react'
import { View, Text, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { istDateStr } from '@/lib/istDate'
import type { AssignedTask, TaskPriority, TaskStatus } from '@/hooks/useAssignedTasks'
import type { StatusTokenKey } from '@/components/theme'

/** Overdue = still not finished and due before today (IST). */
export function isTaskOverdue(task: Pick<AssignedTask, 'due_date' | 'status'>): boolean {
  if (!task.due_date) return false
  if (task.status === 'completed' || task.status === 'cancelled' || task.status === 'submitted') return false
  return task.due_date < istDateStr()
}

/** YYYY-MM-DD (or ISO timestamp) → "DD Mon YYYY" without touching device timezone. */
export function formatTaskDate(value: string | null | undefined): string {
  if (!value) return ''
  const d = value.slice(0, 10)
  const [y, m, day] = d.split('-').map(Number)
  if (!y || !m || !day) return d
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${String(day).padStart(2, '0')} ${months[m - 1]} ${y}`
}

/** Completed/submitted timestamps are timestamptz — show the IST calendar date. */
export function formatTaskTimestampIST(value: string | null | undefined): string {
  if (!value) return ''
  const ist = new Date(new Date(value).getTime() + 5.5 * 60 * 60 * 1000)
  return formatTaskDate(ist.toISOString().slice(0, 10))
}

const PRIORITY_TONE: Record<TaskPriority, 'neutral' | 'brand' | StatusTokenKey> = {
  low: 'neutral',
  normal: 'neutral',
  high: 'late',
  urgent: 'rejected',
}
const STATUS_TONE: Record<TaskStatus, 'neutral' | 'brand' | StatusTokenKey> = {
  open: 'neutral',
  in_progress: 'brand',
  submitted: 'pending',
  completed: 'approved',
  cancelled: 'weekoff',
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const { t } = useTranslation()
  return <Badge size="sm" tone={PRIORITY_TONE[priority] || 'neutral'} label={t(`delegatedTasks.priority.${priority}`)} />
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useTranslation()
  return <Badge size="sm" tone={STATUS_TONE[status] || 'neutral'} label={t(`delegatedTasks.status.${status}`)} />
}

export function OverdueBadge() {
  const { t } = useTranslation()
  return <Badge size="sm" tone="rejected" label={t('delegatedTasks.overdue')} />
}

interface NoteModalProps {
  visible: boolean
  title: string
  hint?: string
  placeholder?: string
  /** i18n key (passed to Button, which translates it). */
  confirmLabel: string
  /** When true the confirm button stays disabled until a note is typed. */
  noteRequired?: boolean
  busy?: boolean
  errorText?: string | null
  onConfirm: (note: string) => void
  onCancel: () => void
}

/** Bottom-sheet note prompt shared by submit / approve / send back / cancel. */
export function TaskNoteModal({
  visible, title, hint, placeholder, confirmLabel, noteRequired = false, busy = false, errorText, onConfirm, onCancel,
}: NoteModalProps) {
  const [note, setNote] = useState('')
  useEffect(() => { if (visible) setNote('') }, [visible])
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold text-ink-900 mb-2">{title}</Text>
            {hint ? <Text className="text-xs text-ink-500 mb-2">{hint}</Text> : null}
            <Input value={note} onChangeText={setNote} placeholder={placeholder} multiline numberOfLines={3} className="mb-3" />
            {errorText ? <Text className="text-sm text-status-rejected mb-2">{errorText}</Text> : null}
            <Button
              title={confirmLabel}
              onPress={() => onConfirm(note)}
              loading={busy}
              disabled={noteRequired && note.trim().length === 0}
              className="mb-2"
            />
            <Button title="common.cancel" variant="ghost" onPress={onCancel} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
