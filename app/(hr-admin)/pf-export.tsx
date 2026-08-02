import { View, Text, ScrollView } from "react-native";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

export default function PFExportScreen() {
  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">PF Challan ECR Export</Text>
        <Card><Text className="text-gray-600">ECR file will be generated in the required format for EPFO upload.</Text></Card>
        <Button title="Download ECR" onPress={() => {}} className="mt-4" />
      </ScrollView>
    </SafeView>
  );
}