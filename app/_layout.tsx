import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { BrandLogo } from '@/components/BrandLogo'
import '@/i18n'

// Kept short deliberately — this is a shift-floor app opened many times a
// day, so the reveal must read as a nice touch, not a wait. Total time on
// screen is REVEAL_MS + HOLD_MS + FADE_OUT_MS ≈ 1.15s, comfortably under
// the ~1.5s budget.
const REVEAL_MS = 450
const HOLD_MS = 300
const FADE_OUT_MS = 400

/**
 * Purely a visual overlay drawn on top of the real navigation stack — it
 * never gates routing or auth. `pointerEvents="none"` means a tap during
 * the reveal passes straight through to the screen underneath instead of
 * being swallowed, so an impatient factory-floor tap never feels "blocked".
 */
function LaunchReveal({ onDone }: { onDone: () => void }) {
  const logoOpacity = useSharedValue(0)
  const logoScale = useSharedValue(0.85)
  const overlayOpacity = useSharedValue(1)

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: REVEAL_MS, easing: Easing.out(Easing.cubic) })
    logoScale.value = withTiming(1, { duration: REVEAL_MS, easing: Easing.out(Easing.cubic) })
    overlayOpacity.value = withDelay(
      REVEAL_MS + HOLD_MS,
      withTiming(0, { duration: FADE_OUT_MS }, (finished) => {
        if (finished) runOnJS(onDone)()
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }))
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, styles.overlay, overlayStyle]}
    >
      <Animated.View style={logoStyle}>
        <BrandLogo size="lg" />
      </Animated.View>
    </Animated.View>
  )
}

export default function RootLayout() {
  const [showReveal, setShowReveal] = useState(true)

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(worker)" />
        <Stack.Screen name="(supervisor)" />
        <Stack.Screen name="(manager)" />
        <Stack.Screen name="(plant-head)" />
        <Stack.Screen name="(hr-admin)" />
        <Stack.Screen name="(owner)" />
        <Stack.Screen name="(security)" />
      </Stack>
      <StatusBar style="dark" />
      {showReveal && <LaunchReveal onDone={() => setShowReveal(false)} />}
    </>
  )
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 999,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
