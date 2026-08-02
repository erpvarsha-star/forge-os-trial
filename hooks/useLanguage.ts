import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

export function useLanguage() {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language;
  const isHindi = currentLanguage === "hi";
  const toggleLanguage = async () => {
    const newLang = isHindi ? "en" : "hi";
    await i18n.changeLanguage(newLang);
    await AsyncStorage.setItem("user-language", newLang);
  };
  const setLanguage = async (lang: "hi" | "en") => {
    await i18n.changeLanguage(lang);
    await AsyncStorage.setItem("user-language", lang);
  };
  return { currentLanguage, isHindi, toggleLanguage, setLanguage };
}