"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { listenCollection, updateDocById, where } from "@/lib/firestore-helpers";
import { Assignment, Attempt, AttemptQuestionResult, Question, Profile } from "@/lib/types";
import { awardPoints, getPointsSettings } from "@/lib/gamification";
import { isAutoGradable } from "@/lib/grading";
import { notifyUsers } from "@/lib/notifications";

function displayAnswer(answer: string | string[] | undefined) {
  if (answer === undefined || answer === "") return "—";
  return Array.isArray(answer) ? answer.join(" ← ") : answer;
}

export default function GradeAssignmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [assignment, setAssignment] = useState<(Assignment & { id: string }) | null>(null);
  const [attempts, setAttempts] = useState<(Attempt & { id: string })[]>([]);
  const [questions, setQuestions] = useState<(Question & { id: string })[]>([]);
  const [students, setStudents] = useState<(Profile & { id: string })[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "assignments", assignmentId), (s) => {
      if (s.exists()) setAssignment({ ...(s.data() as Assignment), id: s.id });
    });
    return () => unsub();
  }, [assignmentId]);

  useEffect(() => {
    const u1 = listenCollection<Attempt>("attempts", [where("assignmentId", "==", assignmentId)], (items) => {
      setAttempts(items);
      const uids = Array.from(new Set(items.map((attempt) => attempt.studentId)));
      if (uids.length > 0) {
        Promise.all(uids.slice(0, 50).map((id) => import("firebase/firestore").then(({ getDoc, doc }) => getDoc(doc(db, "profiles", id))))).then((snaps) => {
          setStudents(snaps.filter((snap) => snap.exists()).map((snap) => ({ ...(snap.data() as Profile), id: snap.id })));
        });
      }
    });
    const u2 = listenCollection<Question>("question_bank", [], setQuestions);
    return () => { u1(); u2(); };
  }, [assignmentId]);

  const saveQuestionReview = async (attempt: Attempt & { id: string }, question: Question & { id: string }, score: number, teacherComment: string) => {
    const max = Math.max(0, Number(question.points) || 0);
    const safeScore = Math.min(max, Math.max(0, Number(score) || 0));
    const previousResults = attempt.questionResults ?? {};
    const nextResults: Record<string, AttemptQuestionResult> = { ...previousResults };
    nextResults[question.id] = {
      ...(nextResults[question.id] ?? { maxScore: max, autoGraded: false }),
      score: safeScore,
      maxScore: max,
      autoGraded: false,
      reviewed: true,
      teacherComment: teacherComment.trim() || undefined,
    };

    const allQuestionIds = Object.keys(attempt.answers ?? {});
    const relevantQuestions = allQuestionIds.map((id) => questions.find((item) => item.id === id)).filter(Boolean) as (Question & { id: string })[];
    const totalScore = relevantQuestions.reduce((sum, item) => sum + Number(nextResults[item.id]?.score ?? (attempt.questionResults?.[item.id]?.score ?? 0)), 0);
    const hasUnreviewedManual = relevantQuestions.some((item) => !isAutoGradable(item) && !nextResults[item.id]?.reviewed);
    const manualScore = relevantQuestions.reduce((sum, item) => sum + (!isAutoGradable(item) ? Number(nextResults[item.id]?.score ?? 0) : 0), 0);
    const status: Attempt["status"] = hasUnreviewedManual ? "pending-review" : "graded";

    const wasAlreadyGraded = attempt.status === "graded";
    setSaving(`${attempt.id}:${question.id}`);
    try {
      await updateDocById("attempts", attempt.id, {
        questionResults: nextResults,
        manualScore,
        finalScore: totalScore,
        status,
        gradedAt: status === "graded" ? Date.now() : undefined,
      });
      if (status === "graded" && !wasAlreadyGraded) {
        await notifyUsers([attempt.studentId], {
          title: "تم تصحيح واجبك",
          body: assignment?.title ?? "تمت مراجعة إجابتك من الأستاذ.",
          type: "graded",
          link: "/student/results",
        });
      }
      if (status === "graded" && !attempt.pointsAwarded) {
        const settings = await getPointsSettings();
        const maxScore = attempt.maxScore ?? relevantQuestions.reduce((sum, item) => sum + Number(item.points || 0), 0);
        const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
        let points = assignment?.type === "exam" ? settings.examComplete : settings.quizComplete;
        if (percentage >= settings.highScoreThreshold) points += settings.highScoreBonus;
        if (points > 0) {
          await awardPoints(attempt.studentId, points);
          await updateDocById("attempts", attempt.id, { pointsAwarded: true });
        }
      }
    } finally {
      setSaving(null);
    }
  };

  const setFeedback = (attemptId: string, feedback: string) => updateDocById("attempts", attemptId, { teacherFeedback: feedback });

  const sendResultToStudent = async (attempt: Attempt & { id: string }) => {
    try {
      await updateDocById("attempts", attempt.id, {
        isResultSent: true,
        status: "graded",
        gradedAt: Date.now(),
      });
      await notifyUsers([attempt.studentId], {
        title: "تم اعتماد وإرسال نتيجة الاختبار",
        body: `تم اعتماد نتيجتك في اختبار: ${assignment?.title ?? "الاختبار"}. يمكنك الاطلاع على إجاباتك الآن.`,
        type: "graded",
        link: "/student/results",
      });
      alert("تم إرسال النتيجة للطالب بنجاح ✅");
    } catch (err) {
      alert("تعذر إرسال النتيجة.");
    }
  };

  return (
    <AppShell requireRole="teacher">
      <h1 className="text-2xl font-bold text-brand-text mb-6">تصحيح: {assignment?.title ?? "..."}</h1>
      <div className="flex flex-col gap-4 pb-36">
        {attempts.map((attempt) => {
          const student = students.find((item) => item.id === attempt.studentId);
          const attemptQuestions = Object.keys(attempt.answers ?? {}).map((id) => questions.find((item) => item.id === id)).filter(Boolean) as (Question & { id: string })[];
          const finalScore = attempt.finalScore ?? attempt.autoScore ?? 0;
          return (
            <GlassCard key={attempt.id}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="font-bold text-brand-text">{student?.fullName ?? "طالب غير معروف"}</p>
                  <p className="text-xs text-brand-textMuted">{attempt.status === "pending-review" ? "بانتظار مراجعة الأستاذ" : attempt.status === "graded" ? "تم التصحيح" : "تم التسليم"} · الدرجة الحالية: {finalScore}</p>
                </div>
                <span className="text-xs rounded-full px-3 py-1 bg-brand-primary/10 text-brand-primary">{attemptQuestions.length} أسئلة</span>
              </div>

              <div className="flex flex-col gap-3">
                {attemptQuestions.map((question, index) => {
                  const answer = attempt.answers?.[question.id];
                  const result = attempt.questionResults?.[question.id];
                  const automatic = isAutoGradable(question);
                  return (
                    <div key={question.id} className="rounded-xl border border-brand-primary/15 bg-surface/50 p-3">
                      <p className="text-sm font-medium text-brand-text mb-1">{index + 1}. {question.text}</p>
                      <p className="text-sm text-brand-textMuted mb-2">إجابة الطالب: {displayAnswer(answer)}</p>
                      {automatic ? (
                        <div className="text-xs text-brand-success">تصحيح تلقائي: {result?.score ?? 0} / {question.points} {result?.isCorrect ? "✓" : ""}<span className="block text-brand-textMuted mt-1">الإجابة النموذجية: {displayAnswer(question.correctAnswer)}</span></div>
                      ) : (
                        <div className="grid sm:grid-cols-[120px_1fr] gap-2 items-center">
                          <input type="number" min={0} max={question.points} defaultValue={result?.score ?? 0} aria-label="درجة السؤال" className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-sm" onBlur={(event) => saveQuestionReview(attempt, question, Number(event.target.value), result?.teacherComment ?? "")} />
                          <input placeholder="تعليق الأستاذ على هذا السؤال" defaultValue={result?.teacherComment ?? ""} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-sm" onBlur={(event) => saveQuestionReview(attempt, question, Number(result?.score ?? 0), event.target.value)} />
                          <p className="sm:col-span-2 text-xs text-brand-textMuted">سؤال مراجعة يدوية · الدرجة القصوى: {question.points} · {saving === `${attempt.id}:${question.id}` ? "جارٍ الحفظ..." : result?.reviewed ? "تمت المراجعة" : "لم تتم المراجعة بعد"}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-3">
                <textarea placeholder="ملاحظة عامة للطالب" defaultValue={attempt.teacherFeedback ?? ""} onBlur={(event) => setFeedback(attempt.id, event.target.value)} className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-sm" rows={2} />
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-surfaceBorder/60">
                  <span className={`text-xs px-3 py-1 rounded-full ${attempt.isResultSent ? "bg-brand-success/15 text-brand-success font-bold" : "bg-brand-gold/15 text-brand-goldDark"}`}>
                    {attempt.isResultSent ? "✓ تم إرسال النتيجة للطالب ومعتمدة" : "النتيجة بانتظار الاعتماد والإرسال"}
                  </span>
                  <Button onClick={() => sendResultToStudent(attempt)} disabled={attempt.isResultSent}>
                    {attempt.isResultSent ? "تم إرسال النتيجة" : "إرسال النتيجة واعتمادها للطالب"}
                  </Button>
                </div>
              </div>
            </GlassCard>
          );
        })}
        {attempts.length === 0 && <p className="text-brand-textMuted">لا توجد محاولات بعد لهذا الواجب.</p>}
      </div>
    </AppShell>
  );
}
export function generateStaticParams() {
  // Only return static params for Capacitor export to avoid Vercel build conflicts
  if (process.env.CAPACITOR_BUILD === "true") {
    return [];
  }
  return [];
}
