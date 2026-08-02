import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync(userId: string) {
  if (!Device.isDevice) return;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  });
  const token = tokenData.data;
  await supabase.from("push_tokens").upsert({
    user_id: userId, token, platform: Platform.OS,
    updated_at: new Date().toISOString(),
  });
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "default", importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250], lightColor: "#E65C00",
    });
  }
  return token;
}

export function setupNotificationListeners(
  onReceive: (n: Notifications.Notification) => void,
  onResponse: (r: Notifications.NotificationResponse) => void
) {
  const s1 = Notifications.addNotificationReceivedListener(onReceive);
  const s2 = Notifications.addNotificationResponseReceivedListener(onResponse);
  return () => { s1.remove(); s2.remove(); };
}

export type NotificationType =
  | "LEAVE_APPROVED" | "LEAVE_REJECTED" | "ADVANCE_APPROVED" | "ADVANCE_REJECTED"
  | "TASK_ASSIGNED" | "TASK_OVERDUE" | "SHIFT_REMINDER" | "5S_CHALLENGE"
  | "5S_VERIFIED" | "FRAUD_ALERT" | "MRM_REMINDER" | "SCORE_UPDATED";

/**
 * Sends an Expo push notification to every employee holding `role`, using
 * whatever device tokens they've registered in `push_tokens`. Used for
 * server-less alerts (e.g. fraud detection) where there's no backend
 * process to fan the notification out from.
 */
export async function notifyEmployeesByRole(role: string, title: string, body: string, data?: Record<string, any>) {
  const { data: recipients } = await supabase.from("employees").select("id").eq("role", role).eq("is_active", true);
  const recipientIds = (recipients ?? []).map((r: { id: string }) => r.id);
  if (recipientIds.length === 0) return;

  const { data: tokens } = await supabase.from("push_tokens").select("token").in("user_id", recipientIds);
  const messages = (tokens ?? [])
    .filter((t: { token: string }) => !!t.token)
    .map((t: { token: string }) => ({ to: t.token, sound: "default", title, body, data: data ?? {} }));
  if (messages.length === 0) return;

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error("notifyEmployeesByRole push failed", err);
  }
}