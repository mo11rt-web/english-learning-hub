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

// ما نهيّئ Firebase إلا داخل المتصفح فعلياً (typeof window !== "undefined").
// هيك الـ build ما بينكسر أبداً حتى لو Next.js حاول يولّد أي صفحة (بما فيها
// /_not-found أو صفحات dynamic زي /share/[token]) وقت الـ build على السيرفر.
function createFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (!firebaseConfig.apiKey) {
    // eslint-disable-next-line no-console
    console.error("[firebase] متغيرات NEXT_PUBLIC_FIREBASE_* غير موجودة بالمتصفح.");
    return null;
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export const app: FirebaseApp | null = createFirebaseApp();
export const auth = (app ? getAuth(app) : null) as Auth;
export const db = (app ? getFirestore(app) : null) as Firestore;
export const storage = (app ? getStorage(app) : null) as FirebaseStorage;
