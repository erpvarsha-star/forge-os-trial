import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Task } from "@/types";

export default function TasksScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => { fetchTasks(); }, []);

  const fetchTasks = async () => {
    if (!employee) return;
    const { data } = await supabase.from("tasks").select("*").eq("assigned_to", employee.id).neq("status", "completed");
    if (data) setTasks(data as Task[]);
  };

  const markComplete = async (id: string) => {
    const { error } = await supabase.from("tasks").update({ status: "completed" }).eq("id", id);
    if (!error) { Alert.alert("Success", "Task marked complete"); fetchTasks(); }
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("supervisor.maintenanceTasks")}</Text>
        {tasks.map((task) => (
          <Card key={task.id} className="mb-2">
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="font-bold text-gray-800">{task.title}</Text>
                <Text className="text-gray-500 text-sm">{task.description}</Text>
                <Badge text={task.priority} variant={task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "info"} className="mt-2" />
              </View>
            </View>
            <Button title="Mark Complete" onPress={() => markComplete(task.id)} size="sm" className="mt-3" />
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}