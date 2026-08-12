import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { normalizePhone, phoneToEmail } from "@/lib/phone";

// بدون هاد التزامن، تغيير رقم هاتف الطالب بـ Firestore بس (بدون تحديث بريد
// الدخول بـ Firebase Auth) بيخلي تسجيل الدخول بالرقم الجديد يفشل للأبد —
// الحساب بضل مربوط بالرقم القديم بجانب Auth مهما تغيّر برقم الطالب بالواجهة
export async function POST(req: NextRequest) {
  try {
    const { idToken, targetUid, newPhone } = await req.json();
    if (!idToken || !targetUid || !newPhone) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
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

    const targetSnap = await adminDb.collection("profiles").doc(targetUid).get();
    if (!targetSnap.exists || targetSnap.data()?.role !== "student") {
      return NextResponse.json({ error: "الحساب المستهدف غير موجود أو ليس حساب طالب" }, { status: 404 });
    }

    const phone = normalizePhone(newPhone);
    const newEmail = phoneToEmail(phone, "student");
    await adminAuth.updateUser(targetUid, { email: newEmail });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("update-login-email failed:", err);
    const msg =
      err?.code === "auth/email-already-exists"
        ? "رقم الهاتف هذا مستخدم بالفعل لحساب طالب آخر"
        : err?.message ?? "خطأ غير متوقع";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
