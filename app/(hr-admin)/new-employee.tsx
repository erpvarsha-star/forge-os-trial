import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { supabase } from "@/lib/supabase";

export default function NewEmployeeScreen() {
  const [form, setForm] = useState({ name: "", phone: "", emp_code: "", department: "", role: "member" });

  const submit = async () => {
    const { error } = await supabase.from("employees").insert({
      ...form, is_active: false, language_preference: "hi", category: "permanent",
    });
    if (!error) { Alert.alert("Success", "Employee created. Awaiting Plant Head & Owner approval."); router.back(); }
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">New Employee Activation</Text>
        <Text className="text-gray-500 mb-4">HR Admin → Plant Head → Owner</Text>
        <Card>
          <Input label="Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
          <Input label="Phone" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} keyboardType="phone-pad" />
          <Input label="Employee Code" value={form.emp_code} onChangeText={(t) => setForm({ ...form, emp_code: t })} />
          <Input label="Department" value={form.department} onChangeText={(t) => setForm({ ...form, department: t })} />
        </Card>
        <Button title="Submit for Approval" onPress={submit} className="mt-4" />
      </ScrollView>
    </SafeView>
  );
}