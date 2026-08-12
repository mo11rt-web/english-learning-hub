"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { createDoc, listenCollection, where } from "@/lib/firestore-helpers";
import { Assignment, Question, Attempt } from "@/lib/types";
import { awardPoints, getPointsSettings } from "@/lib/gamification";
import { notifyUsers, getTeacherUids } from "@/lib/notifications";

function normalize(s: string) {
  return s.trim().toLowerCase();
}

export default function TakeAssignmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { user, profile } = useAuth();
  const router = useRouter();
  const [assignment, setAssignment] = useState<(Assignment & { id: string }) | null>(null);
  const [questions, setQuestions] = useState<(Question & { id: string })[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [existingAttempt, setExistingAttempt] = useState<(Attempt & { id: string }) | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [resultScore, setResultScore] = useState<number | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "assignments", assignmentId), (s) => {
      if (s.exists()) setAssignment({ ...(s.data() as Assignment), id: s.id });
    });
    return () => unsub();
  }, [assignmentId]);

  useEffect(() => {
    const u = listenCollection<Question>("question_bank", [], setQuestions);
    return () => u();
  }, []);

  useEffect(() => {
    if (!user) return;
    const u = listenCollection<Attempt>(
      "attempts",
      [where("assignmentId", "==", assignmentId), where("studentId", "==", user.uid)],
      (items) => setExistingAttempt(items[0] ?? null)
    );
    return () => u();
  }, [assignmentId, user]);

  if (!assignment) {
    return <AppShell requireRole="student"><p>جاري التحميل...</p></AppShell>;
  }

  const assignmentQuestions = questions.filter((q) =>
    assignment.questionIds.includes(q.id)
  );

  const handleSubmit = async () => {
    if (!user) return;
    let autoScore = 0;
    let totalAuto = 0;
    let totalAll = 0;
    let hasManual = false;
    for (const q of assignmentQuestions) {
      totalAll += q.points;
      if (!q.autoGrade) {
        hasManual = true;
        continue;
      }
      totalAuto += q.points;
      const correct = Array.isArray(q.correctAnswer)
        ? q.correctAnswer.map(normalize)
        : [normalize(q.correctAnswer)];
      if (correct.includes(normalize(answers[q.id] ?? ""))) {
        autoScore += q.points;
      }
    }

    // إذا كانت كل الأسئلة موضوعية (تصحح تلقائيًا) نمنح النقاط فورًا عند
    // التسليم؛ إذا فيه أسئلة تحتاج مراجعة يدوية، تُمنح النقاط لاحقًا من
    // صفحة التصحيح بعد ما يحدد المعلم الدرجة النهائية.
    let pointsAwarded = false;
    if (!hasManual) {
      const settings = await getPointsSettings();
      const percentage = totalAll > 0 ? (autoScore / totalAll) * 100 : 0;
      const isExam = assignment.type === "exam";
      let points = isExam ? settings.examComplete : settings.quizComplete;
      if (percentage >= settings.highScoreThreshold) points += settings.highScoreBonus;
      await awardPoints(user.uid, points);
      pointsAwarded = true;
    }

    await createDoc("attempts", {
      assignmentId,
      studentId: user.uid,
      answers,
      autoScore,
      maxScore: totalAll,
      pointsAwarded,
      status: "submitted",
      startedAt: Date.now(),
      submittedAt: Date.now(),
    });

    // إشعار المعلم/المدير بتسليم جديد يحتاج مراجعة (خصوصًا إذا فيه أسئلة تصحيح يدوي)
    const teacherUids = await getTeacherUids();
    await notifyUsers(teacherUids, {
      title: "تسليم جديد يحتاج مراجعة",
      body: `${profile?.fullName ?? "طالب"} سلّم "${assignment.title}"`,
      type: "submission",
      link: `/assignments/${assignmentId}/grade`,
    });

    setResultScore(autoScore);
    setSubmitted(true);
  };

  if (existingAttempt || submitted) {
    return (
      <AppShell requireRole="student">
        <GlassCard className="max-w-lg mx-auto text-center">
          <h1 className="text-xl font-bold text-brand-text mb-2">
            {assignment.title}
          </h1>
          <p className="text-brand-textMuted mb-4">تم تسليم إجاباتك ✅</p>
          {assignment.showScoreImmediately && (
            <p className="text-3xl font-bold text-brand-primary">
              {resultScore ?? existingAttempt?.finalScore ?? existingAttempt?.autoScore ?? "—"}
            </p>
          )}
          <Button className="mt-4" onClick={() => router.push("/student/assignments")}>
            العودة إلى الواجبات
          </Button>
        </GlassCard>
      </AppShell>
    );
  }

  return (
    <AppShell requireRole="student">
      <h1 className="text-2xl font-bold text-brand-text mb-6">{assignment.title}</h1>
      <div className="flex flex-col gap-4">
        {assignmentQuestions.map((q, idx) => (
          <GlassCard key={q.id}>
            <p dir="ltr" className="font-medium text-brand-text mb-3">
              {idx + 1}. {q.text}
            </p>
            {q.type === "mcq" && q.options ? (
              <div className="flex flex-col gap-2" dir="ltr">
                {q.options.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-brand-text">
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswers({ ...answers, [q.id]: opt })}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : q.type === "true-false" ? (
              <div className="flex gap-4">
                {[
                  { value: "true", label: "صح" },
                  { value: "false", label: "خطأ" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm text-brand-text">
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === opt.value}
                      onChange={() => setAnswers({ ...answers, [q.id]: opt.value })}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                dir="ltr"
                className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
                rows={q.type === "essay" ? 4 : 2}
              />
            )}
          </GlassCard>
        ))}
        {assignmentQuestions.length === 0 && (
          <p className="text-brand-textMuted">لا توجد أسئلة في هذا الواجب.</p>
        )}
      </div>
      <Button onClick={handleSubmit} className="mt-6">تسليم الإجابات</Button>
    </AppShell>
  );
}
