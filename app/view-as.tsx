import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Eye, Check, RotateCcw } from 'lucide-react-native'
import { useAuth } from '@/hooks/useAuth'
import { useViewAsStore, canUseViewAs } from '@/hooks/useViewAs'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { BRAND } from '@/components/theme'
import { supabase } from '@/lib/supabase'
import { ROLE_ROUTES } from '@/constants'
import type { Role } from '@/types'

/**
 * Admin inspection screen — pick a role, a department and a category, and the
 * app renders as that person would see it.
 *
 * Replaces the old way of checking the app, which was to sign in as seven
 * different employees and reset each PIN afterwards with HR_reset_pin.sql.
 * That left real accounts sitting on a known PIN every time anyone wanted to
 * look at a screen.
 *
 * Gated on the REAL role, never the effective one, so a switch cannot be used
 * to reach the switcher from a role that should not have it.
 *
 * ⚠ Presentation only — see hooks/useViewAs.ts. The database still answers to
 * the admin's own JWT, so this shows what an owner can see rendered in a
 * member's layout. It is not impersonation and grants nothing.
 */

const ALL_ROLES: Role[] = [
  'member', 'supervisor', 'manager', 'plant_head', 'hr_admin', 'owner', 'security_guard',
]

export default function ViewAsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { employee } = useAuth()
  const { role, department, category, setViewAs, clear } = useViewAsStore()

  const [departments, setDepartments] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [pickedRole, setPickedRole] = useState<Role | null>(role)
  const [pickedDept, setPickedDept] = useState<string | null>(department)
  const [pickedCategory, setPickedCategory] = useState<string | null>(category)

  useEffect(() => {
    const load = async () => {
      // Distinct values straight from the roster rather than a hardcoded list,
      // so a department added by a future patch appears here automatically.
      const { data } = await supabase.from('employees').select('department, category').eq('is_active', true)
      const depts = new Set<string>()
      const cats = new Set<string>()
      for (const row of (data ?? []) as { department: string | null; category: string | null }[]) {
        if (row.department) depts.add(row.department)
        if (row.category) cats.add(row.category)
      }
      setDepartments([...depts].sort())
      setCategories([...cats].sort())
    }
    load()
  }, [])

  if (!employee) return <LoadingScreen />

  // Not an error worth a scary screen — just not for this person.
  if (!canUseViewAs(employee.role)) {
    return (
      <View className="flex-1 bg-ink-50">
        <Header empCode={employee.emp_code} role={employee.role} />
        <View className="p-4">
          <Card>
            <Text className="text-sm font-bold text-ink-900">{t('viewAs.notAllowedTitle')}</Text>
            <Text className="text-xs text-ink-600 mt-1">{t('viewAs.notAllowedBody')}</Text>
            <Button title="common.back" onPress={() => router.back()} variant="secondary" size="sm" className="mt-3" />
          </Card>
        </View>
      </View>
    )
  }

  const apply = async () => {
    await setViewAs({ role: pickedRole, department: pickedDept, category: pickedCategory })
    router.replace((ROLE_ROUTES[pickedRole ?? employee.role] ?? '/') as any)
  }

  const reset = async () => {
    await clear()
    setPickedRole(null)
    setPickedDept(null)
    setPickedCategory(null)
    router.replace('/')
  }

  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3 py-2 rounded-full border mr-2 mb-2 min-h-touch justify-center ${
        active ? 'bg-brand-600 border-brand-600' : 'bg-white border-ink-200'
      }`}
    >
      <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-ink-700'}`}>{label}</Text>
    </TouchableOpacity>
  )

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row items-center gap-3 mb-4">
          <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center">
            <Eye size={20} color={BRAND[600]} />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-ink-900 tracking-tight">{t('viewAs.title')}</Text>
            <Text className="text-xs text-ink-500 mt-0.5">{t('viewAs.subtitle')}</Text>
          </View>
        </View>

        <Card className="mb-3" title={t('viewAs.role')}>
          <View className="flex-row flex-wrap">
            <Chip label={t('viewAs.myOwn')} active={pickedRole === null} onPress={() => setPickedRole(null)} />
            {ALL_ROLES.map(r => (
              <Chip key={r} label={r.replace(/_/g, ' ')} active={pickedRole === r} onPress={() => setPickedRole(r)} />
            ))}
          </View>
        </Card>

        <Card className="mb-3" title={t('viewAs.department')}>
          <View className="flex-row flex-wrap">
            <Chip label={t('viewAs.myOwn')} active={pickedDept === null} onPress={() => setPickedDept(null)} />
            {departments.map(d => (
              <Chip key={d} label={d} active={pickedDept === d} onPress={() => setPickedDept(d)} />
            ))}
          </View>
        </Card>

        <Card className="mb-3" title={t('viewAs.category')}>
          <View className="flex-row flex-wrap">
            <Chip label={t('viewAs.myOwn')} active={pickedCategory === null} onPress={() => setPickedCategory(null)} />
            {categories.map(c => (
              <Chip key={c} label={c} active={pickedCategory === c} onPress={() => setPickedCategory(c)} />
            ))}
          </View>
        </Card>

        <Card className="mb-3" variant="flat">
          <Text className="text-xs text-ink-600 leading-5">{t('viewAs.explainer')}</Text>
        </Card>

        <Button title="viewAs.apply" onPress={apply} variant="primary" icon={<Check size={16} color="white" />} />
        <View className="h-2" />
        <Button title="viewAs.reset" onPress={reset} variant="secondary" icon={<RotateCcw size={16} color={BRAND[600]} />} />
      </ScrollView>
    </View>
  )
}
