import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

export default function AdvanceLedgerScreen() {
  const [advances, setAdvances] = useState<any[]>([]);

  useEffect(() => { fetchAdvances(); }, []);

  const fetchAdvances = async () => {
    const { data } = await supabase.from("salary_advances").select("*, employees(name, emp_code)").order("applied_on", { ascending: false });
    if (data) setAdvances(data);
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">Advance Ledger</Text>
        {advances.map((adv) => (
          <Card key={adv.id} className="mb-2">
            <View className="flex-row justify-between">
              <View><Text className="font-bold">{adv.employees?.name}</Text><Text className="text-gray-500 text-sm">{adv.employees?.emp_code}</Text></View>
              <Text className={`font-bold ${adv.status === "disbursed" ? "text-danger" : "text-primary"}`}>{formatCurrency(adv.amount)}</Text>
            </View>
            <Text className="text-gray-500 text-sm">Outstanding: {formatCurrency(adv.outstanding_balance)}</Text>
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}