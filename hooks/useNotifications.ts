import { useEffect } from "react";
import { useAuthStore } from "./useAuth";
import { registerForPushNotificationsAsync, setupNotificationListeners } from "@/lib/notifications";
import { router } from "expo-router";

export function useNotifications() {
  const { employee, isAuthenticated } = useAuthStore();
  useEffect(() => {
    if (!isAuthenticated || !employee) return;
    registerForPushNotificationsAsync(employee.id);
    const cleanup = setupNotificationListeners(
      (notification) => { console.log("Received:", notification); },
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.screen) router.push(data.screen);
      }
    );
    return cleanup;
  }, [isAuthenticated, employee]);
}

export async function sendLocalNotification(title: string, body: string, data?: Record<string, any>) {
  const { Notifications } = await import("expo-notifications");
  await Notifications.scheduleNotificationAsync({ content: { title, body, data: data || {} }, trigger: null });
}