import { View, ActivityIndicator, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { APP_CONFIG } from "@/lib/config";

export function Loading() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 justify-center items-center bg-gray-50">
      <ActivityIndicator size="large" color={APP_CONFIG.primaryColor} />
      <Text className="mt-4 text-gray-600">{t("app.loading")}</Text>
    </View>
  );
}