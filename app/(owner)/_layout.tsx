import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Home, TrendingUp, AlertOctagon, Mail } from "lucide-react-native";

export default function OwnerLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#E65C00", tabBarInactiveTintColor: "#9CA3AF", headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t("app.name"), tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }} />
      <Tabs.Screen name="kpi" options={{ title: t("owner.kpiDashboard"), tabBarIcon: ({ color, size }) => <TrendingUp size={size} color={color} /> }} />
      <Tabs.Screen name="alerts" options={{ title: t("owner.fraudAlerts"), tabBarIcon: ({ color, size }) => <AlertOctagon size={size} color={color} /> }} />
      <Tabs.Screen name="email" options={{ title: t("owner.emailMonitoring"), tabBarIcon: ({ color, size }) => <Mail size={size} color={color} /> }} />
    </Tabs>
  );
}