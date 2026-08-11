import React from 'react'
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { BRAND } from './theme'

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

  // Primary/danger are the "committal" actions and carry a touch of
  // elevation; secondary/outline/ghost stay flat so they read as lower
  // priority next to a primary action on the same screen.
  const variantStyles = {
    primary: 'bg-brand-600 shadow-card',
    secondary: 'bg-ink-100 border border-ink-200',
    danger: 'bg-status-rejected shadow-card',
    outline: 'border-2 border-brand-600 bg-transparent',
    ghost: 'bg-transparent',
  }

  // Minimum 44px tall at every size — this is used on cheap Android phones
  // by workers in safety gloves on a factory floor, so even the "small"
  // size must stay a comfortable tap target.
  const sizeStyles = {
    sm: 'min-h-touch px-3.5 py-2.5',
    md: 'min-h-[48px] px-4 py-3',
    lg: 'min-h-[56px] px-6 py-4',
  }

  const textStyles = {
    primary: 'text-white font-semibold',
    secondary: 'text-ink-800 font-semibold',
    danger: 'text-white font-semibold',
    outline: 'text-brand-600 font-semibold',
    ghost: 'text-brand-600 font-semibold',
  }

  const textSizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  const spinnerColor = variant === 'outline' || variant === 'ghost' ? BRAND[600] : variant === 'secondary' ? '#22262F' : '#fff'

  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${isDisabled ? 'opacity-50' : ''} ${className}`}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon}
          {/* No numberOfLines/truncation: Hindi labels run longer than their
              English source and must be free to wrap onto a second line
              instead of being clipped. min-h-* above sets a floor, not a
              ceiling, so the button grows to fit. */}
          <Text className={`${textStyles[variant]} ${textSizeStyles[size]} text-center`}>
            {t(title) || title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}
