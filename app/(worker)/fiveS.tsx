import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { FiveSChallenge } from "@/types";
import { Camera, RotateCcw } from "lucide-react-native";

export default function FiveSScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [challenge, setChallenge] = useState<FiveSChallenge | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraRef, setCameraRef] = useState<any>(null);
  const [facing, setFacing] = useState<"back" | "front">("back");

  useEffect(() => { fetchChallenge(); }, []);

  const fetchChallenge = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("5s_challenges").select("*").eq("date", today).single();
    if (data) setChallenge(data as FiveSChallenge);
  };

  const takePhoto = async () => {
    if (!cameraRef) return;
    const photo = await cameraRef.takePictureAsync({ quality: 0.7, base64: true });
    setPhoto(photo.uri);
  };

  const submit = async () => {
    if (!photo || !challenge || !employee) return;
    const fileName = `${employee.id}_${challenge.id}_${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage.from("5s-photos").upload(fileName, {
      uri: photo, type: "image/jpeg", name: fileName,
    } as any);

    if (uploadError) { Alert.alert("Error", "Upload failed"); return; }

    const { data: urlData } = supabase.storage.from("5s-photos").getPublicUrl(fileName);
    const { error } = await supabase.from("5s_submissions").insert({
      challenge_id: challenge.id, employee_id: employee.id,
      photo_url: urlData.publicUrl, status: "pending", points: 0,
      submitted_at: new Date().toISOString(),
    });

    if (!error) { Alert.alert("Success", "5S submission sent for verification"); setPhoto(null); }
  };

  if (!permission?.granted) {
    return (
      <SafeView className="justify-center items-center">
        <Text className="mb-4">Camera permission required</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </SafeView>
    );
  }

  return (
    <SafeView>
      <Header />
      <View className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("fiveS.title")}</Text>

        {challenge && (
          <View className="bg-green-50 rounded-xl p-4 mb-4 border border-green-100">
            <Text className="text-gray-800 font-bold text-lg mb-1">{challenge.challenge_text_hi}</Text>
            <Text className="text-gray-500">{challenge.challenge_text_en}</Text>
            <Text className="text-gray-400 text-xs mt-2">{t("fiveS.area")}: {challenge.area}</Text>
          </View>
        )}

        {photo ? (
          <View className="flex-1">
            <Image source={{ uri: photo }} className="flex-1 rounded-xl mb-4" resizeMode="cover" />
            <View className="flex-row">
              <Button title={t("fiveS.retake")} onPress={() => setPhoto(null)} variant="outline" className="flex-1 mr-2" />
              <Button title={t("fiveS.submit")} onPress={submit} className="flex-1" />
            </View>
          </View>
        ) : (
          <View className="flex-1">
            <CameraView ref={(ref) => setCameraRef(ref)} style={{ flex: 1, borderRadius: 12 }} facing={facing}>
              <View className="flex-1 justify-end items-center pb-8">
                <TouchableOpacity onPress={takePhoto} className="w-16 h-16 bg-white rounded-full items-center justify-center border-4 border-primary">
                  <Camera size={28} color="#E65C00" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFacing(f => f === "back" ? "front" : "back")} className="absolute right-4 bottom-8">
                  <RotateCcw size={24} color="white" />
                </TouchableOpacity>
              </View>
            </CameraView>
          </View>
        )}
      </View>
    </SafeView>
  );
}