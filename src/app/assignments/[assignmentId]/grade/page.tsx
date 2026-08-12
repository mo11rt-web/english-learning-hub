"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { listenCollection, updateDocById, where } from "@/lib/firestore-helpers";
import { Assignment, Attempt, Question, Profile } from "@/lib/types";
import { awardPoints, getPointsSettings } from "@/lib/gamification";

export default function GradeAssignmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [assignment, setAssignment] = useState<(Assignment & { id: string }) | null>(null);
  const [attempts, setAttempts] = useState<(Attempt & { id: string })[]>([]);
  const [questions, setQuestions] = useState<(Question & { id: string })[]>([]);
  const [students, setStudents] = useState<(Profile & { id: string })[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "assignments", assignmentId), (s) => {
      if (s.exists()) setAssignment({ ...(s.data() as Assignment), id: s.id });
    });
    return () => unsub();
  }, [assignmentId]);

  useEffect(() => {
    const u1 = listenCollection<Attempt>("attempts", [where("assignmentId", "==", assignmentId)], setAttempts);
    const u2 = listenCollection<Question>("question_bank", [], setQuestions);
    const u3 = listenCollection<Profile>("profiles", [], setStudents);
    return () => { u1(); u2(); u3(); };
  }, [assignmentId]);

  const setManualScore = async (att: Attempt & { id: string }, score: number) => {
    await updateDocById("attempts", att.id, {
      manualScore: score,
      finalScore: score,
      status: "graded",
      gradedAt: Date.now(),
    });
    // نمنح النقاط مرة واحدة فقط، بعد أول تصحيح نهائي لهذه المحاولة
    if (!att.pointsAwarded) {
      const settings = await getPointsSettings();
      const maxScore = att.maxScore ?? score;
      const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
      const isExam = assignment?.type === "exam";
      let points = isExam ? settings.examComplete : settings.quizComplete;
      if (percentage >= settings.highScoreThreshold) points += settings.highScoreBonus;
      await awardPoints(att.studentId, points);
      await updateDocById("attempts", att.id, { pointsAwarded: true });
    }
  };

  const setFeedback = (attemptId: string, feedback: string) => {
    updateDocById("attempts", attemptId, { teacherFeedback: feedback });
  };

  return (
    <AppShell requireRole="teacher">
      <h1 className="text-2xl font-bold text-brand-text mb-6">
        تصحيح: {assignment?.title ?? "..."}
      </h1>

      <div className="flex flex-col gap-4">
        {attempts.map((att) => {
          const student = students.find((s) => s.id === att.studentId);
          return (
            <GlassCard key={att.id}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <p className="font-bold text-brand-text">
                    {student?.fullName ?? "طالب غير معروف"}
                  </p>
                  <p className="text-xs text-brand-textMuted">
                    الحالة: {att.status === "graded" ? "تم التصحيح" : att.status === "submitted" ? "بانتظار التصحيح" : "قيد الحل"}
                    {" · "}تلقائي: {att.autoScore}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 mb-3 max-h-64 overflow-y-auto">
                {Object.entries(att.answers ?? {}).map(([qId, ans]) => {
                  const q = questions.find((qq) => qq.id === qId);
                  return (
                    <div key={qId} className="bg-surface/50 rounded-xl p-3 text-sm">
                      <p className="text-brand-text font-medium">{q?.text ?? qId}</p>
                      <p className="text-brand-textMuted">
                        إجابة الطالب: {Array.isArray(ans) ? ans.join("، ") : ans}
                      </p>
                      {q && (
                        <p className="text-brand-success text-xs">
                          الإجابة النموذجية: {Array.isArray(q.correctAnswer) ? q.correctAnswer.join("، ") : q.correctAnswer}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  placeholder="الدرجة النهائية"
                  defaultValue={att.finalScore ?? att.autoScore}
                  onBlur={(e) => setManualScore(att, Number(e.target.value))}
                  className="w-32 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-sm"
                />
                <input
                  placeholder="ملاحظة للطالب"
                  defaultValue={att.teacherFeedback}
                  onBlur={(e) => setFeedback(att.id, e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-sm"
                />
              </div>
            </GlassCard>
          );
        })}
        {attempts.length === 0 && (
          <p className="text-brand-textMuted">لا توجد محاولات بعد لهذا الواجب.</p>
        )}
      </div>
    </AppShell>
  );
}
