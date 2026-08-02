import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Home, Building2, Mail, AlertTriangle } from "lucide-react-native";

export default function PlantHeadLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#E65C00", tabBarInactiveTintColor: "#9CA3AF", headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t("app.name"), tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }} />
      <Tabs.Screen name="departments" options={{ title: t("plantHead.allDepartments"), tabBarIcon: ({ color, size }) => <Building2 size={size} color={color} /> }} />
      <Tabs.Screen name="approvals" options={{ title: t("plantHead.pendingSignOff"), tabBarIcon: ({ color, size }) => <AlertTriangle size={size} color={color} /> }} />
      <Tabs.Screen name="email" options={{ title: t("plantHead.emailDashboard"), tabBarIcon: ({ color, size }) => <Mail size={size} color={color} /> }} />
    </Tabs>
  );
}