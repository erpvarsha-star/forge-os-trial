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
import { VehicleLogEntry } from "@/types";
import { formatTime } from "@/lib/utils";

export default function VehicleLogScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [entries, setEntries] = useState<VehicleLogEntry[]>([]);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [material, setMaterial] = useState("");
  const [direction, setDirection] = useState<"inward" | "outward">("inward");
  const [submitting, setSubmitting] = useState(false);

  const fetchToday = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("vehicle_log")
      .select("*")
      .gte("created_at", `${today}T00:00:00`)
      .order("created_at", { ascending: false });
    if (data) setEntries(data as VehicleLogEntry[]);
  }, []);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  const resetForm = () => {
    setVehicleNumber(""); setDriverName(""); setVendorName(""); setMaterial(""); setDirection("inward");
  };

  const logVehicle = async () => {
    if (!employee || !vehicleNumber.trim()) { Alert.alert(t("app.error"), t("security.vehicleNumberRequired")); return; }
    setSubmitting(true);
    const { error } = await supabase.from("vehicle_log").insert({
      vehicle_number: vehicleNumber.trim().toUpperCase(),
      driver_name: driverName || null,
      vendor_name: vendorName || null,
      material: material || null,
      direction,
      logged_by: employee.id,
      time_in: direction === "inward" ? new Date().toISOString() : null,
      time_out: direction === "outward" ? new Date().toISOString() : null,
    });
    setSubmitting(false);
    if (!error) { resetForm(); fetchToday(); }
    else Alert.alert(t("app.error"), t("errors.generic"));
  };

  const inwardCount = entries.filter((e) => e.direction === "inward").length;
  const outwardCount = entries.filter((e) => e.direction === "outward").length;

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("security.vehicleLog")}</Text>

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

        <Card title={t("security.logVehicle")}>
          <Input label={t("security.vehicleNumber")} value={vehicleNumber} onChangeText={setVehicleNumber} />
          <Input label={t("security.driverName")} value={driverName} onChangeText={setDriverName} />
          <Input label={t("security.vendorName")} value={vendorName} onChangeText={setVendorName} />
          <Input label={t("security.material")} value={material} onChangeText={setMaterial} />

          <Text className="text-sm font-medium text-gray-700 mb-2">{t("security.direction")}</Text>
          <View className="flex-row mb-4">
            <Button
              title={t("security.inward")}
              onPress={() => setDirection("inward")}
              variant={direction === "inward" ? "primary" : "outline"}
              size="sm"
              className="flex-1 mr-2"
            />
            <Button
              title={t("security.outward")}
              onPress={() => setDirection("outward")}
              variant={direction === "outward" ? "primary" : "outline"}
              size="sm"
              className="flex-1"
            />
          </View>

          <Button title={t("app.add")} onPress={logVehicle} loading={submitting} />
        </Card>

        <Text className="text-lg font-bold text-gray-800 mt-2 mb-2">{t("security.todaysEntries")}</Text>
        {entries.length === 0 ? (
          <Card><Text className="text-center text-gray-500">{t("app.noData")}</Text></Card>
        ) : (
          entries.map((entry) => (
            <Card key={entry.id} className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="font-bold text-gray-800">{entry.vehicle_number}</Text>
                <Text className="text-gray-500 text-sm">{entry.vendor_name || entry.driver_name || "-"} {entry.material ? `• ${entry.material}` : ""}</Text>
                <Text className="text-gray-400 text-xs">{formatTime(entry.created_at)}</Text>
              </View>
              <Badge text={t(`security.${entry.direction}`)} variant={entry.direction === "inward" ? "success" : "info"} />
            </Card>
          ))
        )}
      </ScrollView>
    </SafeView>
  );
}
