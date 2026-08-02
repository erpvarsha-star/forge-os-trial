import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

export default function PlantHeadApprovalsScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [advances, setAdvances] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"leaves" | "advances">("advances");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: a } = await supabase.from("salary_advances").select("*, employees(name, emp_code)").eq("status", "pending");
    const { data: l } = await supabase.from("leave_requests").select("*, employees(name, emp_code)").eq("status", "pending");
    if (a) setAdvances(a);
    if (l) setLeaves(l);
  };

  const approveAdvance = async (id: string) => {
    await supabase.from("salary_advances").update({ status: "approved", approved_by: employee!.id }).eq("id", id);
    Alert.alert("Approved"); fetchData();
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("plantHead.pendingSignOff")}</Text>
        <View className="flex-row mb-4">
          <Button title={`Advances (${advances.length})`} onPress={() => setActiveTab("advances")} variant={activeTab === "advances" ? "primary" : "outline"} className="flex-1 mr-2" />
          <Button title={`Leaves (${leaves.length})`} onPress={() => setActiveTab("leaves")} variant={activeTab === "leaves" ? "primary" : "outline"} className="flex-1" />
        </View>
        {activeTab === "advances" && advances.map((adv) => (
          <Card key={adv.id} className="mb-2">
            <Text className="font-bold">{adv.employees?.name}</Text>
            <Text className="text-gray-500">{formatCurrency(adv.amount)}</Text>
            {adv.amount > (adv.employees?.salary || 0) * 0.3 && <Badge text={t("plantHead.advanceLimit")} variant="danger" className="mt-2" />}
            <Button title="Approve" onPress={() => approveAdvance(adv.id)} size="sm" className="mt-2" />
          </Card>
        ))}
        {activeTab === "leaves" && leaves.map((leave) => (
          <Card key={leave.id} className="mb-2">
            <Text className="font-bold">{leave.employees?.name}</Text>
            <Text className="text-gray-500">{leave.leave_type}: {leave.start_date} to {leave.end_date}</Text>
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}