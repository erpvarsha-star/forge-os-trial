import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [scores, setScores] = useState<any[]>([]);

  useEffect(() => { fetchScores(); }, []);

  const fetchScores = async () => {
    if (!employee) return;
    const { data } = await supabase.from("monthly_scores").select("*, employees(name, emp_code)").eq("month", new Date().toLocaleString("en", { month: "long" })).eq("year", new Date().getFullYear()).order("composite_score", { ascending: false });
    if (data) setScores(data);
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("manager.deptLeaderboard")}</Text>
        {scores.map((s, idx) => (
          <Card key={s.id} className="mb-2">
            <View className="flex-row items-center">
              <Text className="text-2xl font-bold text-primary w-10">#{idx + 1}</Text>
              <View className="flex-1">
                <Text className="font-bold text-gray-800">{s.employees?.name}</Text>
                <Text className="text-gray-500 text-sm">{s.employees?.emp_code}</Text>
              </View>
              <Text className="text-xl font-bold text-primary">{s.composite_score}</Text>
            </View>
            <ProgressBar progress={s.composite_score} className="mt-2" />
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}