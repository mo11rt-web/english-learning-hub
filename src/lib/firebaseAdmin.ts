import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

// ⚠️ هاد الملف Server-only — ما يجوز يتاستورد أبداً من أي ملف فيه "use client".
// بيستخدم مفاتيح حساب خدمة Firebase (Service Account) يلي لازم تكون محطوطة
// بمتغيرات بيئة سرّية (بدون NEXT_PUBLIC_) على Vercel:
//   FIREBASE_ADMIN_PROJECT_ID
//   FIREBASE_ADMIN_CLIENT_EMAIL
//   FIREBASE_ADMIN_PRIVATE_KEY

function getAdminApp(): App {
  const apps = getApps();
  if (apps.length) return apps[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // مفتاح Firebase الخاص عادة بيجي بأسطر جديدة مكتوبة \n حرفياً بمتغيرات
  // البيئة، لازم نحوّلها لأسطر جديدة فعلية.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "متغيرات حساب خدمة Firebase غير موجودة (FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY)."
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function adminAuth() {
  return getAdminAuth(getAdminApp());
}

export function adminDb() {
  return getAdminFirestore(getAdminApp());
}
