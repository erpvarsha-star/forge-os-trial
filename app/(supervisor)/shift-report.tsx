import { useState } from "react";
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

export default function ShiftReportScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [productionData, setProductionData] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  const submitReport = async () => {
    if (!employee) return;
    const parsed: Record<string, number> = {};
    Object.entries(productionData).forEach(([k, v]) => { if (v) parsed[k] = Number(v); });
    const { error } = await supabase.from("data_collection_submissions").insert({
      supervisor_id: employee.id, date: new Date().toISOString().split("T")[0],
      shift_id: "", production_data: parsed, notes, status: "submitted",
    });
    if (!error) { Alert.alert("Success", "Shift report submitted"); router.back(); }
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("supervisor.shiftReport")}</Text>
        <Card>
          <Text className="text-gray-600 mb-2">Enter production quantities:</Text>
          {["Line 1", "Line 2", "Line 3"].map((line) => (
            <Input key={line} label={line} value={productionData[line] || ""}
              onChangeText={(v) => setProductionData({ ...productionData, [line]: v })} keyboardType="number-pad" />
          ))}
          <Input label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
        </Card>
        <Button title={t("app.submit")} onPress={submitReport} className="mt-4" />
      </ScrollView>
    </SafeView>
  );
}