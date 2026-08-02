import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export default function ManagerAttendanceScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [supervisors, setSupervisors] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    if (!employee) return;
    const today = new Date().toISOString().split("T")[0];
    const { data: sups } = await supabase.from("employees").select("*").eq("department_id", employee.department_id).eq("role", "supervisor");
    if (!sups) return;
    const result = await Promise.all(sups.map(async (sup: any) => {
      const { data: team } = await supabase.from("employees").select("id").eq("supervisor_id", sup.id).eq("is_active", true);
      const { data: att } = await supabase.from("attendance_records").select("*").in("employee_id", team?.map((e: any) => e.id) || []).eq("date", today);
      const present = att?.filter((a: any) => a.status === "P").length || 0;
      const total = team?.length || 1;
      return { ...sup, attendancePct: Math.round((present / total) * 100), teamSize: total };
    }));
    setSupervisors(result);
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("manager.supervisorRollup")}</Text>
        {supervisors.map((sup) => (
          <Card key={sup.id} className="mb-2">
            <View className="flex-row justify-between items-center">
              <View><Text className="font-bold text-gray-800">{sup.name}</Text><Text className="text-gray-500 text-sm">Team: {sup.teamSize}</Text></View>
              <Text className={`text-xl font-bold ${sup.attendancePct >= 70 ? "text-success" : "text-danger"}`}>{sup.attendancePct}%</Text>
            </View>
            <ProgressBar progress={sup.attendancePct} className="mt-2" />
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}