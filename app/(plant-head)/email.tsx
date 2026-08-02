import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";

export default function EmailDashboardScreen() {
  const { t } = useTranslation();
  const [inboxes] = useState([
    { name: "HR", unread: 5, priority: "high" },
    { name: "Production", unread: 2, priority: "medium" },
    { name: "Maintenance", unread: 0, priority: "low" },
    { name: "Safety", unread: 8, priority: "high" },
    { name: "Finance", unread: 1, priority: "medium" },
    { name: "IT", unread: 0, priority: "low" },
  ]);

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("plantHead.emailDashboard")}</Text>
        <Text className="text-gray-500 mb-4">{t("plantHead.priorityInboxes")}</Text>
        {inboxes.map((box) => (
          <Card key={box.name} className="flex-row justify-between items-center mb-2">
            <View><Text className="font-bold text-gray-800">{box.name}</Text><Text className="text-gray-500 text-sm">{box.unread} unread</Text></View>
            <Badge text={box.priority} variant={box.priority === "high" ? "danger" : box.priority === "medium" ? "warning" : "info"} />
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}