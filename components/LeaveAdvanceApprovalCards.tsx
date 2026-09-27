import React, { useState } from 'react'
import { View, Text, Modal } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { MyTurnLeaveRequest, MyTurnAdvanceRequest } from '@/hooks/useLeaveAdvanceApprovals'
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
  onReviewLeave: (id: string, approve: boolean, note?: string) => Promise<{ error: any }>
  onReviewAdvance: (id: string, approve: boolean, note?: string) => Promise<{ error: any }>
  leaveSectionLabel?: string
  advanceSectionLabel?: string
}

export function LeaveAdvanceApprovalCards({
  leaves,
  advances,
  actingId,
  onReviewLeave,
  onReviewAdvance,
  leaveSectionLabel,
  advanceSectionLabel,
}: Props) {
  const { t } = useTranslation()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectingType, setRejectingType] = useState<'leave' | 'advance'>('leave')
  const [rejectionReason, setRejectionReason] = useState('')

  const confirmRejection = async () => {
    if (!rejectingId) return
    if (rejectingType === 'leave') await onReviewLeave(rejectingId, false, rejectionReason)
    else await onReviewAdvance(rejectingId, false, rejectionReason)
    setRejectingId(null)
    setRejectionReason('')
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
              <View className="mb-3">
                <StageBadge stage={req.current_stage} chain={req.approval_chain} />
              </View>
              <View className="flex-row gap-2">
                <Button
                  title="supervisor.approve"
                  onPress={() => onReviewLeave(req.id, true)}
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
