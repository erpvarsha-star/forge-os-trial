import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { supabase } from "@/lib/supabase";

export default function PlantHeadMRM() {
  const { t } = useTranslation();
  const [mrms, setMrms] = useState<any[]>([]);

  useEffect(() => { fetchMrms(); }, []);

  const fetchMrms = async () => {
    const { data } = await supabase.from("mrm_reviews").select("*, departments(name)").eq("status", "submitted");
    if (data) setMrms(data);
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("plantHead.mrmStatus")}</Text>
        {mrms.map((mrm) => (
          <Card key={mrm.id} className="mb-2">
            <Text className="font-bold text-gray-800">{mrm.departments?.name}</Text>
            <Text className="text-gray-500">{mrm.month} {mrm.year}</Text>
            <Badge text={mrm.status} variant="warning" className="mt-2" />
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}