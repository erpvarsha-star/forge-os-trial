import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export default function ProductionConfirmScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [supervisorTotal, setSupervisorTotal] = useState(0);
  const [operatorTotal, setOperatorTotal] = useState(0);

  useEffect(() => { fetchTotals(); }, []);

  const fetchTotals = async () => {
    setSupervisorTotal(1500);
    setOperatorTotal(1420);
  };

  const variance = supervisorTotal > 0 ? ((supervisorTotal - operatorTotal) / supervisorTotal) * 100 : 0;
  const isFlagged = variance > 5;

  const confirm = async () => {
    Alert.alert("Success", "Production confirmed");
    router.back();
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("supervisor.productionConfirm")}</Text>
        <Card>
          <View className="flex-row justify-between mb-4">
            <View className="items-center"><Text className="text-2xl font-bold text-primary">{supervisorTotal}</Text><Text className="text-gray-500">{t("supervisor.supervisorTotal")}</Text></View>
            <View className="items-center"><Text className="text-2xl font-bold text-info">{operatorTotal}</Text><Text className="text-gray-500">{t("supervisor.operatorTotal")}</Text></View>
          </View>
          <View className="border-t border-gray-200 pt-4">
            <Text className="text-gray-600">{t("supervisor.variance")}: {variance.toFixed(2)}%</Text>
            {isFlagged && <Text className="text-danger font-bold mt-2">Variance exceeds 5% - Flagged for review</Text>}
          </View>
        </Card>
        <Button title={t("app.confirm")} onPress={confirm} className="mt-4" disabled={isFlagged} />
      </ScrollView>
    </SafeView>
  );
}