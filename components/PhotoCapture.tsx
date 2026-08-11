import React, { useRef, useState } from 'react'
import { View, Text, Modal, TouchableOpacity, Image, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Camera as CameraIcon, RefreshCw, Check, X } from 'lucide-react-native'
import { Button } from '@/components/Button'
import { BRAND, INK } from '@/components/theme'

interface PhotoCaptureProps {
  /** Called with the captured photo as base64 (no data: prefix). */
  onCaptured: (base64: string) => void
  /** Existing preview, if a photo has already been taken/uploaded. */
  previewUri?: string | null
  label?: string
  disabled?: boolean
}

/**
 * Camera capture for 5S submissions and maintenance observations.
 *
 * Replaces the previous stub, which requested camera permission and then wrote
 * a hardcoded 'https://placeholder.com/...' string into photo_url without ever
 * opening a camera — so supervisors reviewing submissions only ever saw a
 * broken image.
 *
 * Uses expo-camera 15's `CameraView` + `useCameraPermissions`. The legacy
 * `Camera` class the old code imported still exists in this version but only
 * for its static permission helpers; it cannot render a preview.
 *
 * Captures at `quality: 0.5` with base64 — these are uploaded over mobile data
 * from the shop floor, and the bucket caps files at 5 MB.
 */
export function PhotoCapture({ onCaptured, previewUri, label, disabled }: PhotoCaptureProps) {
  const { t } = useTranslation()
  const [permission, requestPermission] = useCameraPermissions()
  const [isOpen, setIsOpen] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const cameraRef = useRef<CameraView>(null)

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission()
      if (!result.granted) return
    }
    setIsOpen(true)
  }

  const capture = async () => {
    if (!cameraRef.current || isCapturing) return
    setIsCapturing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5, base64: true })
      if (photo?.base64) onCaptured(photo.base64)
      setIsOpen(false)
    } catch {
      // Swallow: a failed capture must not crash the submission screen. The
      // user simply sees the camera stay open and can retry.
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <>
      {previewUri ? (
        <View className="mb-3">
          <Image source={{ uri: previewUri }} className="w-full h-48 rounded-lg" resizeMode="cover" />
          <TouchableOpacity onPress={openCamera} disabled={disabled} className="mt-2 flex-row items-center gap-2 min-h-touch">
            <RefreshCw size={16} color={BRAND[600]} />
            <Text className="text-sm text-brand-600 font-semibold">{t('worker.retake')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Button
          title={label ?? 'worker.takePhoto'}
          onPress={openCamera}
          variant="outline"
          disabled={disabled}
          className="mb-3"
          icon={<CameraIcon size={18} color={BRAND[600]} />}
        />
      )}

      {/* Permission permanently denied — tell them where to fix it rather than
          silently doing nothing when the button is tapped. */}
      {permission && !permission.granted && !permission.canAskAgain && (
        <Text className="text-xs text-red-600 mb-3">{t('worker.cameraPermissionRequired')}</Text>
      )}

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View className="flex-1 bg-black">
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

          <View className="absolute top-0 left-0 right-0 p-4">
            <TouchableOpacity
              onPress={() => setIsOpen(false)}
              className="w-11 h-11 rounded-full bg-black/60 items-center justify-center"
            >
              <X size={22} color="white" />
            </TouchableOpacity>
          </View>

          <View className="absolute bottom-0 left-0 right-0 items-center pb-10">
            <TouchableOpacity
              onPress={capture}
              disabled={isCapturing}
              className="w-20 h-20 rounded-full bg-white items-center justify-center border-4 border-ink-300"
            >
              {isCapturing ? <ActivityIndicator color={INK[700]} /> : <Check size={30} color={INK[800]} />}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
}
