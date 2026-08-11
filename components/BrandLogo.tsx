import React from 'react'
import { Image, ImageStyle, StyleProp } from 'react-native'

export type BrandLogoSize = 'sm' | 'md' | 'lg'

interface BrandLogoProps {
  /** sm = 32px (headers/lists), md = 64px (cards, loading state), lg = 128px (login/splash-style reveal) */
  size?: BrandLogoSize
  className?: string
  style?: StyleProp<ImageStyle>
}

// Tailwind's w-8/w-16/w-32 scale (32/64/128px) — matches the sizing already
// used for icon tiles elsewhere in the app (e.g. LoadingScreen's w-16 h-16).
const SIZE_CLASSES: Record<BrandLogoSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-16 h-16',
  lg: 'w-32 h-32',
}

/**
 * Company logo, bundled locally (no network fetch — must work offline on
 * the factory floor). Source: assets/brand/logo-256.png — a small (256x256,
 * transparent-background) asset sized for this component's largest render
 * (128px, at 2x for high-DPI), NOT assets/icon.png (the 1024x1024 launcher
 * icon Android would otherwise decode to ~4MB of ARGB_8888 in memory for a
 * 32-128px on-screen image). Both are derived from
 * assets/brand/varsha-logo-source.jpg via scripts/generate-brand-assets.mjs.
 */
export function BrandLogo({ size = 'md', className = '', style }: BrandLogoProps) {
  return (
    <Image
      source={require('@/assets/brand/logo-256.png')}
      resizeMode="contain"
      className={`${SIZE_CLASSES[size]} rounded-xl ${className}`}
      style={style}
      accessibilityLabel="Varsha Forgings"
    />
  )
}
