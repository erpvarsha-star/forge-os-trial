import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatTime } from "@/lib/utils";

interface CheckedInRow {
  id: string;
  employee_id: string;
  check_in_time: string;
  checkpoint2_confirmed_by: string | null;
  checkpoint2_at: string | null;
  employees: { name: string; emp_code: string; department: string } | null;
}

export default function SecurityCheckpoint2Screen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [rows, setRows] = useState<CheckedInRow[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const fetchCheckedIn = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("attendance_records")
      .select("id, employee_id, check_in_time, checkpoint2_confirmed_by, checkpoint2_at, employees(name, emp_code, department)")
      .eq("date", today)
      .not("check_in_time", "is", null)
      .order("check_in_time", { ascending: true });
    if (data) setRows(data as unknown as CheckedInRow[]);
  }, []);

  useEffect(() => { fetchCheckedIn(); }, [fetchCheckedIn]);

  const confirmSeen = async (row: CheckedInRow) => {
    if (!employee) return;
    setConfirmingId(row.id);
    const { error } = await supabase
      .from("attendance_records")
      .update({ checkpoint2_confirmed_by: employee.id, checkpoint2_at: new Date().toISOString() })
      .eq("id", row.id);
    setConfirmingId(null);
    if (!error) fetchCheckedIn();
    else Alert.alert(t("app.error"), t("errors.generic"));
  };

  const pending = rows.filter((r) => !r.checkpoint2_confirmed_by);
  const confirmed = rows.filter((r) => r.checkpoint2_confirmed_by);

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-1">{t("security.checkpoint2")}</Text>
        <Text className="text-gray-500 mb-4">{t("security.checkpoint2Hint")}</Text>

        <Text className="text-sm font-semibold text-gray-600 mb-2">{t("security.pendingConfirmation")} ({pending.length})</Text>
        {pending.length === 0 ? (
          <Card><Text className="text-center text-gray-500">{t("security.allConfirmed")}</Text></Card>
        ) : (
          pending.map((row) => (
            <Card key={row.id} className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="font-bold text-gray-800">{row.employees?.name}</Text>
                <Text className="text-gray-500 text-sm">{row.employees?.emp_code} • {row.employees?.department}</Text>
                <Text className="text-gray-400 text-xs">{t("security.checkedInAt")} {formatTime(row.check_in_time)}</Text>
              </View>
              <Button
                title={t("security.confirmSeen")}
                onPress={() => confirmSeen(row)}
                loading={confirmingId === row.id}
                size="sm"
              />
            </Card>
          ))
        )}

        <Text className="text-sm font-semibold text-gray-600 mt-4 mb-2">{t("security.confirmed")} ({confirmed.length})</Text>
        {confirmed.map((row) => (
          <Card key={row.id} className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="font-bold text-gray-800">{row.employees?.name}</Text>
              <Text className="text-gray-500 text-sm">{row.employees?.emp_code} • {row.employees?.department}</Text>
            </View>
            <Badge text={t("security.seen")} variant="success" />
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}
