import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { supabase } from "@/lib/supabase";

export default function MissingDataScreen() {
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data } = await supabase.from("employees").select("*").eq("is_active", true);
    const incomplete = (data || []).filter((e: any) => !e.phone || !e.department_id || !e.joining_date);
    setEmployees(incomplete);
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">Missing Data Tracker</Text>
        {employees.map((emp) => (
          <Card key={emp.id} className="mb-2">
            <Text className="font-bold">{emp.name}</Text>
            <Text className="text-gray-500 text-sm">{emp.emp_code}</Text>
            <View className="flex-row flex-wrap mt-2">
              {!emp.phone && <Badge text="No Phone" variant="danger" className="mr-2 mb-1" />}
              {!emp.department_id && <Badge text="No Dept" variant="warning" className="mr-2 mb-1" />}
              {!emp.joining_date && <Badge text="No DOJ" variant="info" className="mr-2 mb-1" />}
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}