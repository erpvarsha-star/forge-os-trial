import { useState } from "react";
import { View, Text, Image, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { SafeView } from "@/components/SafeView";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Loading } from "@/components/Loading";
import { useAuth } from "@/hooks/useAuth";
import { APP_CONFIG } from "@/lib/config";

export default function LoginScreen() {
  const { t } = useTranslation();
  const { loginWithPhone, verifyOtp, getRoleRoute } = useAuth();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  const handleSendOtp = async () => {
    if (phone.length !== 10) { setError("Enter 10 digit number"); return; }
    setLoading(true); setError("");
    const { error } = await loginWithPhone(phone);
    setLoading(false);
    if (error) setError(error.message);
    else { setStep("otp"); startCountdown(); }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { setError("Enter 6-digit OTP"); return; }
    setLoading(true); setError("");
    const { error, employee } = await verifyOtp(phone, otp);
    setLoading(false);
    if (error) {
      if (error.message.includes("not registered")) setError(t("auth.notRegistered"));
      else setError(t("auth.invalidOtp"));
    } else if (employee) {
      router.replace(getRoleRoute() as any);
    }
  };

  const startCountdown = () => {
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((prev) => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; });
    }, 1000);
  };

  const handleResend = async () => { if (countdown > 0) return; await handleSendOtp(); };

  if (loading && step === "phone") return <Loading />;

  return (
    <SafeView className="bg-white">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView className="flex-1 px-6 py-8" keyboardShouldPersistTaps="handled">
          <View className="items-center mt-12 mb-8">
            {APP_CONFIG.logoUrl ? (
              <Image source={{ uri: APP_CONFIG.logoUrl }} className="w-24 h-24 mb-4" resizeMode="contain" />
            ) : (
              <View className="w-24 h-24 bg-primary/10 rounded-full items-center justify-center mb-4">
                <Text className="text-primary text-3xl font-bold">F</Text>
              </View>
            )}
            <Text className="text-2xl font-bold text-gray-900 text-center">{APP_CONFIG.appName}</Text>
            <Text className="text-gray-500 text-center mt-1">{t("auth.welcome", { company: APP_CONFIG.companyName })}</Text>
          </View>

          {step === "phone" ? (
            <View>
              <Text className="text-lg font-semibold text-gray-800 mb-4">{t("auth.phoneLabel")}</Text>
              <View className="flex-row items-center border border-gray-300 rounded-lg bg-white mb-4">
                <View className="px-4 py-3 border-r border-gray-300"><Text className="text-gray-700 font-medium">+91</Text></View>
                <Input placeholder={t("auth.phonePlaceholder")} value={phone}
                  onChangeText={(t) => { setPhone(t.replace(/[^0-9]/g, "").slice(0, 10)); setError(""); }}
                  keyboardType="phone-pad" maxLength={10} className="flex-1 mb-0 border-0" />
              </View>
              {error ? <Text className="text-danger mb-4">{error}</Text> : null}
              <Button title={t("auth.sendOtp")} onPress={handleSendOtp} loading={loading} size="lg" />
            </View>
          ) : (
            <View>
              <Text className="text-lg font-semibold text-gray-800 mb-2">{t("auth.otpLabel")}</Text>
              <Text className="text-gray-500 mb-4">Sent to +91 {phone}</Text>
              <Input placeholder={t("auth.otpPlaceholder")} value={otp}
                onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, "").slice(0, 6)); setError(""); }}
                keyboardType="number-pad" maxLength={6} className="mb-4" />
              {error ? <Text className="text-danger mb-4">{error}</Text> : null}
              <Button title={t("auth.verifyOtp")} onPress={handleVerifyOtp} loading={loading} size="lg" className="mb-4" />
              <Button title={countdown > 0 ? `Resend in ${countdown}s` : t("auth.resendOtp")}
                onPress={handleResend} variant="outline" disabled={countdown > 0} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeView>
  );
}