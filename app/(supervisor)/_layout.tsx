import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Home, Users, ClipboardList, Wrench } from "lucide-react-native";

export default function SupervisorLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#E65C00", tabBarInactiveTintColor: "#9CA3AF", headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t("app.name"), tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }} />
      <Tabs.Screen name="team" options={{ title: t("supervisor.teamList"), tabBarIcon: ({ color, size }) => <Users size={size} color={color} /> }} />
      <Tabs.Screen name="approvals" options={{ title: t("supervisor.pendingApprovals"), tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} /> }} />
      <Tabs.Screen name="tasks" options={{ title: t("supervisor.maintenanceTasks"), tabBarIcon: ({ color, size }) => <Wrench size={size} color={color} /> }} />
    </Tabs>
  );
}