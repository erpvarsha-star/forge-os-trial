import React from 'react'
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native'
import { useTranslation } from 'react-i18next'

interface ButtonProps {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  icon?: React.ReactNode
  className?: string
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  className = '',
}: ButtonProps) {
  const { t } = useTranslation()

  const baseStyles = 'flex-row items-center justify-center rounded-lg active:opacity-80'

  const variantStyles = {
    primary: 'bg-orange-600',
    secondary: 'bg-gray-700',
    danger: 'bg-red-600',
    outline: 'border-2 border-orange-600 bg-transparent',
    ghost: 'bg-transparent',
  }

  const sizeStyles = {
    sm: 'px-3 py-2',
    md: 'px-4 py-3',
    lg: 'px-6 py-4',
  }

  const textStyles = {
    primary: 'text-white font-semibold',
    secondary: 'text-white font-semibold',
    danger: 'text-white font-semibold',
    outline: 'text-orange-600 font-semibold',
    ghost: 'text-orange-600 font-semibold',
  }

  const textSizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${isDisabled ? 'opacity-50' : ''} ${className}`}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? '#E65C00' : '#fff'} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon}
          <Text className={`${textStyles[variant]} ${textSizeStyles[size]}`}>{t(title) || title}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}
