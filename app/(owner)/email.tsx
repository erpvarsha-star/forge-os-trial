import { View, Text, ScrollView } from "react-native";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";

export default function OwnerEmailScreen() {
  const inboxes = [
    { name: "CEO", unread: 3, priority: "high" },
    { name: "Plant Head", unread: 5, priority: "high" },
    { name: "HR", unread: 12, priority: "medium" },
    { name: "Finance", unread: 2, priority: "medium" },
    { name: "Production", unread: 8, priority: "high" },
    { name: "Legal", unread: 1, priority: "low" },
  ];

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">Email Monitoring</Text>
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