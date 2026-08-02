import { useState, useEffect } from "react";
import { View, Text, ScrollView, Dimensions } from "react-native";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { LineChart } from "react-native-chart-kit";
import { supabase } from "@/lib/supabase";

export default function KPIDashboardScreen() {
  const [attendanceData, setAttendanceData] = useState<number[]>([80, 82, 78, 85, 88, 90, 87]);

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">KPI Dashboard</Text>
        <Card>
          <Text className="font-bold text-gray-800 mb-2">7-Day Attendance Trend</Text>
          <LineChart
            data={{ labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], datasets: [{ data: attendanceData }] }}
            width={Dimensions.get("window").width - 48}
            height={200}
            chartConfig={{ backgroundColor: "#fff", backgroundGradientFrom: "#fff", backgroundGradientTo: "#fff", decimalPlaces: 0, color: (opacity = 1) => `rgba(230, 92, 0, ${opacity})`, labelColor: () => "#6B7280" }}
            bezier
          />
        </Card>
      </ScrollView>
    </SafeView>
  );
}