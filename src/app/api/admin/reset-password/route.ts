import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

function getBearerToken(req: NextRequest) {
  const value = req.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}

function errorMessage(err: any) {
  if (typeof err?.message === "string" && err.message.includes("متغيرات حساب خدمة Firebase")) {
    return "إعدادات Firebase Admin غير مكتملة على الخادم.";
  }
  if (err?.code === "auth/user-not-found") return "حساب الطالب غير موجود في Firebase Authentication.";
  if (err?.code === "auth/invalid-password") return "كلمة المرور غير صالحة.";
  if (err?.code === "auth/id-token-expired") return "انتهت صلاحية جلستك، سجّل الدخول من جديد.";
  if (err?.code === "auth/invalid-id-token" || err?.code === "auth/argument-error") {
    return "جلسة الدخول غير صالحة، سجّل الدخول من جديد.";
  }
  return "حدث خطأ أثناء تغيير كلمة المرور.";
}

export async function POST(req: NextRequest) {
  try {
    const idToken = getBearerToken(req);
    if (!idToken) return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });

    const auth = adminAuth();
    const db = adminDb();
    const decoded = await auth.verifyIdToken(idToken);
    const callerSnap = await db.doc(`profiles/${decoded.uid}`).get();
    const callerRole = callerSnap.exists ? callerSnap.data()?.role : null;
    if (callerRole !== "teacher" && callerRole !== "admin") {
      return NextResponse.json({ error: "غير مصرح — هذه الميزة للمعلم/المدير فقط." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const uid = typeof body?.uid === "string" ? body.uid.trim() : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    if (!uid || !newPassword) {
      return NextResponse.json({ error: "معرّف الطالب وكلمة المرور مطلوبان." }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف/أرقام على الأقل." }, { status: 400 });
    }
    if (uid === decoded.uid) {
      return NextResponse.json({ error: "استخدم إعدادات حسابك لتغيير كلمة مرورك أنت." }, { status: 400 });
    }

    const targetSnap = await db.doc(`profiles/${uid}`).get();
    if (!targetSnap.exists) {
      return NextResponse.json({ error: "ملف الطالب غير موجود." }, { status: 404 });
    }
    if (targetSnap.data()?.role !== "student") {
      return NextResponse.json({ error: "يمكن تغيير كلمات مرور الطلاب فقط من هذه الصفحة." }, { status: 400 });
    }

    await auth.updateUser(uid, { password: newPassword });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[reset-password] error:", err);
    const status =
      err?.code === "auth/id-token-expired" ||
      err?.code === "auth/invalid-id-token" ||
      err?.code === "auth/argument-error"
        ? 401
        : err?.code === "auth/user-not-found"
          ? 404
          : 500;
    return NextResponse.json({ error: errorMessage(err) }, { status });
  }
}

export const runtime = "nodejs";
