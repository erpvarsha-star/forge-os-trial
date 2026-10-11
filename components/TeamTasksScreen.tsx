import React, { useCallback, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { LoadingScreen } from '@/components/LoadingScreen'
import { AssignTaskModal } from '@/components/AssignTaskModal'
import {
  OverdueBadge, PriorityBadge, TaskNoteModal, TaskStatusBadge,
  formatTaskDate, formatTaskTimestampIST, isTaskOverdue,
} from '@/components/TaskParts'
import {
  AssignedTask, TaskAction, TeamTaskSummaryRow, updateAssignedTask,
  useAssignableEmployees, usePersonTasks, useTasksIAssigned, useTeamTaskSummary,
} from '@/hooks/useAssignedTasks'
import { ChevronRight, ChevronLeft, Plus, UsersRound } from 'lucide-react-native'

type PendingAction = { task: AssignedTask; action: Extract<TaskAction, 'approve' | 'send_back' | 'cancel'> }

const ACTION_KEYS = {
  approve: { title: 'delegatedTasks.approveTitle', confirm: 'delegatedTasks.approve', required: false, hint: 'delegatedTasks.approveHint' },
  send_back: { title: 'delegatedTasks.sendBackTitle', confirm: 'delegatedTasks.sendBack', required: true, hint: 'delegatedTasks.sendBackHint' },
  cancel: { title: 'delegatedTasks.cancelTitle', confirm: 'delegatedTasks.cancelTask', required: false, hint: 'delegatedTasks.cancelHint' },
} as const

export function TeamTasksScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const people = useAssignableEmployees()
  const mine = useTasksIAssigned()
  const summary = useTeamTaskSummary()
  const [personId, setPersonId] = useState<string | null>(null)
  const [personName, setPersonName] = useState('')
  const person = usePersonTasks(personId)
  const [showAssign, setShowAssign] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const refreshAll = useCallback(async () => {
    await Promise.all([people.refresh(), mine.refresh(), summary.refresh(), personId ? person.refresh() : Promise.resolve()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people.refresh, mine.refresh, summary.refresh, person.refresh, personId])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshAll()
    setRefreshing(false)
  }, [refreshAll])

  if (!employee) return <LoadingScreen />
  if (people.isLoading || mine.isLoading || summary.isLoading) return <LoadingScreen />

  const isOwner = employee.role === 'owner'
  const canActOn = (task: AssignedTask) => task.assigned_by === employee.id || isOwner

  const confirmAction = async (note: string) => {
    if (!pending) return
    setBusy(true)
    setActionError(null)
    const { error } = await updateAssignedTask(pending.task.id, pending.action, note)
    setBusy(false)
    if (error) { setActionError(error); return }
    setPending(null)
    await refreshAll()
  }

  const startAction = (task: AssignedTask, action: PendingAction['action']) => {
    setActionError(null)
    setPending({ task, action })
  }

  const loadErrors = [people.error, mine.error, summary.error, personId ? person.error : null].filter(Boolean) as string[]
  const errorCard = loadErrors.length > 0 ? (
    <Card className="mb-3 border-status-rejected">
      <Text className="text-sm text-status-rejected">{t('delegatedTasks.loadError')}: {loadErrors[0]}</Text>
      <Button title="common.tryAgain" size="sm" variant="outline" className="mt-2" onPress={onRefresh} />
    </Card>
  ) : null

  const actionModal = pending ? (
    <TaskNoteModal
      visible
      title={t(ACTION_KEYS[pending.action].title)}
      hint={`${pending.task.title} — ${t(ACTION_KEYS[pending.action].hint)}`}
      placeholder={t('delegatedTasks.notePlaceholder')}
      confirmLabel={ACTION_KEYS[pending.action].confirm}
      noteRequired={ACTION_KEYS[pending.action].required}
      busy={busy}
      errorText={actionError}
      onConfirm={confirmAction}
      onCancel={() => setPending(null)}
    />
  ) : null

  // ── Person detail ─────────────────────────────────────────────────────
  if (personId) {
    const list = [...person.data].sort((a, b) => {
      const rank = (s: AssignedTask['status']) => ({ submitted: 0, in_progress: 1, open: 2, completed: 3, cancelled: 4 }[s])
      const r = rank(a.status) - rank(b.status)
      return r !== 0 ? r : b.created_at.localeCompare(a.created_at)
    })
    return (
      <View className="flex-1 bg-ink-50">
        <Header empCode={employee.emp_code} role={employee.role} />
        <ScrollView
          className="flex-1 p-4"
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <TouchableOpacity onPress={() => setPersonId(null)} className="flex-row items-center mb-2 min-h-touch">
            <ChevronLeft size={20} color="#E65C00" />
            <Text className="text-sm font-semibold text-brand-700">{t('common.back')}</Text>
          </TouchableOpacity>
          <Text className="text-xl font-bold text-ink-900 mb-3">{personName}</Text>
          {errorCard}
          {person.isLoading ? (
            <Text className="text-sm text-ink-500">{t('common.loading')}</Text>
          ) : list.length === 0 ? (
            <EmptyState title={t('delegatedTasks.noTasksForPerson')} />
          ) : list.map(task => {
            const overdue = isTaskOverdue(task)
            const actionable = canActOn(task)
            return (
              <Card key={task.id} className="mb-3">
                <View className="flex-row items-start justify-between mb-1">
                  <Text className="text-base font-bold text-ink-900 flex-1 pr-2">{task.title}</Text>
                  <PriorityBadge priority={task.priority} />
                </View>
                <View className="flex-row items-center gap-2 mb-1">
                  <TaskStatusBadge status={task.status} />
                  {overdue ? <OverdueBadge /> : null}
                </View>
                {task.description ? <Text className="text-sm text-ink-600 mb-1">{task.description}</Text> : null}
                <Text className="text-xs text-ink-500">
                  {t('delegatedTasks.assignedBy')}: {task.assigner_name || '—'}
                </Text>
                <Text className={`text-xs ${overdue ? 'text-status-rejected font-semibold' : 'text-ink-500'}`}>
                  {task.due_date ? `${t('delegatedTasks.due')}: ${formatTaskDate(task.due_date)}` : t('delegatedTasks.noDueDate')}
                </Text>
                {task.completion_note ? (
                  <Text className="text-xs text-ink-700 mt-1">{t('delegatedTasks.completionNote')}: {task.completion_note}</Text>
                ) : null}
                {task.returned_count > 0 && task.review_note ? (
                  <Text className="text-xs text-status-late mt-1">
                    {t('delegatedTasks.sentBack')} ({task.returned_count}x): {task.review_note}
                  </Text>
                ) : null}
                {task.status === 'completed' ? (
                  <Text className="text-xs text-status-present mt-1">
                    {t('delegatedTasks.completedOn', { date: formatTaskTimestampIST(task.completed_at) })}
                  </Text>
                ) : null}

                {actionable && task.status === 'submitted' ? (
                  <View className="flex-row gap-2 mt-3">
                    <Button title="delegatedTasks.approve" size="sm" className="flex-1" onPress={() => startAction(task, 'approve')} />
                    <Button title="delegatedTasks.sendBack" size="sm" variant="outline" className="flex-1" onPress={() => startAction(task, 'send_back')} />
                  </View>
                ) : null}
                {actionable && (task.status === 'open' || task.status === 'in_progress' || task.status === 'submitted') ? (
                  <Button title="delegatedTasks.cancelTask" size="sm" variant="ghost" className="mt-1" onPress={() => startAction(task, 'cancel')} />
                ) : null}
              </Card>
            )
          })}
        </ScrollView>
        {actionModal}
      </View>
    )
  }

  // ── Main list ─────────────────────────────────────────────────────────
  const awaiting = mine.data.filter(x => x.status === 'submitted')
  const cannotAssign = people.data.length === 0 && !people.error

  const renderSummaryRow = (row: TeamTaskSummaryRow) => {
    const openTotal = row.open_count + row.in_progress_count
    return (
      <TouchableOpacity
        key={row.employee_id}
        className="mb-2 min-h-touch"
        onPress={() => { setPersonName(row.name); setPersonId(row.employee_id) }}
      >
        <Card className="flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-base font-semibold text-ink-900">{row.name}</Text>
            <Text className="text-xs text-ink-500 mb-1">{row.emp_code} · {row.department || '—'}</Text>
            <View className="flex-row flex-wrap gap-x-3">
              <Text className="text-xs text-ink-700">{t('delegatedTasks.countOpen')}: {openTotal}</Text>
              <Text className={`text-xs ${row.overdue_count > 0 ? 'text-status-rejected font-semibold' : 'text-ink-700'}`}>
                {t('delegatedTasks.overdue')}: {row.overdue_count}
              </Text>
              <Text className="text-xs text-ink-700">{t('delegatedTasks.countAwaiting')}: {row.awaiting_count}</Text>
              <Text className="text-xs text-ink-700">{t('delegatedTasks.countDone')}: {row.completed_count}</Text>
              <Text className="text-xs text-ink-500">{t('delegatedTasks.onTime')}: {row.completed_on_time_count}</Text>
            </View>
          </View>
          <ChevronRight size={18} color="#9CA3AF" />
        </Card>
      </TouchableOpacity>
    )
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView
        className="flex-1 p-4"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text className="text-xl font-bold text-ink-900 mb-3">{t('delegatedTasks.teamTasks')}</Text>
        {errorCard}

        {cannotAssign ? (
          <Card className="mb-4 items-center py-6">
            <UsersRound size={28} color="#8B93A3" />
            <Text className="text-sm font-bold text-ink-700 mt-2 text-center">{t('delegatedTasks.noTeamTitle')}</Text>
            <Text className="text-xs text-ink-500 mt-1 text-center leading-5">{t('delegatedTasks.noTeamBody')}</Text>
          </Card>
        ) : (
          <Button
            title="delegatedTasks.assignTask"
            size="lg"
            className="mb-4"
            icon={<Plus size={20} color="white" />}
            onPress={() => setShowAssign(true)}
            disabled={people.data.length === 0}
          />
        )}

        {awaiting.length > 0 ? (
          <>
            <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">
              {t('delegatedTasks.awaitingYou')} ({awaiting.length})
            </Text>
            {awaiting.map(task => (
              <Card key={task.id} className="mb-3">
                <View className="flex-row items-start justify-between mb-1">
                  <Text className="text-base font-bold text-ink-900 flex-1 pr-2">{task.title}</Text>
                  <PriorityBadge priority={task.priority} />
                </View>
                <Text className="text-xs text-ink-500 mb-1">
                  {task.assignee_name || '—'}{task.assignee_code ? ` (${task.assignee_code})` : ''} · {t('delegatedTasks.submittedOn', { date: formatTaskTimestampIST(task.submitted_at) })}
                </Text>
                {task.completion_note ? (
                  <Text className="text-sm text-ink-700 mb-1">{t('delegatedTasks.completionNote')}: {task.completion_note}</Text>
                ) : null}
                <View className="flex-row gap-2 mt-2">
                  <Button title="delegatedTasks.approve" size="sm" className="flex-1" onPress={() => startAction(task, 'approve')} />
                  <Button title="delegatedTasks.sendBack" size="sm" variant="outline" className="flex-1" onPress={() => startAction(task, 'send_back')} />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2 mt-2">
          {t('delegatedTasks.byPerson')}
        </Text>
        {summary.data.length === 0 ? (
          <EmptyState title={t('delegatedTasks.noSummary')} message={t('delegatedTasks.noSummaryBody')} />
        ) : summary.data.map(renderSummaryRow)}
      </ScrollView>

      <AssignTaskModal
        visible={showAssign}
        people={people.data}
        onClose={() => setShowAssign(false)}
        onCreated={refreshAll}
      />
      {actionModal}
    </View>
  )
}
