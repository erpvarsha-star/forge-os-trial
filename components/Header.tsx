import { View, Text, Image } from "react-native";
import { useAuthStore } from "@/hooks/useAuth";
import { APP_CONFIG } from "@/lib/config";

export function Header() {
  const { employee } = useAuthStore();
  return (
    <View className="bg-primary px-4 py-3 flex-row items-center justify-between">
      <View className="flex-row items-center">
        {APP_CONFIG.logoUrl ? (
          <Image source={{ uri: APP_CONFIG.logoUrl }} className="w-8 h-8 mr-2" resizeMode="contain" />
        ) : (
          <View className="w-8 h-8 bg-white/20 rounded-full items-center justify-center mr-2">
            <Text className="text-white font-bold">F</Text>
          </View>
        )}
        <View>
          <Text className="text-white font-bold text-lg">{APP_CONFIG.companyName}</Text>
          <Text className="text-white/80 text-xs">{APP_CONFIG.appName}</Text>
        </View>
      </View>
      <View className="items-end">
        <Text className="text-white font-semibold text-sm">{employee?.emp_code}</Text>
        <Text className="text-white/80 text-xs capitalize">{employee?.role}</Text>
      </View>
    </View>
  );
}