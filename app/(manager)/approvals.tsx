import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

export default function ManagerApprovalsScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"leaves" | "advances">("leaves");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: l } = await supabase.from("leave_requests").select("*, employees(name, emp_code)").eq("status", "pending");
    const { data: a } = await supabase.from("salary_advances").select("*, employees(name, emp_code, department)").eq("status", "pending");
    if (l) setLeaves(l);
    if (a) setAdvances(a);
  };

  const approveLeave = async (id: string) => {
    await supabase.from("leave_requests").update({ status: "approved", approved_by: employee!.id, approved_on: new Date().toISOString() }).eq("id", id);
    Alert.alert("Approved"); fetchData();
  };

  const approveAdvance = async (id: string) => {
    await supabase.from("salary_advances").update({ status: "approved", approved_by: employee!.id }).eq("id", id);
    Alert.alert("Approved"); fetchData();
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">Approvals</Text>
        <View className="flex-row mb-4">
          <Button title={`Leaves (${leaves.length})`} onPress={() => setActiveTab("leaves")} variant={activeTab === "leaves" ? "primary" : "outline"} className="flex-1 mr-2" />
          <Button title={`Advances (${advances.length})`} onPress={() => setActiveTab("advances")} variant={activeTab === "advances" ? "primary" : "outline"} className="flex-1" />
        </View>
        {activeTab === "leaves" && leaves.map((req) => (
          <Card key={req.id} className="mb-2">
            <Text className="font-bold">{req.employees?.name}</Text>
            <Text className="text-gray-500">{req.leave_type}: {req.start_date} to {req.end_date}</Text>
            <Button title="Approve" onPress={() => approveLeave(req.id)} size="sm" className="mt-2" />
          </Card>
        ))}
        {activeTab === "advances" && advances.map((adv) => (
          <Card key={adv.id} className="mb-2">
            <Text className="font-bold">{adv.employees?.name}</Text>
            <Text className="text-gray-500">{formatCurrency(adv.amount)} • {adv.repayment_months} months</Text>
            <Text className="text-gray-500 text-sm">{adv.reason}</Text>
            <Button title="Approve" onPress={() => approveAdvance(adv.id)} size="sm" className="mt-2" />
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}