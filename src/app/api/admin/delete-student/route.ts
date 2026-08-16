import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import type { Firestore } from "firebase-admin/firestore";

const CLEANUP_QUERIES: { collection: string; field: string }[] = [
  { collection: "attempts", field: "studentId" },
  { collection: "lesson_progress", field: "studentId" },
  { collection: "notifications", field: "userId" },
  { collection: "shares", field: "studentId" },
];

function errorMessage(err: any) {
  if (err?.code === "auth/id-token-expired") return "انتهت صلاحية جلستك، سجّل الدخول من جديد.";
  if (err?.code === "auth/argument-error" || err?.code === "auth/invalid-id-token") {
    return "جلسة الدخول غير صالحة، سجّل الدخول من جديد.";
  }
  if (typeof err?.message === "string" && err.message.includes("متغيرات حساب خدمة Firebase")) {
    return "إعدادات Firebase Admin غير مكتملة على الخادم.";
  }
  return "حدث خطأ أثناء الحذف النهائي.";
}

async function deleteMatchingDocuments(
  db: Firestore,
  collectionName: string,
  field: string,
  value: string
) {
  const snapshot = await db.collection(collectionName).where(field, "==", value).get();
  if (snapshot.empty) return;

  let batch = db.batch();
  let count = 0;
  for (const item of snapshot.docs) {
    batch.delete(item.ref);
    count += 1;
    if (count === 450) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });
    }

    const auth = adminAuth();
    const db = adminDb();
    const decoded = await auth.verifyIdToken(idToken);
    const callerSnap = await db.doc(`profiles/${decoded.uid}`).get();
    const callerRole = callerSnap.exists ? callerSnap.data()?.role : null;
    if (callerRole !== "teacher" && callerRole !== "admin") {
      return NextResponse.json(
        { error: "غير مصرح — هذه الميزة للمعلم/المدير فقط." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const uid = typeof body?.uid === "string" ? body.uid.trim() : "";
    if (!uid) {
      return NextResponse.json({ error: "معرّف الطالب مطلوب." }, { status: 400 });
    }
    if (uid === decoded.uid) {
      return NextResponse.json({ error: "لا يمكن حذف حسابك الحالي من هذه الصفحة." }, { status: 400 });
    }

    const targetRef = db.doc(`profiles/${uid}`);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      return NextResponse.json({ error: "ملف الطالب غير موجود." }, { status: 404 });
    }
    if (targetSnap.data()?.role !== "student") {
      return NextResponse.json({ error: "يمكن حذف حسابات الطلاب فقط." }, { status: 400 });
    }

    try {
      await auth.deleteUser(uid);
    } catch (err: any) {
      // إذا كان حساب Auth محذوفًا مسبقًا، نكمل تنظيف Firestore حتى لا يبقى
      // ملف محذوف يمنع إدارة البيانات لاحقًا.
      if (err?.code !== "auth/user-not-found") throw err;
    }

    for (const query of CLEANUP_QUERIES) {
      await deleteMatchingDocuments(db, query.collection, query.field, uid);
    }
    await targetRef.delete();

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[delete-student] error:", err);
    const status =
      err?.code === "auth/id-token-expired" ||
      err?.code === "auth/invalid-id-token" ||
      err?.code === "auth/argument-error"
        ? 401
        : 500;
    return NextResponse.json({ error: errorMessage(err) }, { status });
  }
}

export const runtime = "nodejs";
