import { useState, useEffect } from "react";
import { View, Text, ScrollView, TextInput } from "react-native";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { supabase } from "@/lib/supabase";
import { Employee } from "@/types";
import { Search } from "lucide-react-native";

export default function EmployeeMasterScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => { fetchEmployees(); }, []);

  const fetchEmployees = async () => {
    const { data } = await supabase.from("employees").select("*").order("name");
    if (data) setEmployees(data as Employee[]);
  };

  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) || e.emp_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">Employee Master</Text>
        <View className="flex-row items-center bg-white border border-gray-300 rounded-lg px-3 mb-4">
          <Search size={18} color="#9CA3AF" />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search by name or code" className="flex-1 py-3 px-2 text-gray-800" />
        </View>
        {filtered.map((emp) => (
          <Card key={emp.id} className="flex-row justify-between items-center mb-2">
            <View><Text className="font-bold text-gray-800">{emp.name}</Text><Text className="text-gray-500 text-sm">{emp.emp_code} • {emp.department}</Text></View>
            <Badge text={emp.role} variant={emp.is_active ? "success" : "default"} />
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}