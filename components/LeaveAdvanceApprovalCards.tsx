import React, { useState } from 'react'
import { View, Text, Modal, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { MyTurnLeaveRequest, MyTurnAdvanceRequest, StageAction } from '@/hooks/useLeaveAdvanceApprovals'
import { STAGE_LABELS } from '@/lib/approvalStages'
import { CheckCircle, XCircle } from 'lucide-react-native'

const waitingLabel = (createdAt: string, t: (k: string, o?: any) => string) => {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
  return days <= 0 ? t('common.today') : t('common.waitingDays', { count: days })
}

// "Step 2 of 3 — awaiting HR" — helps whoever's looking at it understand
// where in a now-multi-stage chain this particular request sits, since
// (unlike the old single-shot model) several different people will each
// see and act on the same request over its lifetime.
function StageBadge({ stage, chain }: { stage: number; chain: string[] }) {
  const label = STAGE_LABELS[chain[stage]] || chain[stage]
  return (
    <View className="bg-status-pending-bg rounded-full px-2 py-0.5 self-start">
      <Text className="text-xs font-semibold text-status-pending">
        Step {stage + 1}/{chain.length} — awaiting {label}
      </Text>
    </View>
  )
}

interface Props {
  leaves: MyTurnLeaveRequest[]
  advances: MyTurnAdvanceRequest[]
  actingId: string | null
  onReviewLeave: (id: string, approve: boolean, note?: string, grantedDays?: number | null) => Promise<{ error: any }>
  onReviewAdvance: (id: string, approve: boolean, note?: string) => Promise<{ error: any }>
  onConsumeLeave?: (id: string) => Promise<{ error: any }>
  stageActions?: Record<string, StageAction[]>
  leaveSectionLabel?: string
  advanceSectionLabel?: string
}

export function LeaveAdvanceApprovalCards({
  leaves,
  advances,
  actingId,
  onReviewLeave,
  onReviewAdvance,
  onConsumeLeave,
  stageActions = {},
  leaveSectionLabel,
  advanceSectionLabel,
}: Props) {
  const { t } = useTranslation()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectingType, setRejectingType] = useState<'leave' | 'advance'>('leave')
  const [rejectionReason, setRejectionReason] = useState('')
  // PATCH_113: per-card APPROVED-DAYS override + approval remarks.
  const [grantedById, setGrantedById] = useState<Record<string, string>>({})
  const [noteById, setNoteById] = useState<Record<string, string>>({})

  const confirmRejection = async () => {
    if (!rejectingId) return
    if (rejectingType === 'leave') await onReviewLeave(rejectingId, false, rejectionReason)
    else await onReviewAdvance(rejectingId, false, rejectionReason)
    setRejectingId(null)
    setRejectionReason('')
  }

  const isFinalStage = (req: MyTurnLeaveRequest) =>
    req.current_stage + 1 >= (req.approval_chain?.length || 0)

  const approveLeave = async (req: MyTurnLeaveRequest) => {
    const note = noteById[req.id]?.trim() || undefined
    const grantedRaw = grantedById[req.id]
    const granted = grantedRaw !== undefined && grantedRaw !== '' ? parseFloat(grantedRaw) : null
    if (granted !== null && granted !== req.days && !note) {
      // The RPC also enforces this; catching it client-side gives a bilingual message.
      Alert.alert(t('common.error'), t('leave.remarkRequiredForDayChange'))
      return
    }
    const { error } = await onReviewLeave(req.id, true, note, granted)
    if (error) { Alert.alert(t('common.error'), t('common.somethingWentWrong')); return }
    if (isFinalStage(req) && onConsumeLeave) {
      // Final approval: draw the balance down. A consumption failure must NOT
      // roll back the approval (sheet behavior — the approval already stands);
      // it surfaces as a warning so hr_admin can re-trigger it manually.
      const { error: consumeError } = await onConsumeLeave(req.id)
      if (consumeError) Alert.alert(t('leave.consumeFailedTitle'), t('leave.consumeFailedMsg'))
    }
  }

  const stageLabel = (role: string) => STAGE_LABELS[role] || role

  const odDetail = (req: MyTurnLeaveRequest) => {
    const d = req.detail
    if (!d) return null
    if (req.type === 'OD' && (d.place || d.purpose)) {
      return (
        <View className="bg-ink-50 rounded-lg p-2 mb-2">
          <Text className="text-xs font-semibold text-ink-500 mb-0.5">{t('leave.odDetails')}</Text>
          {!!d.place && <Text className="text-xs text-ink-700">{t('leave.odPlace')}: {d.place}</Text>}
          {!!d.purpose && <Text className="text-xs text-ink-700">{t('leave.odPurpose')}: {d.purpose}</Text>}
          {!!d.time_from && <Text className="text-xs text-ink-700">{d.time_from} – {d.time_to}</Text>}
        </View>
      )
    }
    if (req.type === 'COFF' && d.extra_work?.length) {
      return (
        <View className="bg-ink-50 rounded-lg p-2 mb-2">
          <Text className="text-xs font-semibold text-ink-500 mb-0.5">{t('leave.extraWork')}</Text>
          {d.extra_work.map((b, i) => (
            <Text key={i} className="text-xs text-ink-700">
              {b.date} • {b.time_from}–{b.time_to} ({b.hours}h){b.details ? ` — ${b.details}` : ''}
            </Text>
          ))}
        </View>
      )
    }
    return null
  }

  // Per-stage checklist: every stage up to the current one, showing the
  // approver, decision and decided-at once acted (from request_stage_actions),
  // mirroring the owner's sheet approval record.
  const checklist = (req: MyTurnLeaveRequest) => {
    const actions = stageActions[req.id] || []
    const chain = req.approval_chain || []
    return (
      <View className="mb-3">
        {chain.map((role, i) => {
          const acted = actions.find(a => a.stage_role === role)
          const isCurrent = i === req.current_stage
          return (
            <View key={i} className="flex-row items-center py-1 border-b border-ink-100">
              {acted ? (
                <Text className={`text-xs font-bold mr-2 ${acted.action === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                  {acted.action === 'approved' ? '✓' : '✗'}
                </Text>
              ) : (
                <Text className="text-xs text-ink-300 mr-2">{isCurrent ? '●' : '○'}</Text>
              )}
              <View className="flex-1">
                <Text className={`text-xs ${acted ? 'text-ink-800 font-medium' : 'text-ink-400'}`}>
                  {stageLabel(role)}
                  {acted?.actor_name ? ` — ${acted.actor_name}` : ''}
                </Text>
                {acted && (
                  <Text className="text-xs text-ink-400">
                    {t(`common.${acted.action}`)} • {new Date(acted.acted_at).toLocaleDateString()}
                    {acted.note ? ` • ${acted.note}` : ''}
                  </Text>
                )}
              </View>
            </View>
          )
        })}
      </View>
    )
  }

  return (
    <>
      {leaves.length > 0 && (
        <>
          <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">
            {leaveSectionLabel || t('supervisor.pendingLeaves')}
          </Text>
          {leaves.map(req => (
            <Card key={req.id} className="mb-3">
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-ink-900">{req.name}</Text>
                  <Text className="text-xs font-mono text-ink-500 mt-0.5">{req.emp_code} • {req.department}</Text>
                </View>
                <Text className="text-xs text-ink-400">{waitingLabel(req.created_at, t)}</Text>
              </View>
              <View className="flex-row flex-wrap items-center gap-2 mb-2">
                <View className="bg-ink-100 rounded-full px-2 py-0.5">
                  <Text className="text-xs font-semibold text-ink-600">{req.type}</Text>
                </View>
                <Text className="text-xs text-ink-500">{req.start_date} → {req.end_date} ({req.days}d)</Text>
              </View>
              {!!req.reason && <Text className="text-sm text-ink-600 mb-2">{req.reason}</Text>}
              {odDetail(req)}
              {checklist(req)}
              {req.current_stage < (req.approval_chain?.length || 0) && (
                <View className="mb-3">
                  <Input
                    label={t('leave.grantedDays')}
                    value={grantedById[req.id] ?? String(req.granted_days ?? req.days)}
                    onChangeText={v => setGrantedById(prev => ({ ...prev, [req.id]: v }))}
                    keyboardType="numeric"
                  />
                  <Text className="text-xs text-ink-400 mb-2">{t('leave.grantedDaysHint', { requested: req.days })}</Text>
                  <Input
                    label={t('leave.approvalRemarks')}
                    value={noteById[req.id] ?? ''}
                    onChangeText={v => setNoteById(prev => ({ ...prev, [req.id]: v }))}
                    multiline
                    numberOfLines={2}
                  />
                  <Text className="text-xs text-ink-400">{t('leave.remarksHint')}</Text>
                </View>
              )}
              <View className="flex-row gap-2">
                <Button
                  title="supervisor.approve"
                  onPress={() => approveLeave(req)}
                  loading={actingId === req.id}
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  icon={<CheckCircle size={14} color="white" />}
                />
                <Button
                  title="supervisor.reject"
                  onPress={() => { setRejectingType('leave'); setRejectingId(req.id) }}
                  loading={actingId === req.id}
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  icon={<XCircle size={14} color="white" />}
                />
              </View>
            </Card>
          ))}
        </>
      )}

      {advances.length > 0 && (
        <>
          <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2 mt-2">
            {advanceSectionLabel || t('supervisor.advanceApprovals')}
          </Text>
          {advances.map(req => (
            <Card key={req.id} className="mb-3">
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-ink-900">{req.name}</Text>
                  <Text className="text-xs font-mono text-ink-500 mt-0.5">{req.emp_code} • {req.department}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-lg font-bold text-brand-600 font-mono">₹{req.amount.toLocaleString()}</Text>
                  <Text className="text-xs text-ink-400">{waitingLabel(req.created_at, t)}</Text>
                </View>
              </View>
              <Text className="text-xs text-ink-500 mb-2">{req.repayment_months} {t('worker.repaymentMonths')}</Text>
              {!!req.reason && <Text className="text-sm text-ink-600 mb-2">{req.reason}</Text>}
              <View className="mb-3">
                <StageBadge stage={req.current_stage} chain={req.approval_chain} />
              </View>
              <View className="flex-row gap-2">
                <Button
                  title="supervisor.approve"
                  onPress={() => onReviewAdvance(req.id, true)}
                  loading={actingId === req.id}
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  icon={<CheckCircle size={14} color="white" />}
                />
                <Button
                  title="supervisor.reject"
                  onPress={() => { setRejectingType('advance'); setRejectingId(req.id) }}
                  loading={actingId === req.id}
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  icon={<XCircle size={14} color="white" />}
                />
              </View>
            </Card>
          ))}
        </>
      )}

      <Modal visible={!!rejectingId} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold text-ink-900 mb-3">{t('supervisor.reject')}</Text>
            <Input value={rejectionReason} onChangeText={setRejectionReason} placeholder={t('common.reason')} multiline numberOfLines={3} className="mb-4" />
            <Button title="common.confirm" onPress={confirmRejection} variant="danger" className="mb-2" />
            <Button title="common.cancel" onPress={() => setRejectingId(null)} variant="ghost" />
          </View>
        </View>
      </Modal>
    </>
  )
}
