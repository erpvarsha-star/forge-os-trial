import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Employee, LeaveRequest, DataCollectionSubmission } from "@/types";
import { formatDate } from "@/lib/utils";
import { router } from "expo-router";

export default function SupervisorHome() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [team, setTeam] = useState<Employee[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [shiftReport, setShiftReport] = useState<DataCollectionSubmission | null>(null);
  const [teamStats, setTeamStats] = useState({ present: 0, absent: 0, late: 0 });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    if (!employee) return;
    const today = new Date().toISOString().split("T")[0];

    const [teamRes, leavesRes, attendanceRes] = await Promise.all([
      supabase.from("employees").select("*").eq("supervisor_id", employee.id).eq("is_active", true),
      supabase.from("leave_requests").select("*, employees(name)").eq("status", "pending")
        .in("employee_id", (await supabase.from("employees").select("id").eq("supervisor_id", employee.id)).data?.map(e => e.id) || []),
      supabase.from("attendance_records").select("*").in("employee_id", (await supabase.from("employees").select("id").eq("supervisor_id", employee.id)).data?.map(e => e.id) || []).eq("date", today),
    ]);

    if (teamRes.data) setTeam(teamRes.data as Employee[]);
    if (leavesRes.data) setPendingLeaves(leavesRes.data as LeaveRequest[]);
    if (attendanceRes.data) {
      const att = attendanceRes.data as any[];
      setTeamStats({
        present: att.filter(a => a.status === "P").length,
        absent: att.filter(a => a.status === "A").length,
        late: att.filter(a => a.is_late).length,
      });
    }
  };

  const handleShiftReport = () => { router.push("/(supervisor)/shift-report"); };
  const handleCasualWorker = () => { router.push("/(supervisor)/casual-worker"); };
  const handleProductionConfirm = () => { router.push("/(supervisor)/production"); };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("supervisor.teamStatus")}</Text>

        <View className="flex-row justify-between mb-4">
          <Card className="flex-1 m-1 p-3 items-center"><Text className="text-success text-2xl font-bold">{teamStats.present}</Text><Text className="text-xs text-gray-500">{t("supervisor.present")}</Text></Card>
          <Card className="flex-1 m-1 p-3 items-center"><Text className="text-danger text-2xl font-bold">{teamStats.absent}</Text><Text className="text-xs text-gray-500">{t("supervisor.absent")}</Text></Card>
          <Card className="flex-1 m-1 p-3 items-center"><Text className="text-warning text-2xl font-bold">{teamStats.late}</Text><Text className="text-xs text-gray-500">{t("supervisor.late")}</Text></Card>
        </View>

        <Card title={t("supervisor.pendingApprovals")}>
          <Text className="text-gray-600 mb-2">{pendingLeaves.length} pending leave requests</Text>
          <Button title="View All" onPress={() => router.push("/(supervisor)/approvals")} variant="outline" size="sm" />
        </Card>

        <Button title={t("supervisor.shiftReport")} onPress={handleShiftReport} className="mt-4" />
        <Button title={t("supervisor.addCasualWorker")} onPress={handleCasualWorker} variant="outline" className="mt-2" />
        <Button title={t("supervisor.productionConfirm")} onPress={handleProductionConfirm} variant="outline" className="mt-2" />

        {/* 5S Verification shortcut */}
        <Button title="5S Verifications" onPress={() => router.push("/(supervisor)/fiveS-verify")} variant="outline" className="mt-2" />
      </ScrollView>
    </SafeView>
  );
}