import React, { useEffect, useState } from 'react'
import { View, Image, ActivityIndicator } from 'react-native'
import { ImageOff } from 'lucide-react-native'
import { getSignedPhotoUrl } from '@/lib/photos'
import { INK } from '@/components/theme'

interface SignedImageProps {
  /** A storage path from photo_url (or a legacy absolute URL). */
  path: string | null | undefined
  className?: string
}

/**
 * Renders a photo held in the private `submission-photos` bucket.
 *
 * The bucket is private (see PATCH_13), so `photo_url` holds a storage path
 * rather than a URL and has to be exchanged for a short-lived signed URL
 * before it can be displayed.
 *
 * Rows created before the camera was wired up hold the literal string
 * 'https://placeholder.com/...'. getSignedPhotoUrl passes absolute URLs through
 * untouched, so those legacy rows render as a broken image and fall through to
 * the placeholder below rather than erroring.
 */
export function SignedImage({ path, className = 'w-full h-48 rounded-lg' }: SignedImageProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    let cancelled = false

    const resolve = async () => {
      if (!path) {
        setState('missing')
        return
      }
      const signed = await getSignedPhotoUrl(path)
      // The screen may have moved on while the signing round-trip was in
      // flight; setting state after unmount warns and leaks.
      if (cancelled) return
      setUrl(signed)
      setState(signed ? 'ready' : 'missing')
    }

    resolve()
    return () => { cancelled = true }
  }, [path])

  if (state === 'loading') {
    return (
      <View className={`${className} bg-ink-100 items-center justify-center`}>
        <ActivityIndicator color={INK[400]} />
      </View>
    )
  }

  if (state === 'missing' || !url) {
    return (
      <View className={`${className} bg-ink-100 items-center justify-center`}>
        <ImageOff size={28} color={INK[300]} />
      </View>
    )
  }

  return <Image source={{ uri: url }} className={className} resizeMode="cover" onError={() => setState('missing')} />
}
