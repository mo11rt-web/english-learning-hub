import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

export function useAndroidPush() {
  const { user } = useAuth();

  useEffect(() => {
    // هذا الـ hook مخصص فقط لتطبيق أندرويد (Capacitor Native). على موقع
    // الويب العادي (متصفح)، إشعارات الويب متكفّلة فيها usePushNotifications.ts
    // (Firebase Web Push مع VAPID Key). بدون هذا الفحص، كان أي زائر لموقع
    // الويب يشغّل مكتبة Capacitor Push بلا أي بريدج حقيقي — بلا فايدة،
    // ويحتمل يطلب صلاحية إشعارات غير متوقعة/مزدوجة.
    if (typeof window === "undefined" || !user || !Capacitor.isNativePlatform()) return;

    const initPush = async () => {
      try {
        // طلب إذن الإشعارات عند فتح التطبيق لأول مرة
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === "prompt") {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== "granted") {
          console.warn("User denied push notifications permission!");
          return;
        }

        await PushNotifications.register();

        // الاستماع لنجاح التسجيل وحفظ الرمز في ملف الطالب
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

        PushNotifications.addListener("pushNotificationReceived", (notification) => {
          // يمكن عرض تنبيه داخلي أو تشغيل صوت إضافي هنا
          console.log("Push received: ", notification);
        });

      } catch (e) {
        // في بيئة المتصفح العادية، ستتخطى المكتبة الأخطاء بسلاسة
        console.log("Capacitor Push not active in standard browser mode");
      }
    };

    initPush();
  }, [user]);
}
