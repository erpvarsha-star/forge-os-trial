import { useEffect, useState } from 'react'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'

const RELEASE_API = 'https://api.github.com/repos/erpvarsha-star/forge-os-trial/releases/latest'
const CACHE_KEY = 'appVersion.lastResult'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6h

export interface AppVersionState {
  /** Build number of the installed APK (CI stamps this = the apk-<n> tag). */
  currentBuild: number | null
  /** Build number of the newest published release, once known. */
  latestBuild: number | null
  /** True only when we positively know a newer build exists. */
  isUpdateAvailable: boolean
  /** True while the first check is in flight. */
  isChecking: boolean
  /** True when the check could not complete (offline, rate-limited). */
  checkFailed: boolean
}

/**
 * Installed build number.
 *
 * app.json's `version` ("1.0.0") is hand-maintained and does not move between
 * builds, so it cannot identify which APK someone is running. The build number
 * is Android's versionCode, which .github/workflows/build-apk.yml stamps with
 * the CI run number so it matches the `apk-<n>` release tag exactly.
 *
 * nativeBuildVersion is read from the actual installed binary, so it is
 * preferred over expoConfig (which reflects the bundled manifest).
 */
function readCurrentBuild(): number | null {
  const native = Number(Constants.nativeBuildVersion)
  if (Number.isFinite(native) && native > 0) return native

  const fromConfig = Number(Constants.expoConfig?.android?.versionCode)
  if (Number.isFinite(fromConfig) && fromConfig > 0) return fromConfig

  return null
}

/**
 * Shared version state for the update banner and the "Download Latest App" row,
 * so both agree and only one network check happens per app launch.
 *
 * Never throws and never blocks: the factory has patchy signal, and a failed
 * version check must degrade to "we don't know" rather than breaking a screen.
 */
export function useAppVersion(): AppVersionState {
  const [state, setState] = useState<AppVersionState>({
    currentBuild: readCurrentBuild(),
    latestBuild: null,
    isUpdateAvailable: false,
    isChecking: true,
    checkFailed: false,
  })

  useEffect(() => {
    let cancelled = false

    const finish = (latestBuild: number | null, failed: boolean) => {
      if (cancelled) return
      setState(prev => ({
        ...prev,
        latestBuild,
        // Only claim an update exists when BOTH numbers are known and the
        // remote one is genuinely higher. Unknown must never render as
        // "update available", or every launch nags with a guess.
        isUpdateAvailable:
          prev.currentBuild !== null && latestBuild !== null && latestBuild > prev.currentBuild,
        isChecking: false,
        checkFailed: failed,
      }))
    }

    const run = async () => {
      try {
        const cachedRaw = await AsyncStorage.getItem(CACHE_KEY)
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as { at: number; latestBuild: number }
          if (Date.now() - cached.at < CACHE_TTL_MS) {
            finish(cached.latestBuild, false)
            return
          }
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const res = await fetch(RELEASE_API, {
          headers: { Accept: 'application/vnd.github+json' },
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!res.ok) { finish(null, true); return }

        const json = await res.json()
        const tag: string | undefined = json?.tag_name
        const latestBuild = tag ? parseInt(tag.replace(/\D/g, ''), 10) : NaN
        if (!Number.isFinite(latestBuild)) { finish(null, true); return }

        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), latestBuild }))
        finish(latestBuild, false)
      } catch {
        finish(null, true)
      }
    }

    run()
    return () => { cancelled = true }
  }, [])

  return state
}
