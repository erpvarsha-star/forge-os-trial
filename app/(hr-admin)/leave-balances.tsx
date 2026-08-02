import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { supabase } from "@/lib/supabase";
import { LeaveBalance } from "@/types";

export default function LeaveBalancesScreen() {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);

  useEffect(() => { fetchBalances(); }, []);

  const fetchBalances = async () => {
    const { data } = await supabase.from("leave_balances").select("*, employees(name, emp_code)").eq("year", new Date().getFullYear());
    if (data) setBalances(data as LeaveBalance[]);
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">Leave Balance Management</Text>
        {(balances as any[]).map((b) => (
          <Card key={b.id} className="mb-2">
            <View className="flex-row justify-between">
              <View><Text className="font-bold">{b.employees?.name}</Text><Text className="text-gray-500 text-sm">{b.employees?.emp_code}</Text></View>
              <View className="items-end"><Text className="text-primary font-bold">EL: {b.el_balance} CL: {b.cl_balance} SL: {b.sl_balance}</Text></View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}