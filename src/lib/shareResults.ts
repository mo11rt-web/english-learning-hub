import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { StudentProfile, Stage, Group, Lesson, Assignment, Attempt } from "@/lib/types";
import { computeLevel } from "@/lib/gamification";

function randomToken() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

// يبني لقطة (Snapshot) عامة للنتائج ويحفظها بمستند shares/{token} — لا يتطلب
// من ولي الأمر تسجيل الدخول لاحقًا لقراءتها
export async function publishResultsShare(
  studentId: string,
  teacherUid: string
): Promise<string> {
  const studentSnap = await getDoc(doc(db, "profiles", studentId));
  if (!studentSnap.exists()) throw new Error("الطالب غير موجود");
  const student = studentSnap.data() as StudentProfile;

  const [stageSnap, groupsSnap, lessonsSnap, progressSnap, attemptsSnap, groupPeersSnap] = await Promise.all([
    student.stageId ? getDoc(doc(db, "stages", student.stageId)) : Promise.resolve(null),
    getDocs(collection(db, "groups")),
    student.stageId
      ? getDocs(
          query(
            collection(db, "lessons"),
            where("stageId", "==", student.stageId),
            where("status", "==", "published")
          )
        )
      : Promise.resolve(null),
    getDocs(query(collection(db, "lesson_progress"), where("studentId", "==", studentId))),
    getDocs(query(collection(db, "attempts"), where("studentId", "==", studentId))),
    // المعلم/المدير مسموح له يقرأ بروفايلات كل الطلاب (خلافًا للطالب نفسه)،
    // فهون منقدر نحسب الترتيب مباشرة من المتصفح بدون الحاجة لـ API خاص.
    student.groupIds?.length
      ? getDocs(
          query(
            collection(db, "profiles"),
            where("role", "==", "student"),
            where("groupIds", "array-contains", student.groupIds[0])
          )
        )
      : Promise.resolve(null),
  ]);

  const stageName = (stageSnap?.data() as Stage | undefined)?.name ?? "—";
  const groupName =
    (groupsSnap.docs
      .map((d) => ({ ...(d.data() as Group), id: d.id }))
      .find((g) => student.groupIds?.includes(g.id))?.name) ?? "—";

  const lessonsTotal = lessonsSnap?.size ?? 0;
  const lessonsCompleted = progressSnap.docs.filter((d) => d.data().completed).length;
  const completionPercentage =
    lessonsTotal > 0 ? Math.round((lessonsCompleted / lessonsTotal) * 100) : 0;

  // آخر 10 نتائج اختبارات مصححة (تلقائيًا أو يدويًا)
  const assignmentIds = Array.from(
    new Set(attemptsSnap.docs.map((d) => (d.data() as Attempt).assignmentId))
  );
  const assignmentTitles: Record<string, string> = {};
  await Promise.all(
    assignmentIds.map(async (id) => {
      const s = await getDoc(doc(db, "assignments", id));
      if (s.exists()) assignmentTitles[id] = (s.data() as Assignment).title;
    })
  );
  const quizResults = attemptsSnap.docs
    .map((d) => d.data() as Attempt)
    .filter((a) => a.status === "submitted" || a.status === "graded")
    .sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
    .slice(0, 10)
    .map((a) => ({
      title: assignmentTitles[a.assignmentId] ?? "واجب",
      score: a.finalScore ?? a.autoScore ?? 0,
      maxScore: a.maxScore ?? 0,
      date: a.submittedAt ?? 0,
    }));

  const gradedForAverage = attemptsSnap.docs
    .map((d) => d.data() as Attempt)
    .filter((a) => (a.status === "submitted" || a.status === "graded") && (a.maxScore ?? 0) > 0);
  const quizAveragePercentage =
    gradedForAverage.length > 0
      ? Math.round(
          (gradedForAverage.reduce(
            (sum, a) => sum + (a.finalScore ?? a.autoScore ?? 0) / (a.maxScore ?? 1),
            0
          ) /
            gradedForAverage.length) *
            100
        )
      : 0;

  let rank: number | null = null;
  let totalInGroup: number | null = null;
  if (groupPeersSnap) {
    const peers = groupPeersSnap.docs.map((d) => ({
      id: d.id,
      points: (d.data() as StudentProfile & { points?: number }).points ?? 0,
    }));
    const sorted = peers.sort((a, b) => b.points - a.points);
    const idx = sorted.findIndex((p) => p.id === studentId);
    rank = idx >= 0 ? idx + 1 : null;
    totalInGroup = sorted.length;
  }

  const lastActivityAt = Math.max(
    0,
    ...progressSnap.docs.map((d) => d.data().lastOpenedAt ?? 0)
  );

  const token = student.shareToken || randomToken();
  const level = computeLevel(student.points ?? 0);

  await setDoc(doc(db, "shares", token), {
    studentId,
    studentName: student.fullName,
    stageName,
    groupName,
    points: student.points ?? 0,
    levelName: level.name,
    lessonsCompleted,
    lessonsTotal,
    completionPercentage,
    quizAveragePercentage,
    rank,
    totalInGroup,
    quizResults,
    lastActivityAt: lastActivityAt || undefined,
    enabled: true,
    createdBy: teacherUid,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  if (!student.shareToken) {
    await updateDoc(doc(db, "profiles", studentId), { shareToken: token });
  }

  return token;
}

export async function setShareEnabled(token: string, enabled: boolean) {
  await updateDoc(doc(db, "shares", token), { enabled, updatedAt: Date.now() });
}
