import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useAuthStore } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Task } from "@/types";

export default function ManagerTasksScreen() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => { fetchTasks(); }, []);

  const fetchTasks = async () => {
    if (!employee) return;
    const { data } = await supabase.from("tasks").select("*").eq("department_id", employee.department_id);
    if (data) setTasks(data as Task[]);
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("manager.deptTasks")}</Text>
        {tasks.map((task) => (
          <Card key={task.id} className="mb-2">
            <Text className="font-bold text-gray-800">{task.title}</Text>
            <Text className="text-gray-500 text-sm">{task.description}</Text>
            <Badge text={task.status} variant={task.status === "completed" ? "success" : task.status === "overdue" ? "danger" : "warning"} className="mt-2" />
          </Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}