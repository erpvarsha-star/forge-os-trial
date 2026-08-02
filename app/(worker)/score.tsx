import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { Badge } from "@/components/Badge";
import { useEmployeeData } from "@/hooks/useEmployeeData";
import { Trophy, Star, Award } from "lucide-react-native";

export default function ScoreScreen() {
  const { t } = useTranslation();
  const { monthlyScore, loading } = useEmployeeData();

  if (loading) return <SafeView><Text className="text-center mt-10">Loading...</Text></SafeView>;

  const score = monthlyScore;
  const components = [
    { label: t("score.attendanceScore"), value: score?.attendance_score || 0, weight: 25 },
    { label: t("score.onTimeScore"), value: score?.on_time_score || 0, weight: 20 },
    { label: t("score.taskScore"), value: score?.task_completion_score || 0, weight: 20 },
    { label: t("score.kpiScore"), value: score?.kpi_score || 0, weight: 20 },
    { label: t("score.productionScore"), value: score?.production_score || 0, weight: 15 },
  ];

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("score.title")}</Text>

        {/* Composite Score */}
        <Card className="items-center py-8">
          <Trophy size={48} color="#E65C00" />
          <Text className="text-5xl font-bold text-primary mt-4">{score?.composite_score || 0}</Text>
          <Text className="text-gray-500">{t("score.outOf")}</Text>
          <Text className="text-lg font-semibold text-gray-800 mt-2">{t("score.compositeScore")}</Text>
        </Card>

        {/* Component Bars */}
        <Card title="Score Breakdown">
          {components.map((comp, idx) => (
            <View key={idx} className="mb-4">
              <View className="flex-row justify-between mb-1">
                <Text className="text-gray-700 font-medium">{comp.label}</Text>
                <Text className="text-gray-500">{comp.value}/100</Text>
              </View>
              <ProgressBar progress={comp.value} color={comp.value >= 80 ? "#22C55E" : comp.value >= 60 ? "#F59E0B" : "#EF4444"} />
            </View>
          ))}
        </Card>

        {/* Brownie Points */}
        <Card className="bg-yellow-50 border-yellow-100">
          <View className="flex-row items-center">
            <Star size={24} color="#F59E0B" className="mr-3" />
            <View>
              <Text className="text-lg font-bold text-gray-800">{score?.brownie_points || 0}</Text>
              <Text className="text-gray-500">{t("score.browniePoints")}</Text>
            </View>
          </View>
        </Card>

        {/* EoTM Badge */}
        {score?.eotm_badge && (
          <Card className="bg-amber-50 border-amber-100">
            <View className="flex-row items-center">
              <Award size={24} color="#D97706" className="mr-3" />
              <View>
                <Badge text={t(`score.${score.eotm_badge}`)} variant="warning" />
                <Text className="text-gray-800 font-medium mt-1">{t("score.eotm")}</Text>
              </View>
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeView>
  );
}