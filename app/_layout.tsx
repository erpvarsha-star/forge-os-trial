import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/lib/i18n";
import { useEffect } from "react";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useNotifications } from "@/hooks/useNotifications";
import { Loading } from "@/components/Loading";
import { router } from "expo-router";

export default function RootLayout() {
  const { setEmployee, setSession, setLoading, isLoading, isAuthenticated, employee } = useAuthStore();
  useNotifications();

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSession(session);
        const { data: emp } = await supabase.from("employees").select("*").eq("id", session.user.id).single();
        if (emp) setEmployee(emp);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && employee) {
      router.replace(useAuthStore.getState().getRoleRoute() as any);
    } else {
      router.replace("/(auth)/login");
    }
  }, [isLoading, isAuthenticated, employee]);

  if (isLoading) return <Loading />;

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(worker)" />
        <Stack.Screen name="(supervisor)" />
        <Stack.Screen name="(manager)" />
        <Stack.Screen name="(plant-head)" />
        <Stack.Screen name="(hr-admin)" />
        <Stack.Screen name="(owner)" />
        <Stack.Screen name="(security)" />
        <Stack.Screen name="qr" />
      </Stack>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}