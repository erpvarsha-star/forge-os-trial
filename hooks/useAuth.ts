import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { Employee, UserRole } from "@/types";
import { router } from "expo-router";

interface AuthState {
  employee: Employee | null; session: any | null; isLoading: boolean; isAuthenticated: boolean;
  setEmployee: (e: Employee | null) => void; setSession: (s: any | null) => void; setLoading: (l: boolean) => void;
  logout: () => Promise<void>; getRoleRoute: () => string;
}

export const useAuthStore = create<AuthState>()(persist((set, get) => ({
  employee: null, session: null, isLoading: true, isAuthenticated: false,
  setEmployee: (employee) => set({ employee, isAuthenticated: !!employee }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: async () => {
    await supabase.auth.signOut();
    set({ employee: null, session: null, isAuthenticated: false });
    router.replace("/(auth)/login");
  },
  getRoleRoute: () => {
    const role = get().employee?.role;
    switch (role) {
      case "member": return "/(worker)";
      case "supervisor": return "/(supervisor)";
      case "manager": return "/(manager)";
      case "plant_head": return "/(plant-head)";
      case "hr_admin": return "/(hr-admin)";
      case "owner": return "/(owner)";
      case "security_guard": return "/(security)";
      default: return "/(auth)/login";
    }
  },
}), { name: "auth-storage", storage: createJSONStorage(() => AsyncStorage) }));

export function useAuth() {
  const store = useAuthStore();
  const loginWithPhone = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone: `+91${phone}` });
    return { error };
  };
  const verifyOtp = async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({ phone: `+91${phone}`, token, type: "sms" });
    if (error || !data.session) return { error: error || new Error("Verification failed"), employee: null };
    store.setSession(data.session);
    const { data: employeeData, error: empError } = await supabase.from("employees").select("*").eq("phone", `+91${phone}`).single();
    if (empError || !employeeData) return { error: new Error("Number not registered"), employee: null };
    const employee = employeeData as Employee;
    store.setEmployee(employee);
    return { error: null, employee };
  };
  return { ...store, loginWithPhone, verifyOtp };
}