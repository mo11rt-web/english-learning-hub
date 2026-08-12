import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { StudentProfile, Attempt, Assignment } from "@/lib/types";
import { computeLevel } from "@/lib/gamification";

export interface StudentReportData {
  lessonsTotal: number;
  lessonsCompleted: number;
  completionPercentage: number;
  quizAveragePercentage: number;
  points: number;
  levelName: string;
  nextLevelName: string | null;
  progressToNextLevel: number;
  rank: number | null;
  totalInGroup: number | null;
  recentResults: { title: string; score: number; maxScore: number; date: number }[];
}

// نفس منطق حساب النتائج المستخدم بالرابط المُشارَك مع ولي الأمر
// (src/lib/shareResults.ts)، بس هون بيُحسب مباشرة لصفحة "نتائجي" الخاصة
// بالطالب نفسه (بدون الحاجة لإنشاء رابط مشاركة)، مع إضافة الترتيب داخل
// المجموعة (Class Rank) يلي ما كان موجود قبل.
//
// idToken مطلوب لحساب الترتيب فقط — لأنه هاد الجزء بيحتاج قراءة نقاط
// باقي طلاب المجموعة، وهاد ممنوع مباشرة من المتصفح حسب قواعد الأمان
// (خصوصية بيانات الطلاب الآخرين)، فبنستدعي API سيرفر آمن بيرجّع رقم
// الترتيب بس بدون أي تفاصيل شخصية عن أي طالب تاني.
export async function computeStudentReport(
  studentId: string,
  idToken?: string
): Promise<StudentReportData> {
  const studentSnap = await getDoc(doc(db, "profiles", studentId));
  if (!studentSnap.exists()) throw new Error("لم يتم العثور على بيانات الطالب");
  const student = studentSnap.data() as StudentProfile & { points?: number };

  const [lessonsSnap, progressSnap, attemptsSnap] = await Promise.all([
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
  ]);

  const lessonsTotal = lessonsSnap?.size ?? 0;
  const lessonsCompleted = progressSnap.docs.filter((d) => d.data().completed).length;
  const completionPercentage =
    lessonsTotal > 0 ? Math.round((lessonsCompleted / lessonsTotal) * 100) : 0;

  const gradedAttempts = attemptsSnap.docs
    .map((d) => d.data() as Attempt)
    .filter((a) => (a.status === "submitted" || a.status === "graded") && (a.maxScore ?? 0) > 0);
  const quizAveragePercentage =
    gradedAttempts.length > 0
      ? Math.round(
          (gradedAttempts.reduce(
            (sum, a) => sum + (a.finalScore ?? a.autoScore ?? 0) / (a.maxScore ?? 1),
            0
          ) /
            gradedAttempts.length) *
            100
        )
      : 0;

  const assignmentIds = Array.from(new Set(attemptsSnap.docs.map((d) => (d.data() as Attempt).assignmentId)));
  const assignmentTitles: Record<string, string> = {};
  await Promise.all(
    assignmentIds.map(async (id) => {
      const s = await getDoc(doc(db, "assignments", id));
      if (s.exists()) assignmentTitles[id] = (s.data() as Assignment).title;
    })
  );
  const recentResults = attemptsSnap.docs
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

  const points = student.points ?? 0;
  const level = computeLevel(points);

  let rank: number | null = null;
  let totalInGroup: number | null = null;
  if (idToken) {
    try {
      const res = await fetch("/api/student/rank", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        rank = data.rank ?? null;
        totalInGroup = data.totalInGroup ?? null;
      }
    } catch {
      // فشل جلب الترتيب لا يجب أن يمنع عرض باقي التقرير
    }
  }

  return {
    lessonsTotal,
    lessonsCompleted,
    completionPercentage,
    quizAveragePercentage,
    points,
    levelName: level.name,
    nextLevelName: level.next,
    progressToNextLevel: level.progressToNext,
    rank,
    totalInGroup,
    recentResults,
  };
}
