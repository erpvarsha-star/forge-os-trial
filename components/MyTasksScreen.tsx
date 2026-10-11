import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, RefreshControl, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { LoadingScreen } from '@/components/LoadingScreen'
import { OverdueBadge, PriorityBadge, TaskNoteModal, formatTaskDate, formatTaskTimestampIST, isTaskOverdue } from '@/components/TaskParts'
import { AssignedTask, updateAssignedTask, useMyTasks } from '@/hooks/useAssignedTasks'
import { CalendarClock, User } from 'lucide-react-native'

const DONE_LIMIT = 30

export function MyTasksScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { data: tasks, isLoading, error, refresh } = useMyTasks()
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [submitFor, setSubmitFor] = useState<AssignedTask | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const todo = tasks
    .filter(x => x.status === 'open' || x.status === 'in_progress')
    .sort((a, b) => {
      // overdue first, then earliest due date, undated last
      const ao = isTaskOverdue(a) ? 0 : 1
      const bo = isTaskOverdue(b) ? 0 : 1
      if (ao !== bo) return ao - bo
      return (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31')
    })
  const awaiting = tasks.filter(x => x.status === 'submitted')
  const done = tasks
    .filter(x => x.status === 'completed')
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
    .slice(0, DONE_LIMIT)

  const start = async (task: AssignedTask) => {
    setBusyId(task.id)
    const { error: err } = await updateAssignedTask(task.id, 'start')
    setBusyId(null)
    if (err) Alert.alert(t('common.error'), err)
    else await refresh()
  }

  const submit = async (note: string) => {
    if (!submitFor) return
    setBusyId(submitFor.id)
    setModalError(null)
    const { error: err } = await updateAssignedTask(submitFor.id, 'submit', note)
    setBusyId(null)
    if (err) { setModalError(err); return }
    setSubmitFor(null)
    await refresh()
  }

  const renderCard = (task: AssignedTask, mode: 'todo' | 'awaiting' | 'done') => {
    const overdue = isTaskOverdue(task)
    return (
      <Card key={task.id} className={`mb-3 ${overdue ? 'border-status-rejected' : ''}`}>
        <View className="flex-row items-start justify-between mb-1">
          <Text className="text-base font-bold text-ink-900 flex-1 pr-2">{task.title}</Text>
          <PriorityBadge priority={task.priority} />
        </View>
        {task.description ? <Text className="text-sm text-ink-600 mb-2">{task.description}</Text> : null}
        <View className="flex-row items-center gap-1 mb-1">
          <User size={14} color="#646D80" />
          <Text className="text-xs text-ink-500">
            {t('delegatedTasks.assignedBy')}: {task.assigner_name || '—'}
            {task.assigner_code ? ` (${task.assigner_code})` : ''}
          </Text>
        </View>
        {task.due_date ? (
          <View className="flex-row items-center gap-2 mb-1">
            <CalendarClock size={14} color={overdue ? '#C22030' : '#646D80'} />
            <Text className={`text-xs ${overdue ? 'text-status-rejected font-semibold' : 'text-ink-500'}`}>
              {t('delegatedTasks.due')}: {formatTaskDate(task.due_date)}
            </Text>
            {overdue ? <OverdueBadge /> : null}
          </View>
        ) : (
          <Text className="text-xs text-ink-400 mb-1">{t('delegatedTasks.noDueDate')}</Text>
        )}

        {mode === 'todo' && task.returned_count > 0 && task.review_note ? (
          <View className="bg-status-late-bg rounded-lg p-2 mt-1">
            <Text className="text-xs text-ink-800">{t('delegatedTasks.sentBack')}: {task.review_note}</Text>
          </View>
        ) : null}

        {mode === 'awaiting' ? (
          <Text className="text-xs text-ink-500 mt-1">
            {t('delegatedTasks.submittedOn', { date: formatTaskTimestampIST(task.submitted_at) })}
          </Text>
        ) : null}
        {mode === 'done' ? (
          <Text className="text-xs text-status-present mt-1">
            {t('delegatedTasks.completedOn', { date: formatTaskTimestampIST(task.completed_at) })}
          </Text>
        ) : null}

        {mode === 'todo' ? (
          <View className="flex-row gap-2 mt-3">
            {task.status === 'open' ? (
              <Button
                title="delegatedTasks.start"
                size="sm"
                variant="secondary"
                className="flex-1"
                loading={busyId === task.id}
                onPress={() => start(task)}
              />
            ) : null}
            <Button
              title="delegatedTasks.markDone"
              size="sm"
              className="flex-1"
              disabled={busyId === task.id}
              onPress={() => { setModalError(null); setSubmitFor(task) }}
            />
          </View>
        ) : null}
      </Card>
    )
  }

  const section = (label: string, count: number) => (
    <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2 mt-2">{label} ({count})</Text>
  )

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView
        className="flex-1 p-4"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text className="text-xl font-bold text-ink-900 mb-3">{t('delegatedTasks.myTasks')}</Text>

        {error ? (
          <Card className="mb-3 border-status-rejected">
            <Text className="text-sm text-status-rejected">{t('delegatedTasks.loadError')}: {error}</Text>
            <Button title="common.tryAgain" size="sm" variant="outline" className="mt-2" onPress={onRefresh} />
          </Card>
        ) : null}

        {section(t('delegatedTasks.sectionTodo'), todo.length)}
        {todo.length === 0 ? (
          <EmptyState title={t('delegatedTasks.emptyTodo')} message={t('delegatedTasks.emptyTodoBody')} />
        ) : todo.map(x => renderCard(x, 'todo'))}

        {awaiting.length > 0 ? (
          <>
            {section(t('delegatedTasks.sectionAwaiting'), awaiting.length)}
            {awaiting.map(x => renderCard(x, 'awaiting'))}
          </>
        ) : null}

        {done.length > 0 ? (
          <>
            {section(t('delegatedTasks.sectionDone'), done.length)}
            {done.map(x => renderCard(x, 'done'))}
          </>
        ) : null}
      </ScrollView>

      <TaskNoteModal
        visible={!!submitFor}
        title={t('delegatedTasks.markDone')}
        hint={submitFor?.title}
        placeholder={t('delegatedTasks.completionNotePlaceholder')}
        confirmLabel="delegatedTasks.submitForConfirmation"
        busy={!!submitFor && busyId === submitFor.id}
        errorText={modalError}
        onConfirm={submit}
        onCancel={() => setSubmitFor(null)}
      />
    </View>
  )
}
