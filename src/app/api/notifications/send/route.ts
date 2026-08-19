import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminMessaging } from "@/lib/firebaseAdmin";

/**
 * src/app/api/notifications/send/route.ts
 * ------------------------------------------------------------------
 * يرسل Push حقيقي عبر Firebase Cloud Messaging لكل الأجهزة (Android +
 * متصفح ويب) المسجّلة لمستخدمين محددين. هذا Route عادي بمشروع Vercel —
 * ما بيحتاج Firebase Cloud Functions ولا خطة Blaze إطلاقًا، لأنه بس
 * بيستدعي Google Messaging API بصلاحية حساب خدمة (Service Account)
 * محطوطة بمتغيرات بيئة Vercel السرية (شوف src/lib/firebaseAdmin.ts).
 *
 * يُستدعى من notifyUsers() (src/lib/notifications.ts) بعد ما تنكتب
 * مستندات الإشعار بـ Firestore — إذا فشل الاستدعاء (لأي سبب: مستخدم بدون
 * توكن، شبكة، إلخ) ما بيكسر شي، لأن الإشعار داخل التطبيق أصلاً انكتب.
 * ------------------------------------------------------------------
 */

function getBearerToken(req: NextRequest) {
  const value = req.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}

export async function POST(req: NextRequest) {
  try {
    const idToken = getBearerToken(req);
    if (!idToken) return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });

    const auth = adminAuth();
    const db = adminDb();
    // نتحقق فقط إنه الطالب/المعلم صاحب الطلب مسجّل دخول وحسابه نشط —
    // أي مستخدم نشط (طالب أو معلم) يقدر يستدعي هذا المسار، لأن كلاهما
    // يرسل إشعارات (طالب يسأل معلم، معلم ينشر درس...). صلاحية *مين* يقرأ
    // *شو* مضبوطة أصلاً بقواعد Firestore على مجموعة notifications.
    const decoded = await auth.verifyIdToken(idToken);
    const callerSnap = await db.doc(`profiles/${decoded.uid}`).get();
    const callerData = callerSnap.data();
    if (!callerSnap.exists || callerData?.status !== "active") {
      return NextResponse.json({ error: "الحساب غير نشط." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const userIds: string[] = Array.isArray(body?.userIds)
      ? body.userIds.filter((v: unknown) => typeof v === "string")
      : [];
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const notifBody = typeof body?.body === "string" ? body.body.trim() : "";
    const link = typeof body?.link === "string" ? body.link : undefined;

    if (userIds.length === 0 || !title) {
      return NextResponse.json({ error: "userIds و title مطلوبان." }, { status: 400 });
    }
    // سقف أمان بسيط لمنع إساءة استخدام هذا الـ endpoint لبث ضخم غير مقصود
    const targets = Array.from(new Set(userIds)).slice(0, 500);

    // نجيب توكنات FCM (أندرويد + متصفح ويب) لكل المستخدمين المستهدفين
    const profileSnaps = await db.getAll(...targets.map((uid) => db.doc(`profiles/${uid}`)));
    const tokens: string[] = [];
    profileSnaps.forEach((snap) => {
      const data = snap.data();
      const list: string[] = Array.isArray(data?.fcmTokens) ? data.fcmTokens : [];
      tokens.push(...list);
    });
    const uniqueTokens = Array.from(new Set(tokens)).filter(Boolean);

    if (uniqueTokens.length === 0) {
      // مفيش توكنات مسجّلة (مثلاً المستخدم رفض صلاحية الإشعارات) — مش خطأ،
      // الإشعار داخل التطبيق (Firestore) وصل، بس ما في push فعلي ممكن.
      return NextResponse.json({ ok: true, sent: 0, note: "لا توجد أجهزة مسجّلة لاستقبال Push." });
    }

    const messaging = adminMessaging();
    const response = await messaging.sendEachForMulticast({
      tokens: uniqueTokens,
      notification: { title, body: notifBody || undefined },
      data: link ? { link } : undefined,
      android: { priority: "high" },
      webpush: { fcmOptions: link ? { link } : undefined },
    });

    // تنظيف التوكنات الميتة (تطبيق محذوف/صلاحية ملغاة) حتى ما نضل نحاول نبعتلها من جديد كل مرة
    const deadTokens: string[] = [];
    response.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || "";
        if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
          deadTokens.push(uniqueTokens[i]);
        }
      }
    });
    if (deadTokens.length > 0) {
      await Promise.all(
        profileSnaps
          .filter((snap) => {
            const list: string[] = Array.isArray(snap.data()?.fcmTokens) ? snap.data()!.fcmTokens : [];
            return list.some((t) => deadTokens.includes(t));
          })
          .map((snap) => {
            const list: string[] = snap.data()?.fcmTokens ?? [];
            return snap.ref.update({ fcmTokens: list.filter((t) => !deadTokens.includes(t)) });
          })
      ).catch(() => {
        // تنظيف اختياري — فشله ما يعطّل الاستجابة
      });
    }

    return NextResponse.json({ ok: true, sent: response.successCount, failed: response.failureCount });
  } catch (err: any) {
    console.error("[notifications/send] error:", err);
    const status =
      err?.code === "auth/id-token-expired" ||
      err?.code === "auth/invalid-id-token" ||
      err?.code === "auth/argument-error"
        ? 401
        : 500;
    return NextResponse.json({ error: "تعذّر إرسال الإشعار." }, { status });
  }
}

export const runtime = "nodejs";
