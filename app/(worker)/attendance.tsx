import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { AttendanceRecord } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  P: "bg-success", A: "bg-danger", L: "bg-info", H: "bg-warning", W: "bg-gray-400", HD: "bg-warning/50",
};

const STATUS_LABELS: Record<string, string> = {
  P: "present", A: "absent", L: "leave", H: "holiday", W: "weekoff", HD: "halfDay",
};

export default function AttendanceScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    fetchAttendance();
  }, [currentMonth]);

  const fetchAttendance = async () => {
    if (!employee) return;
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, "0");
    const { data } = await supabase.from("attendance_records").select("*")
      .eq("employee_id", employee.id)
      .gte("date", `${year}-${month}-01`)
      .lte("date", `${year}-${month}-31`);
    if (data) setRecords(data as AttendanceRecord[]);
  };

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const getRecordForDay = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return records.find((r) => r.date === dateStr);
  };

  const summary = {
    present: records.filter((r) => r.status === "P").length,
    absent: records.filter((r) => r.status === "A").length,
    leave: records.filter((r) => r.status === "L").length,
    late: records.filter((r) => r.is_late).length,
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("attendance.title")}</Text>

        {/* Summary */}
        <View className="flex-row justify-between mb-4">
          <Card className="flex-1 m-1 p-3"><Text className="text-success font-bold text-xl text-center">{summary.present}</Text><Text className="text-xs text-center text-gray-500">{t("attendance.present")}</Text></Card>
          <Card className="flex-1 m-1 p-3"><Text className="text-danger font-bold text-xl text-center">{summary.absent}</Text><Text className="text-xs text-center text-gray-500">{t("attendance.absent")}</Text></Card>
          <Card className="flex-1 m-1 p-3"><Text className="text-info font-bold text-xl text-center">{summary.leave}</Text><Text className="text-xs text-center text-gray-500">{t("attendance.leave")}</Text></Card>
          <Card className="flex-1 m-1 p-3"><Text className="text-warning font-bold text-xl text-center">{summary.late}</Text><Text className="text-xs text-center text-gray-500">{t("attendance.late")}</Text></Card>
        </View>

        {/* Calendar Grid */}
        <Card>
          <Text className="text-lg font-bold text-center mb-4">
            {currentMonth.toLocaleString("en", { month: "long", year: "numeric" })}
          </Text>
          <View className="flex-row flex-wrap">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <View key={i} className="w-[14.28%] items-center py-2"><Text className="text-gray-400 font-medium">{d}</Text></View>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => (
              <View key={`empty-${i}`} className="w-[14.28%] aspect-square p-1" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const record = getRecordForDay(day);
              return (
                <View key={day} className="w-[14.28%] aspect-square p-1">
                  <View className={`flex-1 rounded-lg items-center justify-center ${record ? STATUS_COLORS[record.status] : "bg-gray-100"}`}>
                    <Text className={`text-sm font-medium ${record ? "text-white" : "text-gray-700"}`}>{day}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Legend */}
        <View className="flex-row flex-wrap mt-4">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <View key={status} className="flex-row items-center mr-4 mb-2">
              <View className={`w-3 h-3 rounded-full ${color} mr-1`} />
              <Text className="text-xs text-gray-600">{t(`attendance.${STATUS_LABELS[status]}`)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeView>
  );
}