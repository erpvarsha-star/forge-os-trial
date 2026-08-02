import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import en from "../i18n/en.json";
import hi from "../i18n/hi.json";

const LANGUAGE_DETECTOR = {
  type: "languageDetector" as const,
  async: true,
  detect: async (callback: (lng: string) => void) => {
    const saved = await AsyncStorage.getItem("user-language");
    callback(saved || "hi");
  },
  init: () => {},
  cacheUserLanguage: async (lng: string) => {
    await AsyncStorage.setItem("user-language", lng);
  },
};

i18n.use(LANGUAGE_DETECTOR).use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  fallbackLng: "hi",
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;