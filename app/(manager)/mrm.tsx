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

export default function MRMScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [actions, setActions] = useState([{ description: "", owner: "", target: "" }]);

  const addAction = () => setActions([...actions, { description: "", owner: "", target: "" }]);
  const updateAction = (idx: number, field: string, value: string) => {
    const updated = [...actions];
    updated[idx] = { ...updated[idx], [field]: value };
    setActions(updated);
  };

  const submit = async () => {
    if (!employee) return;
    const month = new Date().toLocaleString("en", { month: "long" });
    const year = new Date().getFullYear();
    const { data: mrm, error } = await supabase.from("mrm_reviews").insert({
      department_id: employee.department_id, month, year, status: "submitted",
      submitted_by: employee.id, submitted_on: new Date().toISOString(),
    }).select().single();

    if (!error && mrm) {
      await supabase.from("mrm_actions").insert(actions.map(a => ({
        mrm_id: mrm.id, description: a.description, owner: a.owner, target_date: a.target, status: "open",
      })));
      Alert.alert("Success", "MRM submitted");
      router.back();
    }
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("manager.mrmReview")}</Text>
        {actions.map((action, idx) => (
          <Card key={idx} className="mb-2">
            <Text className="font-bold text-gray-800 mb-2">Action {idx + 1}</Text>
            <Input label="Description" value={action.description} onChangeText={(v) => updateAction(idx, "description", v)} />
            <Input label="Owner" value={action.owner} onChangeText={(v) => updateAction(idx, "owner", v)} />
            <Input label="Target Date" value={action.target} onChangeText={(v) => updateAction(idx, "target", v)} />
          </Card>
        ))}
        <Button title="Add Action" onPress={addAction} variant="outline" className="mb-4" />
        <Button title={t("app.submit")} onPress={submit} />
      </ScrollView>
    </SafeView>
  );
}