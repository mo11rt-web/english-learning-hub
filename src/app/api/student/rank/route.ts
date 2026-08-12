import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

// حساب ترتيب الطالب ضمن مجموعته (Class Rank) لازم يصير من السيرفر عبر
// Firebase Admin — لأنه قواعد أمان Firestore (firestore.rules) ما بتسمح
// لأي طالب يقرأ بروفايلات باقي الطلاب مباشرة من المتصفح (عن قصد، حماية
// لخصوصية أرقام الهواتف/العناوين...). هون منرجّع بس الرقم (الترتيب من
// أصل كم)، بدون أي بيانات شخصية عن باقي الطلاب.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });
    }

    const decoded = await adminAuth().verifyIdToken(idToken);
    const meSnap = await adminDb().doc(`profiles/${decoded.uid}`).get();
    if (!meSnap.exists) {
      return NextResponse.json({ error: "لم يتم العثور على حسابك." }, { status: 404 });
    }
    const me = meSnap.data()!;
    const groupIds: string[] = me.groupIds ?? [];

    if (!groupIds.length) {
      return NextResponse.json({ rank: null, totalInGroup: null });
    }

    const peersSnap = await adminDb()
      .collection("profiles")
      .where("role", "==", "student")
      .where("groupIds", "array-contains", groupIds[0])
      .get();

    const peers = peersSnap.docs.map((d) => ({ id: d.id, points: (d.data().points as number) ?? 0 }));
    peers.sort((a, b) => b.points - a.points);
    const idx = peers.findIndex((p) => p.id === decoded.uid);

    return NextResponse.json({
      rank: idx >= 0 ? idx + 1 : null,
      totalInGroup: peers.length,
    });
  } catch (err: any) {
    console.error("[student/rank] error:", err);
    const message =
      err?.code === "auth/id-token-expired"
        ? "انتهت صلاحية جلستك، سجّل الدخول من جديد."
        : "تعذّر حساب الترتيب.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
