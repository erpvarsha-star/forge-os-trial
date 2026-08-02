import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { supabase } from "@/lib/supabase";

export default function PlantScoresScreen() {
  const { t } = useTranslation();
  const [deptScores, setDeptScores] = useState<any[]>([]);

  useEffect(() => { fetchScores(); }, []);

  const fetchScores = async () => {
    const { data } = await supabase.from("monthly_scores").select("*, employees(name, department_id), departments(name)").eq("month", new Date().toLocaleString("en", { month: "long" })).eq("year", new Date().getFullYear());
    if (data) setDeptScores(data);
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("plantHead.plantScore")}</Text>
        {deptScores.map((s) => (
          <Card key={s.id} className="mb-2">
            <View className="flex-row justify-between">
              <Text className="font-bold text-gray-800">{s.departments?.name || s.employees?.name}</Text>
              <Text className="text-xl font-bold text-primary">{s.composite_score}</Text>
            </View>
            <ProgressBar progress={s.composite_score} className="mt-2" />
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}