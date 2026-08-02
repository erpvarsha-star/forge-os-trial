import { useState, useEffect } from "react";
import { View, Text, Alert, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { BarCodeScanner } from "expo-barcode-scanner";
import { SafeView } from "@/components/SafeView";
import { useAuthStore } from "@/hooks/useAuth";
import { isWithinGeofence } from "@/lib/location";
import { supabase } from "@/lib/supabase";
import CryptoJS from "crypto-js";

export default function QRAttendanceScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing || !employee) return;
    setScanned(true); setProcessing(true);

    const today = new Date().toISOString().split("T")[0];
    // plant_config is key-value (config_key, config_value) — read the two keys the hash needs.
    const { data: configRows } = await supabase
      .from("plant_config")
      .select("config_key, config_value")
      .in("config_key", ["plant_code", "qr_secret_salt"]);

    const configValues: Record<string, any> = {};
    configRows?.forEach((row: { config_key: string; config_value: any }) => { configValues[row.config_key] = row.config_value; });
    const plantCode = configValues.plant_code;
    const secretSalt = configValues.qr_secret_salt;
    if (!plantCode || !secretSalt) { Alert.alert("Error", "Config not found"); setProcessing(false); return; }

    const expectedHash = CryptoJS.SHA256(`${plantCode}${today}${secretSalt}`).toString();
    if (data !== expectedHash) { Alert.alert(t("app.error"), t("home.invalidQr")); setScanned(false); setProcessing(false); return; }

    const { data: existing } = await supabase.from("attendance_records").select("*")
      .eq("employee_id", employee.id).eq("date", today).single();
    if (existing) { Alert.alert(t("app.info"), t("home.alreadyCheckedIn")); setProcessing(false); return; }

    const geo = await isWithinGeofence();
    if (!geo.inside) { Alert.alert(t("app.error"), t("home.outsidePlant")); setScanned(false); setProcessing(false); return; }

    const { error } = await supabase.from("attendance_records").insert({
      employee_id: employee.id, date: today, status: "P",
      check_in_time: new Date().toISOString(),
      check_in_lat: geo.location?.coords.latitude,
      check_in_lng: geo.location?.coords.longitude, is_late: false,
    });

    if (!error) Alert.alert("Success", "Attendance marked via QR");
    else Alert.alert("Error", "Failed to mark attendance");
    setProcessing(false);
  };

  if (hasPermission === null) return <SafeView><Text className="text-center mt-10">Requesting camera permission...</Text></SafeView>;
  if (hasPermission === false) return <SafeView><Text className="text-center mt-10">No camera access</Text></SafeView>;

  return (
    <SafeView>
      <View className="flex-1">
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
        <View className="flex-1 justify-center items-center">
          <View className="w-64 h-64 border-2 border-white rounded-lg opacity-70" />
        </View>
        <View className="absolute bottom-10 left-0 right-0 items-center">
          <Text className="text-white text-lg font-medium bg-black/50 px-4 py-2 rounded-full">
            {processing ? t("qr.processing") : t("qr.pointCamera")}
          </Text>
        </View>
      </View>
    </SafeView>
  );
}