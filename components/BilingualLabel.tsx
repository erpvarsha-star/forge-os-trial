import { View, Text } from "react-native";

interface BilingualLabelProps { hi: string; en: string; className?: string; }

export function BilingualLabel({ hi, en, className }: BilingualLabelProps) {
  return (
    <View className={`mb-1 ${className || ""}`}>
      <Text className="text-gray-800 font-medium text-base">{hi}</Text>
      <Text className="text-gray-500 text-sm">{en}</Text>
    </View>
  );
}