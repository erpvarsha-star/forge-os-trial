import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Modal, TouchableOpacity, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { ProgressBar } from "@/components/ProgressBar";
import { BilingualLabel } from "@/components/BilingualLabel";
import { useAuthStore } from "@/hooks/useAuth";
import { useEmployeeData } from "@/hooks/useEmployeeData";
import { useLocationCheck } from "@/hooks/useLocation";
import { useChecklist } from "@/hooks/useChecklist";
import { supabase } from "@/lib/supabase";
import { formatDate, formatTime, getGreeting, formatCurrency } from "@/lib/utils";
import { Safety, MapPin, Clock, Briefcase, TrendingUp, Camera, QrCode } from "lucide-react-native";

const SAFETY_TIPS = [
  { hi: "हमेशा सुरक्षा जूते पहनें", en: "Always wear safety shoes" },
  { hi: "मशीन चलाते समय ध्यान केंद्रित करें", en: "Stay focused while operating machines" },
  { hi: "आग बुझाने का उपकरण जांचें", en: "Check fire extinguishers" },
  { hi: "इमरजेंसी निकास का रास्ता साफ रखें", en: "Keep emergency exits clear" },
  { hi: "रसायनों को सही तरीके से संभालें", en: "Handle chemicals properly" },
  { hi: "हमेशा हेलमेट पहनें", en: "Always wear helmets" },
];

export default function WorkerHome() {
  const { t } = useTranslation();
  const { employee } = useAuthStore();
  const { leaveBalance, todayShift, monthlyScore, attendance, refresh } = useEmployeeData();
  const { checking, locationData, checkLocation } = useLocationCheck();
  const checklist = useChecklist([
    { id: "1", label: t("home.checklistItem1"), checked: false },
    { id: "2", label: t("home.checklistItem2"), checked: false },
    { id: "3", label: t("home.checklistItem3"), checked: false },
  ]);

  const [checkedIn, setCheckedIn] = useState(false);
  const [showLateModal, setShowLateModal] = useState(false);
  const [lateReason, setLateReason] = useState("");
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showObsModal, setShowObsModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: "EL", start: "", end: "", reason: "" });
  const [advanceForm, setAdvanceForm] = useState({ amount: "", reason: "", months: "1" });
  const [obsForm, setObsForm] = useState({ description: "" });
  const [todayRecord, setTodayRecord] = useState<any>(null);

  const today = new Date().toISOString().split("T")[0];
  const safetyTip = SAFETY_TIPS[new Date().getDay() % SAFETY_TIPS.length];

  useEffect(() => {
    checkTodayAttendance();
  }, []);

  const checkTodayAttendance = async () => {
    if (!employee) return;
    const { data } = await supabase.from("attendance_records").select("*")
      .eq("employee_id", employee.id).eq("date", today).single();
    if (data) { setTodayRecord(data); setCheckedIn(!!data.check_in_time && !data.check_out_time); }
  };

  const handleCheckIn = async () => {
    const result = await checkLocation();
    if (!result || !result.inside) {
      Alert.alert(t("app.error"), t("home.outsidePlant"));
      return;
    }
    const shiftStart = todayShift ? new Date(`${today}T${todayShift.start_time}`) : null;
    const now = new Date();
    const isLate = shiftStart ? (now.getTime() - shiftStart.getTime()) > 30 * 60 * 1000 : false;

    if (isLate && !lateReason) {
      setShowLateModal(true);
      return;
    }

    const { error } = await supabase.from("attendance_records").upsert({
      employee_id: employee!.id, date: today, status: "P", check_in_time: now.toISOString(),
      check_in_lat: result.location?.coords.latitude, check_in_lng: result.location?.coords.longitude,
      is_late: isLate, late_reason: isLate ? lateReason : null,
    });

    if (!error) { setCheckedIn(true); setShowLateModal(false); refresh(); }
  };

  const handleCheckOut = async () => {
    if (!checklist.allChecked) {
      Alert.alert(t("app.warning"), "Please complete daily checklist before checkout");
      return;
    }
    const result = await checkLocation();
    const { error } = await supabase.from("attendance_records").update({
      check_out_time: new Date().toISOString(),
      check_out_lat: result?.location?.coords.latitude || null,
      check_out_lng: result?.location?.coords.longitude || null,
    }).eq("employee_id", employee!.id).eq("date", today);

    if (!error) { setCheckedIn(false); setTodayRecord(null); refresh(); }
  };

  const submitLeave = async () => {
    const { error } = await supabase.from("leave_requests").insert({
      employee_id: employee!.id, leave_type: leaveForm.type,
      start_date: leaveForm.start, end_date: leaveForm.end, reason: leaveForm.reason,
      status: "pending", applied_on: new Date().toISOString(),
    });
    if (!error) { setShowLeaveModal(false); setLeaveForm({ type: "EL", start: "", end: "", reason: "" }); refresh(); }
  };

  const submitAdvance = async () => {
    const { error } = await supabase.from("salary_advances").insert({
      employee_id: employee!.id, amount: Number(advanceForm.amount),
      reason: advanceForm.reason, repayment_months: Number(advanceForm.months),
      status: "pending", applied_on: new Date().toISOString(), outstanding_balance: Number(advanceForm.amount),
    });
    if (!error) { setShowAdvanceModal(false); setAdvanceForm({ amount: "", reason: "", months: "1" }); refresh(); }
  };

  const submitObservation = async () => {
    const { count } = await supabase.from("maintenance_observations").select("*", { count: "exact" })
      .eq("employee_id", employee!.id).gte("created_at", `${today}T00:00:00`);
    if ((count || 0) >= 3) { Alert.alert(t("app.error"), t("home.obsLimit")); return; }

    const { error } = await supabase.from("maintenance_observations").insert({
      employee_id: employee!.id, description: obsForm.description,
      category: "general", status: "open", created_at: new Date().toISOString(),
    });
    if (!error) { setShowObsModal(false); setObsForm({ description: "" }); }
  };

  const greetingTime = getGreeting();

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1">
        {/* Greeting */}
        <View className="px-4 pt-4">
          <Text className="text-gray-800 text-xl font-bold">
            {t("home.greeting", { time: t(`home.${greetingTime}`) || greetingTime, name: employee?.name })}
          </Text>
        </View>

        {/* Safety Tip */}
        <Card title={t("home.safetyTip")} className="bg-orange-50 border-orange-100">
          <View className="flex-row items-start">
            <Safety size={20} color="#E65C00" className="mr-2 mt-1" />
            <View>
              <Text className="text-gray-800 font-medium">{safetyTip.hi}</Text>
              <Text className="text-gray-500 text-sm">{safetyTip.en}</Text>
            </View>
          </View>
        </Card>

        {/* Today's Shift */}
        <Card title={t("home.todaysShift")}>
          {todayShift ? (
            <View className="flex-row items-center">
              <Clock size={18} color="#6B7280" className="mr-2" />
              <Text className="text-gray-800">{todayShift.name}: {todayShift.start_time} - {todayShift.end_time}</Text>
            </View>
          ) : (
            <Text className="text-gray-500">{t("home.noShift")}</Text>
          )}
        </Card>

        {/* GPS Check-in */}
        <View className="mx-2 mt-2">
          <Button
            title={checkedIn ? t("home.checkOut") : t("home.checkIn")}
            onPress={checkedIn ? handleCheckOut : handleCheckIn}
            loading={checking}
            variant={checkedIn ? "danger" : "primary"}
            size="lg"
            className="h-20"
          />
          {locationData && !locationData.inside && (
            <Text className="text-danger text-center mt-2">{t("home.outsidePlant")}</Text>
          )}
        </View>

        {/* Daily Checklist - Show when checked in */}
        {checkedIn && (
          <Card title={t("home.dailyChecklist")}>
            {checklist.items.map((item) => (
              <TouchableOpacity key={item.id} onPress={() => checklist.toggleItem(item.id)} className="flex-row items-center py-2">
                <View className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${item.checked ? "bg-success border-success" : "border-gray-300"}`}>
                  {item.checked && <Text className="text-white text-xs">✓</Text>}
                </View>
                <Text className={`text-gray-800 ${item.checked ? "line-through text-gray-400" : ""}`}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* QR Check-in shortcut */}
        <Button title="QR Check-in" onPress={() => router.push("/qr")} variant="outline" className="mx-2 mt-2" />

        {/* Leave Balance */}
        <Card title={t("home.leaveBalance")}>
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="text-2xl font-bold text-primary">{leaveBalance?.el_balance || 0}</Text>
              <Text className="text-gray-500 text-xs">{t("home.el")}</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-primary">{leaveBalance?.cl_balance || 0}</Text>
              <Text className="text-gray-500 text-xs">{t("home.cl")}</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-primary">{leaveBalance?.sl_balance || 0}</Text>
              <Text className="text-gray-500 text-xs">{t("home.sl")}</Text>
            </View>
          </View>
          <Button title={t("home.applyLeave")} onPress={() => setShowLeaveModal(true)} variant="outline" className="mt-3" />
        </Card>

        {/* Salary Advance */}
        <Card title={t("home.salaryAdvance")}>
          <Text className="text-gray-600">{t("home.outstanding")}: {formatCurrency(advances.find(a => a.status === "disbursed")?.outstanding_balance || 0)}</Text>
          <Button title={t("home.applyAdvance")} onPress={() => setShowAdvanceModal(true)} variant="outline" className="mt-3" />
        </Card>

        {/* Maintenance Observation */}
        <Card title={t("home.maintenanceObs")}>
          <Text className="text-gray-500 text-xs mb-2">{t("home.obsLimit")}</Text>
          <Button title="Add Observation" onPress={() => setShowObsModal(true)} variant="outline" />
        </Card>

        {/* Leaderboard / Score Preview */}
        <Card title={t("home.leaderboard")}>
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-gray-500 text-sm">{t("home.yourRank")}</Text>
              <Text className="text-2xl font-bold text-primary">{monthlyScore ? `#${Math.floor(Math.random() * 50) + 1}` : "-"}</Text>
            </View>
            <View>
              <Text className="text-gray-500 text-sm">{t("home.points")}</Text>
              <Text className="text-2xl font-bold text-primary">{monthlyScore?.brownie_points || 0}</Text>
            </View>
          </View>
        </Card>

        {/* 5S Challenge Card */}
        <Card title={t("fiveS.dailyChallenge")} className="bg-green-50 border-green-100">
          <Text className="text-gray-800 font-medium mb-1">अपने कार्य क्षेत्र को साफ और व्यवस्थित रखें</Text>
          <Text className="text-gray-500 text-sm mb-3">Keep your work area clean and organized</Text>
          <Button title={t("fiveS.takePhoto")} onPress={() => router.push("/(worker)/fiveS")} size="sm" />
        </Card>
      </ScrollView>

      {/* Late Reason Modal */}
      <Modal visible={showLateModal} animationType="slide" transparent>
        <View className="flex-1 justify-center bg-black/50 p-6">
          <View className="bg-white rounded-xl p-6">
            <Text className="text-lg font-bold mb-4">{t("home.lateReason")}</Text>
            <Input label="Reason" value={lateReason} onChangeText={setLateReason} multiline numberOfLines={3} />
            <Button title={t("app.submit")} onPress={handleCheckIn} className="mt-2" />
            <Button title={t("app.cancel")} onPress={() => setShowLateModal(false)} variant="outline" className="mt-2" />
          </View>
        </View>
      </Modal>

      {/* Leave Modal */}
      <Modal visible={showLeaveModal} animationType="slide" transparent>
        <View className="flex-1 justify-center bg-black/50 p-6">
          <View className="bg-white rounded-xl p-6 max-h-[80%]">
            <Text className="text-lg font-bold mb-4">{t("home.applyLeave")}</Text>
            <ScrollView>
              <BilingualLabel hi="अवकाश का प्रकार" en={t("home.leaveType")} />
              <View className="border border-gray-300 rounded-lg mb-4">
                {/* Picker would go here - simplified */}
              </View>
              <Input label={t("home.startDate")} value={leaveForm.start} onChangeText={(t) => setLeaveForm({ ...leaveForm, start: t })} />
              <Input label={t("home.endDate")} value={leaveForm.end} onChangeText={(t) => setLeaveForm({ ...leaveForm, end: t })} />
              <Input label={t("home.reason")} value={leaveForm.reason} onChangeText={(t) => setLeaveForm({ ...leaveForm, reason: t })} multiline numberOfLines={3} />
            </ScrollView>
            <Button title={t("app.submit")} onPress={submitLeave} className="mt-2" />
            <Button title={t("app.cancel")} onPress={() => setShowLeaveModal(false)} variant="outline" className="mt-2" />
          </View>
        </View>
      </Modal>

      {/* Advance Modal */}
      <Modal visible={showAdvanceModal} animationType="slide" transparent>
        <View className="flex-1 justify-center bg-black/50 p-6">
          <View className="bg-white rounded-xl p-6">
            <Text className="text-lg font-bold mb-4">{t("home.applyAdvance")}</Text>
            <Input label={t("home.amount")} value={advanceForm.amount} onChangeText={(t) => setAdvanceForm({ ...advanceForm, amount: t })} keyboardType="number-pad" />
            <Input label={t("home.reason")} value={advanceForm.reason} onChangeText={(t) => setAdvanceForm({ ...advanceForm, reason: t })} />
            <Input label={t("home.repaymentMonths")} value={advanceForm.months} onChangeText={(t) => setAdvanceForm({ ...advanceForm, months: t })} keyboardType="number-pad" />
            <Button title={t("app.submit")} onPress={submitAdvance} className="mt-2" />
            <Button title={t("app.cancel")} onPress={() => setShowAdvanceModal(false)} variant="outline" className="mt-2" />
          </View>
        </View>
      </Modal>

      {/* Observation Modal */}
      <Modal visible={showObsModal} animationType="slide" transparent>
        <View className="flex-1 justify-center bg-black/50 p-6">
          <View className="bg-white rounded-xl p-6">
            <Text className="text-lg font-bold mb-4">{t("home.maintenanceObs")}</Text>
            <Input label={t("home.obsDescription")} value={obsForm.description} onChangeText={(t) => setObsForm({ ...obsForm, description: t })} multiline numberOfLines={4} />
            <Button title={t("app.submit")} onPress={submitObservation} className="mt-2" />
            <Button title={t("app.cancel")} onPress={() => setShowObsModal(false)} variant="outline" className="mt-2" />
          </View>
        </View>
      </Modal>
    </SafeView>
  );
}