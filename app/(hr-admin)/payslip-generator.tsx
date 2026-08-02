import { useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

export default function PayslipGeneratorScreen() {
  const [empCode, setEmpCode] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  const generate = async () => {
    Alert.alert("Success", `Payslip generated for ${empCode}`);
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">Generate Payslip</Text>
        <Card>
          <Input label="Employee Code" value={empCode} onChangeText={setEmpCode} />
          <Input label="Month" value={month} onChangeText={setMonth} />
          <Input label="Year" value={year} onChangeText={setYear} keyboardType="number-pad" />
          <Button title="Generate" onPress={generate} />
        </Card>
      </ScrollView>
    </SafeView>
  );
}