"use client";

import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { messaging, VAPID_KEY, db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !messaging || typeof window === "undefined" || !("Notification" in window)) return;
    const msg = messaging;

    const requestPermissionAndGetToken = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const token = await getToken(msg, { vapidKey: VAPID_KEY });
          if (token) {
            await updateDoc(doc(db, "profiles", user.uid), {
              fcmTokens: arrayUnion(token),
            });
          }
        }
      } catch (error) {
        console.error("FCM Token error:", error);
      }
    };

    requestPermissionAndGetToken();

    const unsubscribe = onMessage(msg, (payload) => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(payload.notification?.title || "إشعار جديد", {
          body: payload.notification?.body || "",
          icon: "/favicon.ico",
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user]);
}
