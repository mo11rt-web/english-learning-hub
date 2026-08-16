import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { matchesStudentGroups } from "@/lib/groupTargeting";

export const dynamic = "force-dynamic";

function getBearerToken(req: NextRequest) {
  const value = req.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });

    const auth = adminAuth();
    const db = adminDb();
    const decoded = await auth.verifyIdToken(token);
    const profileSnap = await db.doc(`profiles/${decoded.uid}`).get();
    const profile = profileSnap.exists ? profileSnap.data() : null;
    if (!profile || profile.role !== "student" || profile.status !== "active") {
      return NextResponse.json({ error: "الحساب غير نشط أو غير مصرح له." }, { status: 403 });
    }

    const assignmentId = req.nextUrl.searchParams.get("assignmentId")?.trim();
    if (!assignmentId) return NextResponse.json({ error: "معرّف الواجب مطلوب." }, { status: 400 });

    const assignmentSnap = await db.doc(`assignments/${assignmentId}`).get();
    if (!assignmentSnap.exists) return NextResponse.json({ error: "الواجب غير موجود." }, { status: 404 });
    const assignment = assignmentSnap.data() ?? {};
    if (assignment.status !== "published") {
      return NextResponse.json({ error: "هذا الواجب غير منشور." }, { status: 403 });
    }
    if (!matchesStudentGroups(assignment.targetGroupIds, profile.groupIds ?? [])) {
      return NextResponse.json({ error: "هذا الواجب غير مخصص لحسابك." }, { status: 403 });
    }

    const questionIds = Array.isArray(assignment.questionIds)
      ? assignment.questionIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    const questionSnapshots = await Promise.all(
      questionIds.map((id) => db.doc(`question_bank/${id}`).get())
    );

    // لا نرسل correctAnswer أو explanation إلى جهاز الطالب. التصحيح يتم
    // حصريًا في POST /api/student/grade-assignment.
    const questions = questionSnapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => {
        const data = snapshot.data() ?? {};
        return {
          id: snapshot.id,
          text: data.text ?? "",
          instructions: data.instructions,
          type: data.type,
          options: data.options ?? [],
          points: Number(data.points) || 0,
          difficulty: data.difficulty,
          autoGrade: data.autoGrade !== false,
        };
      });

    return NextResponse.json({ questions });
  } catch (err: any) {
    console.error("[assignment-questions] error:", err);
    const status =
      err?.code === "auth/id-token-expired" ||
      err?.code === "auth/invalid-id-token" ||
      err?.code === "auth/argument-error"
        ? 401
        : 500;
    return NextResponse.json(
      { error: status === 401 ? "انتهت صلاحية جلستك، سجّل الدخول من جديد." : "تعذر تحميل أسئلة الواجب." },
      { status }
    );
  }
}

export const runtime = "nodejs";
