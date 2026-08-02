import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

export default function OwnerHome() {
  const { t } = useTranslation();
  const [kpi, setKpi] = useState({ attendance: 0, production: 0, avgScore: 0 });
  const [pending, setPending] = useState(0);
  const [costs, setCosts] = useState({ payroll: 0, advances: 0, incentives: 0 });
  const [fraudAlerts, setFraudAlerts] = useState(0);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data: emps } = await supabase.from("employees").select("id").eq("is_active", true);
    const { data: att } = await supabase.from("attendance_records").select("*").eq("date", today);
    const present = att?.filter((a: any) => a.status === "P").length || 0;
    setKpi((p) => ({ ...p, attendance: emps?.length ? Math.round((present / emps.length) * 100) : 0 }));

    const { count } = await supabase.from("leave_requests").select("*", { count: "exact" }).eq("status", "pending");
    setPending(count || 0);

    const { data: payroll } = await supabase.from("payroll_records").select("net_pay").eq("month", new Date().toLocaleString("en", { month: "long" }));
    const totalPayroll = payroll?.reduce((s: number, r: any) => s + r.net_pay, 0) || 0;
    setCosts((c) => ({ ...c, payroll: totalPayroll }));

    const { data: frauds } = await supabase.from("fraud_alerts").select("*").eq("status", "open");
    setFraudAlerts(frauds?.length || 0);
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">Owner Dashboard</Text>
        <View className="flex-row justify-between">
          <Card className="flex-1 m-1 p-3 items-center"><Text className="text-2xl font-bold text-primary">{kpi.attendance}%</Text><Text className="text-xs text-gray-500">{t("owner.attendanceKpi")}</Text></Card>
          <Card className="flex-1 m-1 p-3 items-center"><Text className="text-2xl font-bold text-primary">{kpi.production}%</Text><Text className="text-xs text-gray-500">{t("owner.productionKpi")}</Text></Card>
          <Card className="flex-1 m-1 p-3 items-center"><Text className="text-2xl font-bold text-primary">{kpi.avgScore}</Text><Text className="text-xs text-gray-500">{t("owner.scoreKpi")}</Text></Card>
        </View>
        <Card title={t("owner.pendingApprovals")}>
          <Text className="text-gray-600">{pending} items pending final sign-off</Text>
          <Button title="Review" onPress={() => router.push("/(owner)/approvals")} variant="outline" size="sm" className="mt-2" />
        </Card>
        <Card title={t("owner.costSummary")}>
          <Text className="text-gray-600">{t("owner.payrollCost")}: {formatCurrency(costs.payroll)}</Text>
          <Text className="text-gray-600">{t("owner.advancesCost")}: {formatCurrency(costs.advances)}</Text>
          <Text className="text-gray-600">{t("owner.incentivesCost")}: {formatCurrency(costs.incentives)}</Text>
        </Card>
        <Card title={t("owner.fraudAlerts")} className={fraudAlerts > 0 ? "border-danger" : ""}>
          <Text className={`font-bold ${fraudAlerts > 0 ? "text-danger" : "text-success"}`}>{fraudAlerts} open alerts</Text>
          <Button title="View Alerts" onPress={() => router.push("/(owner)/alerts")} variant="outline" size="sm" className="mt-2" />
        </Card>
        <Button title={t("owner.eotm")} onPress={() => router.push("/(owner)/eotm")} variant="outline" className="mt-4" />
      </ScrollView>
    </SafeView>
  );
}