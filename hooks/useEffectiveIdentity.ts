import { useAuth } from '@/hooks/useAuth'
import { useViewAsStore, canUseViewAs } from '@/hooks/useViewAs'
import type { Role } from '@/types'

/**
 * The role and department the UI should render for — the admin's own unless
 * they have switched view.
 *
 * Screens should use this instead of `employee.role` / `employee.department`
 * whenever the value decides what to SHOW. They should keep using
 * `employee.id` for anything they WRITE, because a view switch never changes
 * who is acting.
 *
 * The override is ignored unless the employee's REAL role is allowed to use
 * it, so a stale AsyncStorage entry surviving a role change (or copied onto
 * another device) grants nothing.
 */
export function useEffectiveIdentity(): {
  role: Role | undefined
  department: string | undefined
  category: string | undefined
  isViewingAs: boolean
  realRole: Role | undefined
} {
  const { employee } = useAuth()
  const { role: viewRole, department: viewDepartment, category: viewCategory } = useViewAsStore()

  const allowed = canUseViewAs(employee?.role)

  // Any one of the three being set counts as viewing — an owner checking the
  // Forge Shop's forms without changing role still needs the exit banner.
  const isViewingAs = allowed && !!(viewRole || viewDepartment || viewCategory)

  return {
    role: (allowed && viewRole) || employee?.role,
    department: (allowed && viewDepartment) || employee?.department,
    category: (allowed && viewCategory) || employee?.category,
    isViewingAs,
    realRole: employee?.role,
  }
}
