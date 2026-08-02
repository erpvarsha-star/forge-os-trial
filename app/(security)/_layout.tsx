import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Truck, UserCheck, ShieldCheck } from "lucide-react-native";

export default function SecurityLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#E65C00", tabBarInactiveTintColor: "#9CA3AF", headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t("security.vehicleLog"), tabBarIcon: ({ color, size }) => <Truck size={size} color={color} /> }} />
      <Tabs.Screen name="team" options={{ title: t("security.checkpoint2"), tabBarIcon: ({ color, size }) => <UserCheck size={size} color={color} /> }} />
      <Tabs.Screen name="eod-lock" options={{ title: t("security.eodConfirmation"), tabBarIcon: ({ color, size }) => <ShieldCheck size={size} color={color} /> }} />
    </Tabs>
  );
}
