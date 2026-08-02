import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { supabase } from "@/lib/supabase";
import { FraudAlert } from "@/types";

export default function FraudAlertsScreen() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);

  useEffect(() => { fetchAlerts(); }, []);

  const fetchAlerts = async () => {
    const { data } = await supabase.from("fraud_alerts").select("*").eq("status", "open");
    if (data) setAlerts(data as FraudAlert[]);
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">Fraud Alerts</Text>
        {alerts.map((alert) => (
          <Card key={alert.id} className="mb-2 border-danger">
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="font-bold text-gray-800 capitalize">{alert.type.replace("_", " ")}</Text>
                <Text className="text-gray-500 text-sm">{alert.description}</Text>
              </View>
              <Badge text={alert.severity} variant={alert.severity === "high" ? "danger" : alert.severity === "medium" ? "warning" : "info"} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}