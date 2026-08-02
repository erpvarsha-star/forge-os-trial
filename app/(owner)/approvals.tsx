import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export default function OwnerApprovalsScreen() {
  const { employee } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    const { data: leaves } = await supabase.from("leave_requests").select("*, employees(name)").eq("status", "pending");
    const { data: advances } = await supabase.from("salary_advances").select("*, employees(name)").eq("status", "pending");
    setItems([...(leaves || []).map((l: any) => ({ ...l, type: "leave" })), ...(advances || []).map((a: any) => ({ ...a, type: "advance" }))]);
  };

  const approve = async (id: string, table: string) => {
    await supabase.from(table).update({ status: "approved", approved_by: employee!.id }).eq("id", id);
    Alert.alert("Approved"); fetchItems();
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">Final Approvals</Text>
        {items.map((item) => (
          <Card key={`${item.type}-${item.id}`} className="mb-2">
            <Text className="font-bold">{item.employees?.name}</Text>
            <Text className="text-gray-500 capitalize">{item.type}: {item.amount || item.leave_type}</Text>
            <Button title="Approve" onPress={() => approve(item.id, item.type === "leave" ? "leave_requests" : "salary_advances")} size="sm" className="mt-2" />
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}