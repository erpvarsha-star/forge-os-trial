import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { supabase } from "@/lib/supabase";
import { Shift } from "@/types";

export default function ShiftPlanningScreen() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [newShift, setNewShift] = useState({ name: "", start: "", end: "", dept: "" });

  useEffect(() => { fetchShifts(); }, []);

  const fetchShifts = async () => {
    const { data } = await supabase.from("shifts").select("*");
    if (data) setShifts(data as Shift[]);
  };

  const addShift = async () => {
    const { error } = await supabase.from("shifts").insert({
      name: newShift.name, start_time: newShift.start, end_time: newShift.end, department_id: newShift.dept,
    });
    if (!error) { setNewShift({ name: "", start: "", end: "", dept: "" }); fetchShifts(); }
  };

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">Shift Planning</Text>
        <Card>
          <Input label="Shift Name" value={newShift.name} onChangeText={(t) => setNewShift({ ...newShift, name: t })} />
          <Input label="Start Time" value={newShift.start} onChangeText={(t) => setNewShift({ ...newShift, start: t })} placeholder="HH:MM" />
          <Input label="End Time" value={newShift.end} onChangeText={(t) => setNewShift({ ...newShift, end: t })} placeholder="HH:MM" />
          <Button title="Add Shift" onPress={addShift} />
        </Card>
        {shifts.map((s) => (
          <Card key={s.id} className="mt-2"><Text className="font-bold">{s.name}</Text><Text className="text-gray-500">{s.start_time} - {s.end_time}</Text></Card>
        ))}
      </ScrollView>
    </SafeView>
  );
}