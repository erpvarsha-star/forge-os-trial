import React from 'react'
import { View, TextInput, Text } from 'react-native'

interface InputProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  label?: string
  error?: string
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad'
  maxLength?: number
  className?: string
  multiline?: boolean
  numberOfLines?: number
}

export function Input({
  value,
  onChangeText,
  placeholder,
  label,
  error,
  secureTextEntry = false,
  keyboardType = 'default',
  maxLength,
  className = '',
  multiline = false,
  numberOfLines = 1,
}: InputProps) {
  return (
    <View className={`${className}`}>
      {label && <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines : 1}
        className={`border rounded-lg px-4 py-3 text-base text-gray-900 bg-white ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${multiline ? 'h-24 text-top' : ''}`}
        placeholderTextColor="#9CA3AF"
      />
      {error && <Text className="text-sm text-red-500 mt-1">{error}</Text>}
    </View>
  )
}
