import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { matchesStudentGroups } from "@/lib/groupTargeting";
import { getAssignmentQuestionIds } from "@/lib/assignmentQuestions";
import { computeAutoScore } from "@/lib/grading";
import type { Question } from "@/lib/types";

const DEFAULT_POINTS_SETTINGS = {
  quizComplete: 20,
  examComplete: 30,
  highScoreBonus: 10,
  highScoreThreshold: 90,
};

function getBearerToken(req: NextRequest) {
  const value = req.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId.trim() : "";
    const answers = body?.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? body.answers as Record<string, string | string[]>
      : {};
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

    const maxAttempts = Math.max(1, Number(assignment.maxAttempts) || 1);
    const attemptsSnap = await db
      .collection("attempts")
      .where("assignmentId", "==", assignmentId)
      .where("studentId", "==", decoded.uid)
      .get();
    if (attemptsSnap.size >= maxAttempts) {
      return NextResponse.json({ error: "لقد استنفدت عدد المحاولات المسموح به لهذا الواجب." }, { status: 409 });
    }

    const questionIds = getAssignmentQuestionIds(assignment);
    const questionSnapshots = await Promise.all(
      questionIds.map((id) => db.doc(`question_bank/${id}`).get())
    );
    const questions = questionSnapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => ({ id: snapshot.id, ...(snapshot.data() as Omit<Question, "id">) })) as Question[];

    if (questions.length === 0) {
      return NextResponse.json({ error: "لا توجد أسئلة صالحة في هذا الواجب." }, { status: 400 });
    }

    const { autoScore, maxScore, needsManualGrading } = computeAutoScore(questions, answers);
    let pointsAwarded = false;
    if (!needsManualGrading) {
      const settingsSnap = await db.doc("app_settings/points").get();
      const settings = { ...DEFAULT_POINTS_SETTINGS, ...(settingsSnap.exists ? settingsSnap.data() : {}) };
      const percentage = maxScore > 0 ? (autoScore / maxScore) * 100 : 0;
      let points = assignment.type === "exam" ? Number(settings.examComplete) : Number(settings.quizComplete);
      if (percentage >= Number(settings.highScoreThreshold)) points += Number(settings.highScoreBonus);
      if (points > 0) {
        await db.doc(`profiles/${decoded.uid}`).update({ points: FieldValue.increment(points) });
        pointsAwarded = true;
      }
    }

    const attemptRef = db.collection("attempts").doc();
    await attemptRef.set({
      assignmentId,
      studentId: decoded.uid,
      answers,
      autoScore,
      maxScore,
      pointsAwarded,
      status: "submitted",
      startedAt: Date.now(),
      submittedAt: Date.now(),
    });

    // ينشئ الخادم إشعارات المعلمين مباشرة؛ الطالب لا يحتاج ولا يُسمح له
    // باستعلام profiles لمعرفة معرّفات المعلمين.
    const teachersSnap = await db.collection("profiles").where("role", "in", ["admin", "teacher"]).get();
    if (!teachersSnap.empty) {
      const batch = db.batch();
      for (const teacher of teachersSnap.docs) {
        const notificationRef = db.collection("notifications").doc();
        batch.set(notificationRef, {
          userId: teacher.id,
          title: "تسليم جديد يحتاج مراجعة",
          body: `${profile.fullName ?? "طالب"} سلّم "${assignment.title ?? "واجب"}"`,
          type: "submission",
          link: `/assignments/${assignmentId}/grade`,
          createdAt: Date.now(),
        });
      }
      await batch.commit();
    }

    return NextResponse.json({
      ok: true,
      attemptId: attemptRef.id,
      autoScore,
      maxScore,
      pointsAwarded,
      needsManualGrading,
    });
  } catch (err: any) {
    console.error("[grade-assignment] error:", err);
    const status =
      err?.code === "auth/id-token-expired" ||
      err?.code === "auth/invalid-id-token" ||
      err?.code === "auth/argument-error"
        ? 401
        : 500;
    return NextResponse.json(
      { error: status === 401 ? "انتهت صلاحية جلستك، سجّل الدخول من جديد." : err?.message?.includes("متغيرات حساب خدمة Firebase") ? "إعدادات Firebase Admin غير مكتملة على الخادم." : "تعذر تصحيح الواجب وحفظ المحاولة." },
      { status }
    );
  }
}

export const runtime = "nodejs";
