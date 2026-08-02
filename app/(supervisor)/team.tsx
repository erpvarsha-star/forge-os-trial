import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { notifyEmployeesByRole } from "@/lib/notifications";
import { Employee } from "@/types";

// Workflow 11 (Fraud Detection): more than 10 confirmations in 90 seconds by
// the same supervisor is treated as bulk/buddy confirmation and flagged.
const FRAUD_CONFIRMATION_THRESHOLD = 10;
const FRAUD_WINDOW_MS = 90 * 1000;

export default function TeamScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [team, setTeam] = useState<Employee[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // In-memory sliding window of this supervisor's confirmation timestamps —
  // resets on remount, which matches "confirmations in this session".
  const confirmationTimestamps = useRef<number[]>([]);
  const fraudFlaggedThisBurst = useRef(false);

  useEffect(() => { fetchTeam(); }, []);

  const fetchTeam = async () => {
    if (!employee) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("employees").select("*").eq("supervisor_id", employee.id).eq("is_active", true);
    if (data) {
      setTeam(data as Employee[]);
      const ids = data.map((e: any) => e.id);
      const { data: att } = await supabase.from("attendance_records").select("*").in("employee_id", ids).eq("date", today);
      const map: Record<string, string> = {};
      att?.forEach((a: any) => { map[a.employee_id] = a.status; });
      setStatusMap(map);
    }
  };

  const checkBulkConfirmationFraud = useCallback(async () => {
    const now = Date.now();
    const recent = confirmationTimestamps.current.filter((ts) => now - ts <= FRAUD_WINDOW_MS);
    confirmationTimestamps.current = recent;

    if (recent.length <= FRAUD_CONFIRMATION_THRESHOLD) {
      fraudFlaggedThisBurst.current = false;
      return;
    }
    if (fraudFlaggedThisBurst.current || !employee) return;
    fraudFlaggedThisBurst.current = true;

    const seconds = Math.round((now - recent[0]) / 1000);
    await supabase.from("fraud_alerts").insert({
      type: "bulk_confirm",
      employee_id: employee.id,
      description: `${employee.name} confirmed ${recent.length} team members in ${seconds} seconds`,
      severity: "high",
      status: "open",
    });

    await notifyEmployeesByRole(
      "plant_head",
      t("notifications.bulkConfirmTitle"),
      t("notifications.bulkConfirmBody", { name: employee.name, count: recent.length, seconds })
    );
  }, [employee, t]);

  const confirmAttendance = async (member: Employee, status: "P" | "A") => {
    if (!employee) return;
    setConfirmingId(member.id);
    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase.from("attendance_records").upsert(
      { employee_id: member.id, date: today, status },
      { onConflict: "employee_id,date" }
    );

    setConfirmingId(null);
    if (error) { Alert.alert(t("app.error"), t("errors.generic")); return; }

    setStatusMap((prev) => ({ ...prev, [member.id]: status }));
    confirmationTimestamps.current.push(Date.now());
    checkBulkConfirmationFraud();
  };

  const getStatusColor = (status?: string) => {
    switch (status) { case "P": return "bg-success"; case "A": return "bg-danger"; case "L": return "bg-info"; default: return "bg-gray-300"; }
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-1">{t("supervisor.teamList")}</Text>
        <Text className="text-gray-500 mb-4">{t("supervisor.confirmAttendance")}</Text>
        {team.map((member) => (
          <Card key={member.id}>
            <View className="flex-row items-center">
              <View className={`w-3 h-3 rounded-full mr-3 ${getStatusColor(statusMap[member.id])}`} />
              <View className="flex-1">
                <Text className="font-bold text-gray-800">{member.name}</Text>
                <Text className="text-gray-500 text-sm">{member.emp_code} • {member.department}</Text>
              </View>
              <Text className="text-gray-400 text-xs capitalize">{member.role}</Text>
            </View>
            <View className="flex-row mt-3">
              <TouchableOpacity
                onPress={() => confirmAttendance(member, "P")}
                disabled={confirmingId === member.id}
                className={`flex-1 mr-2 rounded-lg py-2 items-center ${statusMap[member.id] === "P" ? "bg-success" : "bg-success/10"}`}
              >
                <Text className={`font-semibold ${statusMap[member.id] === "P" ? "text-white" : "text-success"}`}>{t("supervisor.markPresent")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmAttendance(member, "A")}
                disabled={confirmingId === member.id}
                className={`flex-1 rounded-lg py-2 items-center ${statusMap[member.id] === "A" ? "bg-danger" : "bg-danger/10"}`}
              >
                <Text className={`font-semibold ${statusMap[member.id] === "A" ? "text-white" : "text-danger"}`}>{t("supervisor.markAbsent")}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}
