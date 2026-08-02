import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Home, Users, CalendarDays, DollarSign } from "lucide-react-native";

export default function HRAdminLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#E65C00", tabBarInactiveTintColor: "#9CA3AF", headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t("app.name"), tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }} />
      <Tabs.Screen name="employees" options={{ title: t("hrAdmin.employeeMaster"), tabBarIcon: ({ color, size }) => <Users size={size} color={color} /> }} />
      <Tabs.Screen name="shifts" options={{ title: t("hrAdmin.shiftPlanning"), tabBarIcon: ({ color, size }) => <CalendarDays size={size} color={color} /> }} />
      <Tabs.Screen name="payroll" options={{ title: t("hrAdmin.payrollSummary"), tabBarIcon: ({ color, size }) => <DollarSign size={size} color={color} /> }} />
    </Tabs>
  );
}