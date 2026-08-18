import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Badge } from "@capawesome/capacitor-badge";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

// نفس المعرّف المستخدم في AndroidManifest.xml
// (com.google.firebase.messaging.default_notification_channel_id)
const CHANNEL_ID = "engagement_channel";

let badgeCount = 0;

export function useAndroidPush() {
  const { user } = useAuth();

  useEffect(() => {
    // هذا الشرط يخلي كل ما يلي يشتغل على أندرويد (Capacitor native) فقط.
    if (typeof window === "undefined" || !user || !Capacitor.isNativePlatform()) return;

    const initPush = async () => {
      try {
        // 1) قناة إشعارات أندرويد بصوت + اهتزاز + أولوية عالية (heads-up)
        //    متل تطبيقات عالمية. نفس القناة تُستخدم تلقائياً من Firebase
        //    للإشعارات اللي توصل والتطبيق بالخلفية/مقفول، ومن LocalNotifications
        //    يدوياً وقت التطبيق مفتوح (foreground).
        await LocalNotifications.createChannel({
          id: CHANNEL_ID,
          name: "إشعارات English Hub",
          description: "تنبيهات الدروس والواجبات والرسائل",
          importance: 5, // IMPORTANCE_HIGH -> heads-up + صوت
          visibility: 1, // عام (يظهر على شاشة القفل)
          sound: "default",
          vibration: true,
          lights: true,
        });

        // 2) صلاحية الإشعارات
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === "prompt") {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== "granted") {
          console.warn("User denied push notifications permission!");
          return;
        }
        await LocalNotifications.requestPermissions();

        await PushNotifications.register();

        // 3) حفظ رمز الجهاز بملف المستخدم لإرسال إشعارات مستهدفة له لاحقاً
        PushNotifications.addListener("registration", async (token) => {
          try {
            await updateDoc(doc(db, "profiles", user.uid), {
              fcmTokens: arrayUnion(token.value),
            });
          } catch (e) {
            console.error("Error saving mobile push token:", e);
          }
        });

        PushNotifications.addListener("registrationError", (error) => {
          console.error("Push registration error: ", error);
        });

        // 4) عندما يوصل إشعار والتطبيق مفتوح (foreground)، أندرويد لا يعرضه
        //    تلقائياً كإشعار نظام — نعرضه يدوياً هون بنفس القناة (صوت +
        //    اهتزاز + أيقونة)، بالإضافة لتحديث رقم الشارة على الأيقونة.
        PushNotifications.addListener("pushNotificationReceived", async (notification) => {
          try {
            badgeCount += 1;
            await Badge.set({ count: badgeCount });

            await LocalNotifications.schedule({
              notifications: [
                {
                  id: Date.now() % 2147483647,
                  channelId: CHANNEL_ID,
                  title: notification.title || "English Hub",
                  body: notification.body || "",
                  smallIcon: "ic_stat_notify",
                  iconColor: "#0A5968",
                  sound: "default",
                  extra: notification.data,
                },
              ],
            });
          } catch (e) {
            console.error("Error showing foreground notification:", e);
          }
        });

        // 5) عند الضغط على الإشعار: تصفير الشارة
        PushNotifications.addListener("pushNotificationActionPerformed", async () => {
          badgeCount = 0;
          try {
            await Badge.clear();
          } catch (e) {
            console.error("Error clearing badge:", e);
          }
        });

        // تصفير الشارة أيضاً عند فتح التطبيق عادةً
        badgeCount = 0;
        await Badge.clear();
      } catch (e) {
        console.log("Capacitor Push not active (unexpected on native):", e);
      }
    };

    initPush();
  }, [user]);
}
