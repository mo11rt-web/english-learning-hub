"use client";

/**
 * src/lib/runtimeConfig.ts
 * ------------------------------------------------------------------
 * تطبيق أندرويد (Capacitor) مبني static export بالكامل — لا يوجد فيه
 * مجلد /api أبداً. أي طلب كان يذهب لـ /api/... لازم يذهب بدلاً منه لرابط
 * المشروع الرئيسي على Vercel (Web Repo)، عبر NEXT_PUBLIC_BASE_URL.
 *
 * "الشفاء الذاتي" (Self-Healing): بدل ما يبقى رابط الويب مثبّت جوّا الـ APK
 * للأبد (وأي تغيير له يحتاج بناء APK جديد ورفعه من جديد)، بيانياً نخزن آخر
 * رابط بمستند Firestore واحد: app_settings/config -> { baseUrl: "https://..." }
 * ونقرأه عند إقلاع التطبيق ونحفظه بـ localStorage. إذا تغيّر رابط Vercel
 * (دومين جديد مثلاً) يكفي تحديث هذا المستند بلوحة Firebase فقط، بدون أي
 * إعادة بناء أو نشر جديد للـ APK.
 * ------------------------------------------------------------------
 */
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const STORAGE_KEY = "eh_base_url";
const FALLBACK_BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

/** الرابط الحالي المعتمد لكل نداءات /api (من localStorage، وإلا env var كاحتياط) */
export function getBaseUrl(): string {
  if (typeof window === "undefined") return FALLBACK_BASE_URL;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return stored.replace(/\/+$/, "");
  } catch {
    // localStorage غير متاح (نادر) -> نكمل بالـ fallback
  }
  return FALLBACK_BASE_URL;
}

/** يبني رابط API كامل بدل المسار النسبي القديم "/api/..." */
export function apiUrl(path: string): string {
  const base = getBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (!base) {
    console.warn(
      "[runtimeConfig] لا يوجد NEXT_PUBLIC_BASE_URL ولا رابط محفوظ محلياً — طلبات API ستفشل حتماً.",
    );
    return cleanPath;
  }
  return `${base}${cleanPath}`;
}

/** بديل fetch() جاهز لاستدعاء الـ API على المشروع الرئيسي (Web Repo) */
export function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), options);
}

/**
 * يُستدعى مرة واحدة عند إقلاع التطبيق (من AppShell). يقرأ آخر رابط منشور من
 * Firestore ويحدّث localStorage بصمت — بدون ما يعطّل تحميل الشاشة (fire and
 * forget)، وبدون ما يكسر شي لو فشلت القراءة (offline مثلاً، بيستمر بآخر رابط
 * محفوظ محلياً أو بالـ env var الافتراضي).
 */
export async function refreshBaseUrlFromFirestore(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const snap = await getDoc(doc(db, "app_settings", "config"));
    const remote = snap.exists() ? (snap.data()?.baseUrl as string | undefined) : undefined;
    if (remote && /^https?:\/\/.+/.test(remote)) {
      window.localStorage.setItem(STORAGE_KEY, remote.replace(/\/+$/, ""));
    }
  } catch (err) {
    console.warn("[runtimeConfig] تعذّر تحديث baseUrl من Firestore، سنكمل بآخر قيمة معروفة:", err);
  }
}
