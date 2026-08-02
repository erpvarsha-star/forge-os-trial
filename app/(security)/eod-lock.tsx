import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { EODConfirmation } from "@/types";

export default function EODLockScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [inwardCount, setInwardCount] = useState(0);
  const [outwardCount, setOutwardCount] = useState(0);
  const [existing, setExisting] = useState<EODConfirmation | null>(null);
  const [mismatchReason, setMismatchReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const mismatch = inwardCount !== outwardCount;

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    const [vehicleRes, eodRes] = await Promise.all([
      supabase.from("vehicle_log").select("direction").gte("created_at", `${today}T00:00:00`),
      supabase.from("eod_confirmations").select("*").eq("date", today).maybeSingle(),
    ]);
    const entries = (vehicleRes.data ?? []) as { direction: "inward" | "outward" }[];
    setInwardCount(entries.filter((e) => e.direction === "inward").length);
    setOutwardCount(entries.filter((e) => e.direction === "outward").length);
    if (eodRes.data) setExisting(eodRes.data as EODConfirmation);
    setLoading(false);
  }, [today]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const confirmEod = async () => {
    if (!employee) return;
    if (mismatch && !mismatchReason.trim()) {
      Alert.alert(t("app.error"), t("security.mismatchReasonRequired"));
      return;
    }
    setConfirming(true);
    const { error } = await supabase.from("eod_confirmations").upsert({
      security_guard_id: employee.id,
      date: today,
      inward_count: inwardCount,
      outward_count: outwardCount,
      mismatch_reason: mismatch ? mismatchReason.trim() : null,
      confirmed_at: new Date().toISOString(),
    }, { onConflict: "security_guard_id,date" });
    setConfirming(false);
    if (!error) { Alert.alert(t("app.success"), t("security.eodConfirmed")); fetchStatus(); }
    else Alert.alert(t("app.error"), t("errors.generic"));
  };

  if (loading) return <SafeView><Header /><View className="flex-1 items-center justify-center"><Text className="text-gray-500">{t("app.loading")}</Text></View></SafeView>;

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("security.eodConfirmation")}</Text>

        <View className="flex-row justify-between mb-4">
          <Card className="flex-1 m-1 p-3 items-center">
            <Text className="text-success text-2xl font-bold">{inwardCount}</Text>
            <Text className="text-xs text-gray-500">{t("security.inward")}</Text>
          </Card>
          <Card className="flex-1 m-1 p-3 items-center">
            <Text className="text-info text-2xl font-bold">{outwardCount}</Text>
            <Text className="text-xs text-gray-500">{t("security.outward")}</Text>
          </Card>
        </View>

        {mismatch ? (
          <Card className="border-danger mb-2">
            <Badge text={t("security.countMismatch")} variant="danger" className="mb-2" />
            <Input
              label={t("app.reason")}
              value={mismatchReason}
              onChangeText={setMismatchReason}
              placeholder={t("security.mismatchReasonPlaceholder")}
              multiline
              numberOfLines={3}
            />
          </Card>
        ) : (
          <Card className="border-success mb-2">
            <Badge text={t("security.countsMatch")} variant="success" />
          </Card>
        )}

        {existing ? (
          <Card>
            <Text className="text-gray-600">
              {t("security.alreadyConfirmedAt")} {new Date(existing.confirmed_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </Text>
            {existing.mismatch_reason ? <Text className="text-gray-500 text-sm mt-1">{t("app.reason")}: {existing.mismatch_reason}</Text> : null}
          </Card>
        ) : null}

        <Button
          title={existing ? t("security.reconfirmEod") : t("security.confirmEod")}
          onPress={confirmEod}
          loading={confirming}
          variant={mismatch ? "danger" : "primary"}
          className="mt-4"
        />
      </ScrollView>
    </SafeView>
  );
}
