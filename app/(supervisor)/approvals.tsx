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
import { LeaveRequest } from "@/types";
import { formatDate } from "@/lib/utils";

export default function ApprovalsScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);

  useEffect(() => { fetchLeaves(); }, []);

  const fetchLeaves = async () => {
    if (!employee) return;
    const { data: teamIds } = await supabase.from("employees").select("id").eq("supervisor_id", employee.id);
    if (!teamIds) return;
    const { data } = await supabase.from("leave_requests").select("*, employees(name, emp_code)").in("employee_id", teamIds.map((e: any) => e.id)).eq("status", "pending");
    if (data) setLeaves(data as LeaveRequest[]);
  };

  const handleApprove = async (id: string) => {
    const { error } = await supabase.from("leave_requests").update({ status: "approved", approved_by: employee!.id, approved_on: new Date().toISOString() }).eq("id", id);
    if (!error) { Alert.alert("Success", "Leave approved"); fetchLeaves(); }
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.from("leave_requests").update({ status: "rejected", approved_by: employee!.id, approved_on: new Date().toISOString() }).eq("id", id);
    if (!error) { Alert.alert("Success", "Leave rejected"); fetchLeaves(); }
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("supervisor.pendingApprovals")}</Text>
        {leaves.length === 0 ? <Card><Text className="text-center text-gray-500">No pending approvals</Text></Card> : null}
        {leaves.map((req: any) => (
          <Card key={req.id} className="mb-2">
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="font-bold text-gray-800">{req.employees?.name} ({req.employees?.emp_code})</Text>
                <Text className="text-gray-600">{req.leave_type}: {formatDate(req.start_date)} - {formatDate(req.end_date)}</Text>
                <Text className="text-gray-500 text-sm mt-1">{req.reason}</Text>
                {req.coverage_warning && <Badge text={t("supervisor.coverageWarning")} variant="danger" className="mt-2" />}
              </View>
            </View>
            <View className="flex-row mt-3">
              <Button title={t("app.approve")} onPress={() => handleApprove(req.id)} className="flex-1 mr-2" size="sm" />
              <Button title={t("app.reject")} onPress={() => handleReject(req.id)} variant="danger" className="flex-1" size="sm" />
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}