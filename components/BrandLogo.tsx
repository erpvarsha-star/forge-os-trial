import React from 'react'
import { Image, ImageStyle, StyleProp } from 'react-native'

export type BrandLogoSize = 'sm' | 'md' | 'lg'

interface BrandLogoProps {
  /** sm = 32px (headers/lists), md = 64px (cards, loading state), lg = 128px (login/splash-style reveal) */
  size?: BrandLogoSize
  className?: string
  style?: StyleProp<ImageStyle>
}

// Matches Tailwind's w-8/w-16/w-32 scale (32/64/128px) and the icon-tile
// sizing already used elsewhere (e.g. LoadingScreen's w-16 h-16).
//
// Applied as explicit numbers rather than `w-8`/`w-16`/`w-32` classes: those
// classes do NOT size an <Image>, which falls back to the asset's intrinsic
// dimensions instead. That silently rendered every BrandLogo at the source
// asset's full 256x256 — the login screen's logo was double its intended
// 128px and swamped the layout, and Header only looked right because it
// happened to pass an inline width/height override.
const SIZE_PX: Record<BrandLogoSize, number> = {
  sm: 32,
  md: 64,
  lg: 128,
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
      className={className}
      // `style` comes last so an explicit override from a caller still wins.
      style={[{ width: SIZE_PX[size], height: SIZE_PX[size] }, style]}
      accessibilityLabel="Varsha Forgings"
    />
  )
}
