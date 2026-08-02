import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";

interface ErrorViewProps { message?: string; onRetry?: () => void; }

export function ErrorView({ message, onRetry }: ErrorViewProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 justify-center items-center p-6 bg-gray-50">
      <Text className="text-danger text-lg font-semibold mb-2">{t("app.error")}</Text>
      <Text className="text-gray-600 text-center mb-4">{message || t("errors.generic")}</Text>
      {onRetry ? <Button title={t("app.retry") || "Retry"} onPress={onRetry} variant="outline" /> : null}
    </View>
  );
}