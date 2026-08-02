import { useState, useEffect } from "react";
import { View, Text, ScrollView, Image, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { FiveSSubmission } from "@/types";

export default function FiveSVerifyScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [submissions, setSubmissions] = useState<FiveSSubmission[]>([]);

  useEffect(() => { fetchSubmissions(); }, []);

  const fetchSubmissions = async () => {
    const { data } = await supabase.from("5s_submissions").select("*, employees(name), 5s_challenges(area)").eq("status", "pending");
    if (data) setSubmissions(data as FiveSSubmission[]);
  };

  const verify = async (id: string, approved: boolean) => {
    const { error } = await supabase.from("5s_submissions").update({
      status: approved ? "approved" : "rejected", verified_by: employee!.id,
      verified_at: new Date().toISOString(), points: approved ? 10 : 0,
    }).eq("id", id);
    if (!error) { Alert.alert("Success", approved ? "Approved - Points credited" : "Rejected"); fetchSubmissions(); }
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">5S Verifications</Text>
        {submissions.map((sub: any) => (
          <Card key={sub.id} className="mb-2">
            <Image source={{ uri: sub.photo_url }} className="w-full h-48 rounded-lg mb-3" resizeMode="cover" />
            <Text className="font-bold text-gray-800">{sub.employees?.name}</Text>
            <Text className="text-gray-500 text-sm">{sub["5s_challenges"]?.area}</Text>
            <View className="flex-row mt-3">
              <Button title="Approve" onPress={() => verify(sub.id, true)} className="flex-1 mr-2" size="sm" />
              <Button title="Reject" onPress={() => verify(sub.id, false)} variant="danger" className="flex-1" size="sm" />
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}