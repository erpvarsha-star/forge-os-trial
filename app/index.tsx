import { Redirect } from "expo-router";
import { useAuthStore } from "@/hooks/useAuth";

export default function Index() {
  const { isAuthenticated, employee, isLoading } = useAuthStore();
  if (isLoading) return null;
  if (!isAuthenticated || !employee) return <Redirect href="/(auth)/login" />;
  return <Redirect href={useAuthStore.getState().getRoleRoute() as any} />;
}