import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { SafeView } from "@/components/SafeView";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useAuthStore } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { FileText, User, Bell, Globe, LogOut, ChevronRight } from "lucide-react-native";

export default function MoreScreen() {
  const { t, i18n } = useTranslation();
  const { employee, logout } = useAuthStore();
  const { toggleLanguage, isHindi } = useLanguage();
  const [showLangModal, setShowLangModal] = useState(false);

  const handleLogout = () => {
    Alert.alert(t("auth.logout"), t("auth.logoutConfirm"), [
      { text: t("app.cancel"), style: "cancel" },
      { text: t("app.confirm"), onPress: logout },
    ]);
  };

  const menuItems = [
    { icon: FileText, label: t("more.payslip"), action: () => router.push("/(worker)/payslip") },
    { icon: User, label: t("more.profile"), action: () => {} },
    { icon: Bell, label: t("more.notifications"), action: () => {} },
    { icon: Globe, label: `${t("more.language")}: ${isHindi ? t("more.hindi") : t("more.english")}`, action: () => setShowLangModal(true) },
    { icon: LogOut, label: t("auth.logout"), action: handleLogout, danger: true },
  ];

  return (
    <SafeView>
      <Header />
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-800 mb-4">{t("more.title")}</Text>

        {/* Profile Card */}
        <Card className="mb-4">
          <View className="flex-row items-center">
            <View className="w-16 h-16 bg-primary/10 rounded-full items-center justify-center mr-4">
              <Text className="text-primary text-2xl font-bold">{employee?.name?.charAt(0)}</Text>
            </View>
            <View>
              <Text className="text-lg font-bold text-gray-800">{employee?.name}</Text>
              <Text className="text-gray-500">{employee?.emp_code} • {employee?.department}</Text>
              <Text className="text-gray-400 text-sm capitalize">{employee?.role}</Text>
            </View>
          </View>
        </Card>

        {/* Menu Items */}
        {menuItems.map((item, idx) => (
          <TouchableOpacity key={idx} onPress={item.action} className="bg-white rounded-xl p-4 mx-2 mb-2 flex-row items-center shadow-sm border border-gray-100">
            <item.icon size={20} color={item.danger ? "#EF4444" : "#6B7280"} className="mr-3" />
            <Text className={`flex-1 text-gray-800 font-medium ${item.danger ? "text-danger" : ""}`}>{item.label}</Text>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Language Modal */}
      <Modal visible={showLangModal} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-xl p-6">
            <Text className="text-lg font-bold mb-4">{t("more.language")}</Text>
            <TouchableOpacity onPress={() => { toggleLanguage(); setShowLangModal(false); }} className="py-3 border-b border-gray-100">
              <Text className="text-gray-800">{isHindi ? "Switch to English" : "हिंदी में बदलें"}</Text>
            </TouchableOpacity>
            <Button title={t("app.close")} onPress={() => setShowLangModal(false)} variant="outline" className="mt-4" />
          </View>
        </View>
      </Modal>
    </SafeView>
  );
}