import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/ProgressBar";
import { supabase } from "@/lib/supabase";

export default function PlantHeadHome() {
  const { t } = useTranslation();
  const [plantAttendance, setPlantAttendance] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [coverageWarnings, setCoverageWarnings] = useState(0);
  const [mrmPending, setMrmPending] = useState(0);
  const [flaggedProduction, setFlaggedProduction] = useState(0);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data: allEmps } = await supabase.from("employees").select("id").eq("is_active", true);
    const { data: att } = await supabase.from("attendance_records").select("*").eq("date", today);
    const present = att?.filter((a: any) => a.status === "P").length || 0;
    setPlantAttendance(allEmps?.length ? Math.round((present / allEmps.length) * 100) : 0);

    const { count: leaveCount } = await supabase.from("leave_requests").select("*", { count: "exact" }).eq("status", "pending");
    const { count: advCount } = await supabase.from("salary_advances").select("*", { count: "exact" }).eq("status", "pending");
    setPendingApprovals((leaveCount || 0) + (advCount || 0));

    const { data: mrm } = await supabase.from("mrm_reviews").select("*").eq("status", "pending");
    setMrmPending(mrm?.length || 0);
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("plantHead.plantAttendance")}</Text>
        <Card>
          <Text className="text-4xl font-bold text-primary text-center">{plantAttendance}%</Text>
          <ProgressBar progress={plantAttendance} className="mt-4" />
        </Card>
        <View className="flex-row justify-between mt-4">
          <Card className="flex-1 m-1 p-3 items-center">
            <Text className="text-2xl font-bold text-warning">{pendingApprovals}</Text>
            <Text className="text-xs text-gray-500 text-center">{t("plantHead.pendingSignOff")}</Text>
          </Card>
          <Card className="flex-1 m-1 p-3 items-center">
            <Text className="text-2xl font-bold text-danger">{coverageWarnings}</Text>
            <Text className="text-xs text-gray-500 text-center">{t("plantHead.coverageWarning")}</Text>
          </Card>
        </View>
        <Card title={t("plantHead.mrmStatus")}>
          <Text className="text-gray-600">{mrmPending} departments pending</Text>
          <Button title="View MRM" onPress={() => router.push("/(plant-head)/mrm")} variant="outline" size="sm" className="mt-2" />
        </Card>
        <Card title={t("plantHead.productionFlagged")} className="border-danger">
          <Text className="text-danger font-bold">{flaggedProduction} entries flagged</Text>
          <Text className="text-gray-500 text-sm">{t("plantHead.varianceWarning")}</Text>
        </Card>
        <Button title={t("plantHead.plantScore")} onPress={() => router.push("/(plant-head)/scores")} variant="outline" className="mt-4" />
      </ScrollView>
    </SafeView>
  );
}