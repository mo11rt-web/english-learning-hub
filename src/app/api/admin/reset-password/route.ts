import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

// يغيّر كلمة مرور طالب من جلسة معلم/مدير — هاي العملية الوحيدة اللي محتاجة
// صلاحيات Admin SDK (المتصفح ما بيقدر يغيّر كلمة سر حساب مش حسابه). الأمان
// هون قائم على التحقق من idToken الحقيقي للمعلم + التأكد من دوره بـ Firestore،
// مش بس الثقة بالبيانات المرسلة من المتصفح.
export async function POST(req: NextRequest) {
  try {
    const { idToken, targetUid, newPassword } = await req.json();

    if (!idToken || !targetUid || !newPassword) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }
    if (String(newPassword).length < 6) {
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
    if (!decoded) {
      return NextResponse.json({ error: "جلستك غير صالحة، سجّل الدخول من جديد" }, { status: 401 });
    }

    const callerSnap = await adminDb.collection("profiles").doc(decoded.uid).get();
    const callerRole = callerSnap.data()?.role;
    if (callerRole !== "teacher" && callerRole !== "admin") {
      return NextResponse.json({ error: "هذه العملية للمعلمين فقط" }, { status: 403 });
    }

    // لازم نتأكد إنه الهدف طالب فعلاً (وليس مثلاً معلم ثاني)، حتى معلم واحد
    // ما يقدر يغيّر كلمة سر معلم/مدير آخر من هالمسار
    const targetSnap = await adminDb.collection("profiles").doc(targetUid).get();
    if (!targetSnap.exists || targetSnap.data()?.role !== "student") {
      return NextResponse.json({ error: "الحساب المستهدف غير موجود أو ليس حساب طالب" }, { status: 404 });
    }

    await adminAuth.updateUser(targetUid, { password: newPassword });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("reset-password failed:", err);
    return NextResponse.json({ error: err?.message ?? "خطأ غير متوقع" }, { status: 500 });
  }
}
