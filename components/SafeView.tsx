import { SafeAreaView } from "react-native-safe-area-context";
import { ReactNode } from "react";

interface SafeViewProps { children: ReactNode; className?: string; }

export function SafeView({ children, className }: SafeViewProps) {
  return <SafeAreaView className={`flex-1 bg-gray-50 ${className || ""}`}>{children}</SafeAreaView>;
}