import { View, Text, ScrollView } from "react-native";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

export default function ESICExportScreen() {
  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">ESIC Challan CSV Export</Text>
        <Card><Text className="text-gray-600">CSV file will be generated in the required format for ESIC portal upload.</Text></Card>
        <Button title="Download CSV" onPress={() => {}} className="mt-4" />
      </ScrollView>
    </SafeView>
  );
}