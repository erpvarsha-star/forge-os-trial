import { View, Text } from "react-native";

interface BadgeProps { text: string; variant?: "success" | "danger" | "warning" | "info" | "default"; className?: string; }

export function Badge({ text, variant = "default", className }: BadgeProps) {
  const variants = {
    success: "bg-success/10 text-success", danger: "bg-danger/10 text-danger",
    warning: "bg-warning/10 text-warning", info: "bg-info/10 text-info", default: "bg-gray-100 text-gray-600",
  };
  return (
    <View className={`px-2 py-1 rounded-full ${variants[variant]} ${className || ""}`}>
      <Text className={`text-xs font-medium ${variants[variant].split(" ")[1]}`}>{text}</Text>
    </View>
  );
}