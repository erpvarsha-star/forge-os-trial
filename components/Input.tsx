import { TextInput, Text, View } from "react-native";

interface InputProps {
  label?: string; placeholder?: string; value: string; onChangeText: (text: string) => void;
  secureTextEntry?: boolean; keyboardType?: "default" | "number-pad" | "email-address" | "phone-pad";
  error?: string; className?: string; maxLength?: number; multiline?: boolean; numberOfLines?: number;
}

export function Input({ label, placeholder, value, onChangeText, secureTextEntry = false, keyboardType = "default", error, className, maxLength, multiline, numberOfLines }: InputProps) {
  return (
    <View className={`mb-4 ${className || ""}`}>
      {label ? <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text> : null}
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} secureTextEntry={secureTextEntry}
        keyboardType={keyboardType} maxLength={maxLength} multiline={multiline} numberOfLines={numberOfLines}
        className={`border rounded-lg px-4 py-3 text-base text-gray-900 bg-white ${error ? "border-danger" : "border-gray-300"} ${multiline ? "h-24" : ""}`}
        placeholderTextColor="#9CA3AF" />
      {error ? <Text className="text-danger text-xs mt-1">{error}</Text> : null}
    </View>
  );
}