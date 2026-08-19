import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getMessaging as getAdminMessaging } from "firebase-admin/messaging";

// ⚠️ هاد الملف Server-only — ما يجوز يتاستورد أبداً من أي ملف فيه "use client".
// بيستخدم مفاتيح حساب خدمة Firebase (Service Account) يلي لازم تكون محطوطة
// بمتغيرات بيئة سرّية (بدون NEXT_PUBLIC_) على Vercel:
//   FIREBASE_ADMIN_PROJECT_ID
//   FIREBASE_ADMIN_CLIENT_EMAIL
//   FIREBASE_ADMIN_PRIVATE_KEY

function getAdminApp(): App {
  const apps = getApps();
  if (apps.length) return apps[0];

  const serviceAccountJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
  let serviceAccount: { project_id?: string; client_email?: string; private_key?: string } = {};
  if (serviceAccountJson || serviceAccountBase64) {
    try {
      const source = serviceAccountJson
        ? serviceAccountJson.trim().replace(/^["']([\\s\\S]*)["']$/, "$1")
        : Buffer.from(serviceAccountBase64!.trim().replace(/^["']|["']$/g, ""), "base64").toString("utf8");
      serviceAccount = JSON.parse(source);
    } catch {
      throw new Error("قيمة حساب خدمة Firebase JSON/BASE64 غير صالحة.");
    }
  }

  const projectId =
    serviceAccount.project_id ||
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const rawClientEmail =
    serviceAccount.client_email ||
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    process.env.FIREBASE_CLIENT_EMAIL;
  const clientEmail = rawClientEmail?.trim().replace(/^["']|["']$/g, "");

  const rawPrivateKey =
    serviceAccount.private_key ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    process.env.FIREBASE_PRIVATE_KEY;
  const encodedPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64 || process.env.FIREBASE_PRIVATE_KEY_BASE64;
  const privateKey = encodedPrivateKey
    ? Buffer.from(encodedPrivateKey.trim().replace(/^["']|["']$/g, ""), "base64").toString("utf8")
    : rawPrivateKey
      ?.trim()
      .replace(/^["']([\\s\\S]*)["']$/, "$1")
      .replace(/\\n/g, "\n");

  const missing = [
    !projectId ? "project_id" : null,
    !clientEmail ? "client_email" : null,
    !privateKey ? "private_key" : null,
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `متغيرات حساب خدمة Firebase غير مكتملة: ${missing.join(", ")}. استخدم FIREBASE_SERVICE_ACCOUNT_JSON أو FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY.`
    );
  }

  return initializeApp({
    credential: cert({ projectId: projectId!, clientEmail: clientEmail!, privateKey: privateKey! }),
  });
}

export function adminAuth() {
  return getAdminAuth(getAdminApp());
}

export function adminDb() {
  return getAdminFirestore(getAdminApp());
}

// إرسال Push حقيقي عبر FCM من سيرفر Vercel نفسه (بدون Firebase Cloud
// Functions وبدون خطة Blaze — هاي مجرد استدعاء API عادي بصلاحية حساب
// الخدمة، تمامًا متل أي استدعاء Auth/Firestore تاني بهاد الملف).
export function adminMessaging() {
  return getAdminMessaging(getAdminApp());
}
