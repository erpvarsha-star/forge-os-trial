import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/Input'

export interface SalaryBreakup {
  ctc_annual: string
  basic: string
  hra: string
  conveyance: string
  washing: string
  education: string
  heat_allow: string
  vda: string
  production_allow: string
  medical: string
  professional_development: string
  communication: string
  uniform: string
}

export const emptyBreakup: SalaryBreakup = {
  ctc_annual: '', basic: '', hra: '', conveyance: '',
  washing: '', education: '', heat_allow: '', vda: '', production_allow: '',
  medical: '', professional_development: '', communication: '', uniform: '',
}

export function breakupIsValid(b: SalaryBreakup): boolean {
  return !!(b.ctc_annual.trim() && b.basic.trim() && b.hra.trim() && b.conveyance.trim())
}

export function breakupToPayload(b: SalaryBreakup): Record<string, number> {
  const payload: Record<string, number> = {}
  ;(Object.keys(b) as (keyof SalaryBreakup)[]).forEach(key => {
    const raw = b[key].trim()
    if (raw) payload[key] = Number(raw)
  })
  return payload
}

/** Shared CTC breakup entry — used both when HR onboards a new hire and when
 *  HR requests a salary revision for an existing employee. Neither writes
 *  anything directly: both go through a request the owner must approve. */
export function SalaryBreakupFields({
  value,
  onChange,
}: {
  value: SalaryBreakup
  onChange: (v: SalaryBreakup) => void
}) {
  const { t } = useTranslation()
  const set = (key: keyof SalaryBreakup) => (text: string) => onChange({ ...value, [key]: text })

  return (
    <View className="gap-4">
      <Input label={t('hrAdmin.ctcAnnual')} value={value.ctc_annual} onChangeText={set('ctc_annual')} keyboardType="numeric" required />
      <Input label={t('hrAdmin.basic')} value={value.basic} onChangeText={set('basic')} keyboardType="numeric" required />
      <Input label={t('hrAdmin.hra')} value={value.hra} onChangeText={set('hra')} keyboardType="numeric" required />
      <Input label={t('hrAdmin.conveyance')} value={value.conveyance} onChangeText={set('conveyance')} keyboardType="numeric" required />

      <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mt-1">
        {t('hrAdmin.additionalAllowances')}
      </Text>
      <Input label={t('hrAdmin.washing')} value={value.washing} onChangeText={set('washing')} keyboardType="numeric" helperText={t('common.optional')} />
      <Input label={t('hrAdmin.education')} value={value.education} onChangeText={set('education')} keyboardType="numeric" helperText={t('common.optional')} />
      <Input label={t('hrAdmin.heatAllow')} value={value.heat_allow} onChangeText={set('heat_allow')} keyboardType="numeric" helperText={t('hrAdmin.workerOnlyHint')} />
      <Input label={t('hrAdmin.vda')} value={value.vda} onChangeText={set('vda')} keyboardType="numeric" helperText={t('hrAdmin.workerOnlyHint')} />
      <Input label={t('hrAdmin.productionAllow')} value={value.production_allow} onChangeText={set('production_allow')} keyboardType="numeric" helperText={t('hrAdmin.workerOnlyHint')} />
      <Input label={t('hrAdmin.medical')} value={value.medical} onChangeText={set('medical')} keyboardType="numeric" helperText={t('hrAdmin.staffOnlyHint')} />
      <Input label={t('hrAdmin.professionalDevelopment')} value={value.professional_development} onChangeText={set('professional_development')} keyboardType="numeric" helperText={t('hrAdmin.staffOnlyHint')} />
      <Input label={t('hrAdmin.communication')} value={value.communication} onChangeText={set('communication')} keyboardType="numeric" helperText={t('hrAdmin.staffOnlyHint')} />
      <Input label={t('hrAdmin.uniform')} value={value.uniform} onChangeText={set('uniform')} keyboardType="numeric" helperText={t('hrAdmin.staffOnlyHint')} />
    </View>
  )
}
