import React, { useState } from 'react'
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
  /** Optional additions — all default to previous behaviour, safe to omit. */
  editable?: boolean
  helperText?: string
  required?: boolean
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
  editable = true,
  helperText,
  required = false,
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false)

  const borderColor = error
    ? 'border-status-rejected'
    : isFocused
      ? 'border-brand-600'
      : 'border-ink-300'

  return (
    <View className={`${className}`}>
      {label && (
        <Text className="text-sm font-semibold text-ink-700 mb-1.5">
          {label}
          {required && <Text className="text-status-rejected"> *</Text>}
        </Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines : 1}
        editable={editable}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        // textAlignVertical is a real RN prop for top-aligned multiline text;
        // the previous `text-top` className isn't a valid utility and was a
        // no-op, so multiline fields vertically centered their first line.
        textAlignVertical={multiline ? 'top' : 'center'}
        className={`border-[1.5px] rounded-lg px-4 py-3.5 text-base text-ink-900 bg-white leading-5 ${borderColor} ${
          !editable ? 'bg-ink-50 text-ink-500' : ''
        } ${multiline ? 'min-h-[96px]' : 'min-h-touch'}`}
        placeholderTextColor="#8B93A3"
      />
      {error ? (
        <Text className="text-sm text-status-rejected mt-1.5 font-medium">{error}</Text>
      ) : helperText ? (
        <Text className="text-xs text-ink-500 mt-1.5">{helperText}</Text>
      ) : null}
    </View>
  )
}
