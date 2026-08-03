import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Employee } from '@/types'

export function useLanguage(employee?: Employee | null) {
  const { i18n } = useTranslation()

  useEffect(() => {
    const init = async () => {
      if (employee?.language_preference) {
        await i18n.changeLanguage(employee.language_preference)
      } else {
        const saved = await AsyncStorage.getItem('app_language')
        if (saved) await i18n.changeLanguage(saved)
      }
    }
    init()
  }, [employee])

  const toggleLanguage = async () => {
    const next = i18n.language === 'en' ? 'hi' : 'en'
    await i18n.changeLanguage(next)
    await AsyncStorage.setItem('app_language', next)
  }

  return { language: i18n.language, toggleLanguage }
}
