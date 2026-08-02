import { View } from "react-native";

interface ProgressBarProps { progress: number; color?: string; height?: number; className?: string; }

export function ProgressBar({ progress, color = "#E65C00", height = 8, className }: ProgressBarProps) {
  const clamped = Math.min(Math.max(progress, 0), 100);
  return (
    <View className={`bg-gray-200 rounded-full overflow-hidden ${className || ""}`} style={{ height }}>
      <View className="rounded-full" style={{ width: `${clamped}%`, height: "100%", backgroundColor: color }} />
    </View>
  );
}