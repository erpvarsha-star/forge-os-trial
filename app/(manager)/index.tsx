import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/ProgressBar";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export default function ManagerHome() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [deptAttendance, setDeptAttendance] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [pendingAdvances, setPendingAdvances] = useState(0);
  const [mrmDue, setMrmDue] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    if (!employee) return;
    const today = new Date().toISOString().split("T")[0];
    const { data: deptEmps } = await supabase.from("employees").select("id").eq("department_id", employee.department_id).eq("is_active", true);
    if (deptEmps) {
      const { data: att } = await supabase.from("attendance_records").select("*").in("employee_id", deptEmps.map((e: any) => e.id)).eq("date", today);
      const present = att?.filter((a: any) => a.status === "P").length || 0;
      setDeptAttendance(deptEmps.length > 0 ? Math.round((present / deptEmps.length) * 100) : 0);
    }
    const { count: leaveCount } = await supabase.from("leave_requests").select("*", { count: "exact" }).eq("status", "pending");
    const { count: advanceCount } = await supabase.from("salary_advances").select("*", { count: "exact" }).eq("status", "pending");
    setPendingLeaves(leaveCount || 0);
    setPendingAdvances(advanceCount || 0);
    setMrmDue(new Date().getDate() <= 10);
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">Manager Dashboard</Text>
        <Card title={t("manager.attendancePercent")}>
          <Text className="text-3xl font-bold text-primary mb-2">{deptAttendance}%</Text>
          <ProgressBar progress={deptAttendance} />
        </Card>
        <Card title="Pending Approvals">
          <Text className="text-gray-600">Leaves: {pendingLeaves}</Text>
          <Text className="text-gray-600">Advances: {pendingAdvances}</Text>
          <Button title="View All" onPress={() => router.push("/(manager)/approvals")} variant="outline" size="sm" className="mt-2" />
        </Card>
        {mrmDue && (
          <Card className="bg-red-50 border-red-100">
            <Text className="text-danger font-bold">{t("manager.mrmReview")}</Text>
            <Text className="text-gray-600 text-sm">{t("manager.mrmDeadline")}</Text>
            <Button title="Submit MRM" onPress={() => router.push("/(manager)/mrm")} size="sm" className="mt-2" />
          </Card>
        )}
        <Button title={t("manager.deptLeaderboard")} onPress={() => router.push("/(manager)/leaderboard")} variant="outline" className="mt-2" />
      </ScrollView>
    </SafeView>
  );
}