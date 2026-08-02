import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export default function CasualWorkerScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [unskilledCount, setUnskilledCount] = useState("0");
  const [skilledCount, setSkilledCount] = useState("0");
  const [operatorCount, setOperatorCount] = useState("0");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const fetchToday = useCallback(async () => {
    if (!employee) return;
    setLoading(true);
    const { data } = await supabase
      .from("casual_workers")
      .select("*")
      .eq("supervisor_id", employee.id)
      .eq("date", today)
      .maybeSingle();
    if (data) {
      setUnskilledCount(String(data.unskilled_count ?? 0));
      setSkilledCount(String(data.skilled_count ?? 0));
      setOperatorCount(String(data.operator_count ?? 0));
    }
    setLoading(false);
  }, [employee, today]);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  const save = async () => {
    if (!employee) return;
    setSubmitting(true);
    const { error } = await supabase.from("casual_workers").upsert(
      {
        supervisor_id: employee.id,
        date: today,
        unskilled_count: Number(unskilledCount) || 0,
        skilled_count: Number(skilledCount) || 0,
        operator_count: Number(operatorCount) || 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "supervisor_id,date" }
    );
    setSubmitting(false);
    if (!error) { Alert.alert(t("app.success"), t("supervisor.casualWorkerSaved")); router.back(); }
    else Alert.alert(t("app.error"), t("errors.generic"));
  };

  if (loading) return <SafeView><Header /><View className="flex-1 items-center justify-center"><Text className="text-gray-500">{t("app.loading")}</Text></View></SafeView>;

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("supervisor.addCasualWorker")}</Text>
        <Card>
          <Input
            label={t("supervisor.unskilledCount")}
            value={unskilledCount}
            onChangeText={(v) => setUnskilledCount(v.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
          />
          <Input
            label={t("supervisor.skilledCount")}
            value={skilledCount}
            onChangeText={(v) => setSkilledCount(v.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
          />
          <Input
            label={t("supervisor.operatorCount")}
            value={operatorCount}
            onChangeText={(v) => setOperatorCount(v.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
          />
        </Card>
        <Button title={t("app.save")} onPress={save} loading={submitting} className="mt-4" />
      </ScrollView>
    </SafeView>
  );
}
