import { TouchableOpacity, Text, ActivityIndicator } from "react-native";

interface ButtonProps {
  title: string; onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "outline";
  size?: "sm" | "md" | "lg"; disabled?: boolean; loading?: boolean; className?: string;
}

export function Button({ title, onPress, variant = "primary", size = "md", disabled = false, loading = false, className }: ButtonProps) {
  const variants = {
    primary: "bg-primary", secondary: "bg-gray-600", danger: "bg-danger", outline: "bg-transparent border-2 border-primary",
  };
  const sizes = { sm: "px-3 py-2", md: "px-4 py-3", lg: "px-6 py-4" };
  const textColors = { primary: "text-white", secondary: "text-white", danger: "text-white", outline: "text-primary" };
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || loading}
      className={`rounded-lg items-center justify-center ${variants[variant]} ${sizes[size]} ${(disabled || loading) ? "opacity-50" : ""} ${className || ""}`}>
      {loading ? <ActivityIndicator color={variant === "outline" ? "#E65C00" : "#fff"} /> : (
        <Text className={`font-semibold ${textColors[variant]} ${size === "lg" ? "text-lg" : "text-base"}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}