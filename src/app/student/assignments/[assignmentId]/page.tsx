"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { Assignment, Question, Attempt } from "@/lib/types";
import { listenCollection, where } from "@/lib/firestore-helpers";
import { getAssignmentQuestionIds } from "@/lib/assignmentQuestions";

type PublicQuestion = Omit<Question, "correctAnswer"> & { id: string };

export default function TakeAssignmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [assignment, setAssignment] = useState<(Assignment & { id: string }) | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [existingAttempt, setExistingAttempt] = useState<(Attempt & { id: string }) | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [resultScore, setResultScore] = useState<number | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "assignments", assignmentId), (s) => {
      if (s.exists()) setAssignment({ ...(s.data() as Assignment), id: s.id });
      else setError("الواجب غير موجود.");
    }, (snapshotError) => setError(snapshotError.message?.toLowerCase().includes("permission") ? "لا تملك صلاحية الوصول إلى هذا الواجب أو أنه غير مخصص لحسابك." : "تعذر تحميل بيانات الواجب."));
    return () => unsub();
  }, [assignmentId]);

  useEffect(() => {
    if (!user) return;
    const u = listenCollection<Attempt>(
      "attempts",
      [where("assignmentId", "==", assignmentId), where("studentId", "==", user.uid)],
      (items) => setExistingAttempt(items[0] ?? null)
    );
    return () => u();
  }, [assignmentId, user]);

  useEffect(() => {
    if (!user || !assignment) return;
    let cancelled = false;
    setLoadingQuestions(true);
    setError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    user.getIdToken(true)
      .then((token) => fetch(`/api/student/assignment-questions?assignmentId=${encodeURIComponent(assignmentId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }))
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "تعذر تحميل أسئلة الواجب.");
        if (!cancelled) setQuestions(data.questions ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.name === "AbortError" ? "استغرق تحميل الأسئلة وقتًا طويلاً. اضغط إعادة تحميل الصفحة وحاول مجددًا." : err instanceof Error ? err.message : "تعذر تحميل أسئلة الواجب.");
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!cancelled) setLoadingQuestions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assignment, assignmentId, user]);

  if (!assignment) {
    return <AppShell requireRole="student"><p>{error ?? "جاري التحميل..."}</p></AppShell>;
  }

  const assignmentQuestionIds = getAssignmentQuestionIds(assignment as unknown as Record<string, unknown>);
  const assignmentQuestions = questions
    .filter((q) => assignmentQuestionIds.includes(q.id))
    .sort((a, b) => assignmentQuestionIds.indexOf(a.id) - assignmentQuestionIds.indexOf(b.id));

  const handleSubmit = async () => {
    if (!user || submitting || existingAttempt || submitted) return;
    if (assignmentQuestions.length === 0) {
      setError("لا توجد أسئلة صالحة في هذا الواجب.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/student/grade-assignment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assignmentId, answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "تعذر تسليم الواجب.");

      setResultScore(data.autoScore ?? 0);
      setSubmitted(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسليم الواجب.");
    } finally {
      setSubmitting(false);
    }
  };

  if (existingAttempt || submitted) {
    return (
      <AppShell requireRole="student">
        <GlassCard className="max-w-lg mx-auto text-center">
          <h1 className="text-xl font-bold text-brand-text mb-2">{assignment.title}</h1>
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
      {error && <p className="text-brand-error text-sm mb-4">{error}</p>}
      {loadingQuestions ? (
        <p className="text-brand-textMuted">جاري تحميل الأسئلة...</p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {assignmentQuestions.map((q, idx) => (
              <GlassCard key={q.id}>
                <p className="font-medium text-brand-text mb-3">{idx + 1}. {q.text}</p>
                {q.type === "mcq" && q.options ? (
                  <div className="flex flex-col gap-2">
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
                    {[{ value: "true", label: "صح" }, { value: "false", label: "خطأ" }].map((opt) => (
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
                    value={typeof answers[q.id] === "string" ? answers[q.id] as string : ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
                    rows={q.type === "essay" ? 4 : 2}
                  />
                )}
              </GlassCard>
            ))}
            {assignmentQuestions.length === 0 && <p className="text-brand-textMuted">لا توجد أسئلة في هذا الواجب.</p>}
          </div>
          <Button onClick={handleSubmit} disabled={submitting || assignmentQuestions.length === 0} className="mt-6">
            {submitting ? "جارٍ التصحيح والتسليم..." : "تسليم الإجابات"}
          </Button>
        </>
      )}
    </AppShell>
  );
}
