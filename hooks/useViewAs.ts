import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Role } from '@/types'

/**
 * "View as" — lets an admin inspect the app as any role and any department
 * without holding that person's login.
 *
 * WHY: checking the app used to mean signing in as seven different employees
 * and resetting each PIN afterwards with HR_reset_pin.sql. That is slow, and
 * worse, it puts a real person's account into a known-PIN state every time
 * somebody wants to look at a screen.
 *
 * ⚠ THIS IS PRESENTATION ONLY. It changes which screens render and which
 * department they query for — it does NOT change who you are to the database.
 * Every request still carries the admin's own JWT, so RLS answers for the
 * admin's real role. Viewing as a member cannot see more than the admin
 * already could; it can only see less. That is the entire security model here,
 * and it is why this is safe to ship without a new RLS policy:
 *
 *   - An owner viewing as a member sees the worker screens filled with data
 *     the owner is already entitled to read.
 *   - A member cannot reach this store at all — the picker is gated on the
 *     REAL role (see canUseViewAs), not the effective one.
 *
 * It is deliberately NOT impersonation: nothing here lets you act as someone
 * else. Writes still land under the admin's own id, so an approval made while
 * viewing as a supervisor is recorded as the admin's approval, which is the
 * honest outcome.
 */

/** Roles allowed to switch view. Checked against the employee's REAL role. */
const VIEW_AS_ROLES: Role[] = ['owner', 'plant_head', 'hr_admin']

const STORAGE_KEY = 'viewAs'

interface ViewAsState {
  role: Role | null
  department: string | null
  category: string | null
  /** False until AsyncStorage has been read, so the router does not flash the wrong screen. */
  isHydrated: boolean
  hydrate: () => Promise<void>
  setViewAs: (next: { role: Role | null; department: string | null; category: string | null }) => Promise<void>
  clear: () => Promise<void>
}

export const useViewAsStore = create<ViewAsState>((set) => ({
  role: null,
  department: null,
  category: null,
  isHydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      const saved = raw ? JSON.parse(raw) : null
      set({
        role: saved?.role ?? null,
        department: saved?.department ?? null,
        category: saved?.category ?? null,
        isHydrated: true,
      })
    } catch {
      // A corrupt value must not lock anyone out of their own app.
      set({ role: null, department: null, category: null, isHydrated: true })
    }
  },

  setViewAs: async (next) => {
    set({ role: next.role, department: next.department, category: next.category })
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  },

  clear: async () => {
    set({ role: null, department: null, category: null })
    await AsyncStorage.removeItem(STORAGE_KEY)
  },
}))

export function canUseViewAs(realRole: Role | undefined): boolean {
  return !!realRole && VIEW_AS_ROLES.includes(realRole)
}

export { VIEW_AS_ROLES }
