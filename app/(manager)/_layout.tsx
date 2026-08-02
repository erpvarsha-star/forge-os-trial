import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Home, BarChart3, CheckCircle, ListTodo } from "lucide-react-native";

export default function ManagerLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#E65C00", tabBarInactiveTintColor: "#9CA3AF", headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t("app.name"), tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }} />
      <Tabs.Screen name="attendance" options={{ title: t("manager.attendancePercent"), tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} /> }} />
      <Tabs.Screen name="approvals" options={{ title: "Approvals", tabBarIcon: ({ color, size }) => <CheckCircle size={size} color={color} /> }} />
      <Tabs.Screen name="tasks" options={{ title: t("manager.deptTasks"), tabBarIcon: ({ color, size }) => <ListTodo size={size} color={color} /> }} />
    </Tabs>
  );
}