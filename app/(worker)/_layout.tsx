import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Home, Calendar, Trophy, FileText, MoreHorizontal } from "lucide-react-native";

export default function WorkerLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#E65C00", tabBarInactiveTintColor: "#9CA3AF", headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t("app.name"), tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }} />
      <Tabs.Screen name="attendance" options={{ title: t("attendance.title"), tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} /> }} />
      <Tabs.Screen name="score" options={{ title: t("score.title"), tabBarIcon: ({ color, size }) => <Trophy size={size} color={color} /> }} />
      <Tabs.Screen name="leave" options={{ title: t("leave.title"), tabBarIcon: ({ color, size }) => <FileText size={size} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: t("more.title"), tabBarIcon: ({ color, size }) => <MoreHorizontal size={size} color={color} /> }} />
    </Tabs>
  );
}