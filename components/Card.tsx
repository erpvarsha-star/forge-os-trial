import { View, Text } from "react-native";
import { ReactNode } from "react";

interface CardProps { children: ReactNode; className?: string; title?: string; titleClassName?: string; }

export function Card({ children, className, title, titleClassName }: CardProps) {
  return (
    <View className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 m-2 ${className || ""}`}>
      {title ? <Text className={`text-lg font-bold text-gray-800 mb-3 ${titleClassName || ""}`}>{title}</Text> : null}
      {children}
    </View>
  );
}