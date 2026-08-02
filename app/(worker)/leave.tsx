import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { useEmployeeData } from "@/hooks/useEmployeeData";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANTS: Record<string, any> = {
  pending: "warning", approved: "success", rejected: "danger", cancelled: "default",
};

export default function LeaveScreen() {
  const { t } = useTranslation();
  const { leaveRequests } = useEmployeeData();

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("leave.title")}</Text>
        {leaveRequests.length === 0 ? (
          <Card><Text className="text-gray-500 text-center">No leave requests found</Text></Card>
        ) : (
          leaveRequests.map((req) => (
            <Card key={req.id} className="mb-2">
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="font-bold text-gray-800">{req.leave_type} Leave</Text>
                  <Text className="text-gray-500 text-sm">{formatDate(req.start_date)} - {formatDate(req.end_date)}</Text>
                  <Text className="text-gray-600 mt-1">{req.reason}</Text>
                  <Text className="text-gray-400 text-xs mt-2">{t("leave.appliedOn")}: {formatDate(req.applied_on)}</Text>
                </View>
                <Badge text={t(`leave.${req.status}`)} variant={STATUS_VARIANTS[req.status] || "default"} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeView>
  );
}