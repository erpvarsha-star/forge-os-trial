import React from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { UpdateAppLink } from '@/components/UpdateAppLink'
import { CountPill } from '@/components/CountPill'
import { useActionCountsStore } from '@/hooks/useAssignedTasks'
import { TaskMenuRows } from '@/components/TaskMenuRows'
import { removePushToken } from '@/lib/notifications'
import { LogOut, Globe, Crown, ChevronRight, Eye, CheckCircle, Clock, FileText, Table2, Gavel, Trophy } from 'lucide-react-native'
import { BRAND } from '@/components/theme'

export default function OwnerMore() {
  const { t } = useTranslation()
  const router = useRouter()
  const { employee, logout } = useAuth()
  const { language, toggleLanguage } = useLanguage(employee)
  const approvalsCount = useActionCountsStore(s => s.counts.approvals)
  const nycCount = useActionCountsStore(s => s.counts.needs_your_call)
  if (!employee) return <LoadingScreen />
  const handleLogout = async () => { if (employee) await removePushToken(employee.id); await logout() }
  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Card className="mb-4">
          <View className="flex-row items-center gap-4">
            <View className="w-16 h-16 bg-brand-50 rounded-full items-center justify-center"><Crown size={28} color={BRAND[600]} /></View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-ink-900">{employee.name}</Text>
              <Text className="text-sm text-brand-600 font-semibold capitalize mt-0.5">{employee.role.replace(/_/g, ' ')}</Text>
              <Text className="text-xs font-mono text-ink-500 mt-0.5">{employee.emp_code}</Text>
            </View>
          </View>
        </Card>

        <TouchableOpacity onPress={() => router.push('/(owner)/approvals')} className="mb-2 min-h-touch">
          <Card className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3"><CheckCircle size={20} color={BRAND[600]} /><Text className="text-base text-ink-900">{t('common.approvals')}</Text></View>
            <View className="flex-row items-center gap-2"><CountPill count={approvalsCount} /><ChevronRight size={18} color="#9CA3AF" /></View>
          </Card>
        </TouchableOpacity>

        {/* Decision rows first — a pending Needs Your Call went unseen for 4 days at the bottom of this list. */}
        <TouchableOpacity onPress={() => router.push('/(owner)/needs-your-call')} className="mb-2 min-h-touch">
          <Card className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3"><Gavel size={20} color={BRAND[600]} /><Text className="text-base text-ink-900">{t('needsYourCall.menuLabel')}</Text></View>
            <View className="flex-row items-center gap-2"><CountPill count={nycCount} /><ChevronRight size={18} color="#9CA3AF" /></View>
          </Card>
        </TouchableOpacity>

        <TaskMenuRows group="owner" canAssign={true} teamTasksIsTab />

        <TouchableOpacity onPress={toggleLanguage} className="mb-2 min-h-touch">
          <Card className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3"><Globe size={20} color={BRAND[600]} /><Text className="text-base text-ink-900">{t('common.language')}</Text></View>
            <View className="flex-row items-center gap-1">
              <Text className="text-sm text-ink-500">{language === 'hi' ? 'हिंदी' : 'English'}</Text>
              <ChevronRight size={16} color="#B9C0CC" />
            </View>
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/view-as')} className="mb-2 min-h-touch">
          <Card className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3"><Eye size={20} color={BRAND[600]} /><Text className="text-base text-ink-900">{t('viewAs.title')}</Text></View>
            <ChevronRight size={18} color="#9CA3AF" />
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(owner)/late-review')} className="mb-2 min-h-touch">
          <Card className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3"><Clock size={20} color={BRAND[600]} /><Text className="text-base text-ink-900">{t('reports.lateComersReview')}</Text></View>
            <ChevronRight size={18} color="#9CA3AF" />
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(owner)/payslips')} className="mb-2 min-h-touch">
          <Card className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3"><FileText size={20} color={BRAND[600]} /><Text className="text-base text-ink-900">{t('common.payslip')}</Text></View>
            <ChevronRight size={18} color="#9CA3AF" />
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(owner)/shift-summary')} className="mb-2 min-h-touch">
          <Card className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3"><Table2 size={20} color={BRAND[600]} /><Text className="text-base text-ink-900">{t('shiftCheckinSummary.tab')}</Text></View>
            <ChevronRight size={18} color="#9CA3AF" />
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(owner)/ontime-race')} className="mb-2 min-h-touch">
          <Card className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3"><Trophy size={20} color={BRAND[600]} /><Text className="text-base text-ink-900">{t('ontimeRace.menuLabel')}</Text></View>
            <ChevronRight size={18} color="#9CA3AF" />
          </Card>
        </TouchableOpacity>

        <UpdateAppLink />
        <Button title="common.logout" onPress={handleLogout} variant="danger" size="lg" className="mt-4" icon={<LogOut size={20} color="white" />} />
      </ScrollView>
    </View>
  )
}
