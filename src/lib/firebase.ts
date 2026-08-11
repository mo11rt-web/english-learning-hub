import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * مهم: هاي المنصة كلها صفحات client-side (لوحة تحكم + طالب) وبتعتمد على
 * تسجيل دخول حقيقي بالمتصفح. ما في أي داعي (ولا فايدة) نهيّئ Firebase وقت
 * الـ build على السيرفر (Netlify/Vercel) — وهاد بالضبط كان سبب خطأ
 * "auth/invalid-api-key": Next.js كان يحاول يجهّز الصفحات وقت الـ build
 * قبل ما تكون متغيرات البيئة (NEXT_PUBLIC_FIREBASE_*) موجودة، فـ Firebase
 * كان يرفض المفتاح الفارغ فوراً عند استدعاء getAuth().
 *
 * الحل: ما نهيّئ Firebase إلا داخل المتصفح فعلياً (typeof window !== "undefined")
 * وبعد التأكد إن المفتاح موجود. على السيرفر بترجع null بأمان بدون ما توقع الـ build.
 */
function createFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (!firebaseConfig.apiKey) {
    // eslint-disable-next-line no-console
    console.error(
      "[firebase] متغيرات البيئة NEXT_PUBLIC_FIREBASE_* غير موجودة. تأكد من إضافتها في إعدادات Netlify (Site settings > Environment variables) وليس فقط بملف .env.local."
    );
    return null;
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export const app: FirebaseApp | null = createFirebaseApp();
export const auth = (app ? getAuth(app) : null) as Auth;
export const db = (app ? getFirestore(app) : null) as Firestore;
export const storage = (app ? getStorage(app) : null) as FirebaseStorage;
