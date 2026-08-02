import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { supabase } from "@/lib/supabase";
import { PayrollRecord } from "@/types";
import { formatCurrency } from "@/lib/utils";

export default function PayrollSummaryScreen() {
  const [records, setRecords] = useState<PayrollRecord[]>([]);

  useEffect(() => { fetchPayroll(); }, []);

  const fetchPayroll = async () => {
    const { data } = await supabase.from("payroll_records").select("*, employees(name, emp_code)").eq("month", new Date().toLocaleString("en", { month: "long" })).eq("year", new Date().getFullYear());
    if (data) setRecords(data as PayrollRecord[]);
  };

  const totalNet = records.reduce((sum, r) => sum + r.net_pay, 0);

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">Payroll Summary</Text>
        <Card className="bg-primary/5"><Text className="text-3xl font-bold text-primary text-center">{formatCurrency(totalNet)}</Text><Text className="text-center text-gray-500">Total Net Pay</Text></Card>
        {records.map((r: any) => (
          <Card key={r.id} className="mt-2">
            <View className="flex-row justify-between"><Text className="font-bold">{r.employees?.name}</Text><Text className="font-bold text-primary">{formatCurrency(r.net_pay)}</Text></View>
            <Text className="text-gray-500 text-sm">{r.employees?.emp_code}</Text>
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}