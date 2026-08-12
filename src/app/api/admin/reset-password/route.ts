import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

// نقطة API آمنة لتغيير كلمة مرور أي طالب من لوحة تحكم المعلم/المدير —
// بضغطة زر، بدل الحل اليدوي القديم. الأمان هون بجزئين:
// 1) لازم Authorization: Bearer <idToken> صحيح.
// 2) لازم حساب صاحب التوكن يكون role = teacher أو admin بقاعدة البيانات
//    (نتحقق من Firestore نفسه، مش من أي شي قادم من المتصفح).
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });
    }

    const decoded = await adminAuth().verifyIdToken(idToken);
    const callerSnap = await adminDb().doc(`profiles/${decoded.uid}`).get();
    const callerRole = callerSnap.exists ? callerSnap.data()?.role : null;
    if (callerRole !== "teacher" && callerRole !== "admin") {
      return NextResponse.json(
        { error: "غير مصرح — هذه الميزة للمعلم/المدير فقط." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { uid, newPassword } = body as { uid?: string; newPassword?: string };
    if (!uid || !newPassword) {
      return NextResponse.json({ error: "بيانات ناقصة." }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "كلمة المرور يجب أن تكون 6 أحرف/أرقام على الأقل." },
        { status: 400 }
      );
    }

    await adminAuth().updateUser(uid, { password: newPassword });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[reset-password] error:", err);
    const message =
      err?.code === "auth/id-token-expired"
        ? "انتهت صلاحية جلستك، سجّل الدخول من جديد."
        : "حدث خطأ أثناء تغيير كلمة المرور.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
