import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { supabase } from "@/lib/supabase";

export default function DepartmentsScreen() {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data: depts } = await supabase.from("departments").select("*");
    if (!depts) return;
    const result = await Promise.all(depts.map(async (dept: any) => {
      const { data: emps } = await supabase.from("employees").select("id").eq("department_id", dept.id).eq("is_active", true);
      const { data: att } = await supabase.from("attendance_records").select("*").in("employee_id", emps?.map((e: any) => e.id) || []).eq("date", today);
      const present = att?.filter((a: any) => a.status === "P").length || 0;
      const total = emps?.length || 1;
      return { ...dept, attendancePct: Math.round((present / total) * 100), headcount: total };
    }));
    setDepartments(result);
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("plantHead.allDepartments")}</Text>
        {departments.map((dept) => (
          <Card key={dept.id} className="mb-2">
            <View className="flex-row justify-between items-center">
              <View><Text className="font-bold text-gray-800">{dept.name}</Text><Text className="text-gray-500 text-sm">Headcount: {dept.headcount}</Text></View>
              <Text className={`text-xl font-bold ${dept.attendancePct >= 70 ? "text-success" : "text-danger"}`}>{dept.attendancePct}%</Text>
            </View>
            <ProgressBar progress={dept.attendancePct} className="mt-2" />
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}