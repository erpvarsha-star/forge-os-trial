import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { supabase } from "@/lib/supabase";

export default function EOTMScreen() {
  const [winners, setWinners] = useState<any[]>([]);

  useEffect(() => { fetchWinners(); }, []);

  const fetchWinners = async () => {
    const { data } = await supabase.from("monthly_scores").select("*, employees(name, emp_code)").eq("month", new Date().toLocaleString("en", { month: "long" })).eq("year", new Date().getFullYear()).eq("eotm_badge", "gold");
    if (data) setWinners(data);
  };

  const categories = ["Attendance", "Production", "Safety", "5S"];

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">Employee of the Month</Text>
        {categories.map((cat, idx) => (
          <Card key={cat} className="mb-2">
            <Text className="font-bold text-gray-800">{cat}</Text>
            {winners[idx] ? (
              <View className="mt-2">
                <Text className="text-primary font-bold">{winners[idx].employees?.name}</Text>
                <Text className="text-gray-500 text-sm">{winners[idx].employees?.emp_code}</Text>
                <Badge text={winners[idx].eotm_badge} variant="warning" className="mt-2" />
              </View>
            ) : (
              <Text className="text-gray-500 text-sm mt-2">No winner selected</Text>
            )}
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}