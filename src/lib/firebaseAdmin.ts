import admin from "firebase-admin";

// ⚠️ هاد الملف سيرفر بس (API routes) — ما لازم يتستورد من أي مكون
// "use client". بيستخدم نفس متغيرات FIREBASE_ADMIN_* الموجودة أصلاً
// بـ .env.example (كانت تُستخدم لسكربت seed فقط، هلق منستخدمها هون كمان)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
