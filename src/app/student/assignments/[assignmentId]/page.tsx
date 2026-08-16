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

type PublicQuestion = Omit<Question, "correctAnswer"> & {
  id: string;
  blankOptions?: string[];
  reorderItems?: string[];
  matchingLeft?: string[];
  matchingRight?: string[];
};

function shuffle<T>(items: T[]) {
  return items.slice().sort(() => Math.random() - 0.5);
}

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
    user.getIdToken()
      .then((token) => fetch(`/api/student/assignment-questions?assignmentId=${encodeURIComponent(assignmentId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }))
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "تعذر تحميل أسئلة الواجب.");
        if (!cancelled) {
          const nextQuestions = (data.questions ?? []) as PublicQuestion[];
          setQuestions(nextQuestions);
          setAnswers((previous) => {
            const next = { ...previous };
            for (const question of nextQuestions) {
              if (question.type === "reorder" && next[question.id] === undefined) {
                next[question.id] = shuffle(question.reorderItems ?? []);
              }
            }
            return next;
          });
        }
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

  const updateAnswer = (questionId: string, value: string | string[]) => {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
  };

  const moveReorderItem = (questionId: string, index: number, direction: -1 | 1) => {
    const current = answers[questionId];
    if (!Array.isArray(current)) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= current.length) return;
    const next = current.slice();
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    updateAnswer(questionId, next);
  };

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
          <div className="flex flex-col gap-4 pb-36">
            {assignmentQuestions.map((q, idx) => (
              <GlassCard key={q.id}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="font-medium text-brand-text">{idx + 1}. {q.text}</p>
                  <span className="text-xs text-brand-textMuted whitespace-nowrap">{q.points} درجة</span>
                </div>
                {q.instructions && <p className="text-xs text-brand-textMuted mb-3">{q.instructions}</p>}
                {q.type === "mcq" && (
                  <div className="grid gap-2">
                    {(q.options ?? []).map((opt) => (
                      <label key={opt} className="flex items-center gap-3 rounded-xl border border-brand-primary/20 bg-surface/60 px-3 py-3 text-sm text-brand-text cursor-pointer">
                        <input type="radio" name={q.id} checked={answers[q.id] === opt} onChange={() => updateAnswer(q.id, opt)} />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.type === "true-false" && (
                  <div className="grid grid-cols-2 gap-2">
                    {[{ value: "true", label: "صح" }, { value: "false", label: "خطأ" }].map((opt) => (
                      <label key={opt.value} className="flex items-center justify-center gap-2 rounded-xl border border-brand-primary/20 bg-surface/60 px-3 py-3 text-sm text-brand-text cursor-pointer">
                        <input type="radio" name={q.id} checked={answers[q.id] === opt.value} onChange={() => updateAnswer(q.id, opt.value)} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                )}
                {q.type === "fill-blank" && (
                  <select value={typeof answers[q.id] === "string" ? answers[q.id] as string : ""} onChange={(e) => updateAnswer(q.id, e.target.value)} className="w-full px-3 py-3 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text">
                    <option value="">اختر الإجابة المناسبة</option>
                    {(q.blankOptions ?? q.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}
                {q.type === "reorder" && (
                  <div className="flex flex-col gap-2">
                    {(Array.isArray(answers[q.id]) ? answers[q.id] as string[] : q.reorderItems ?? []).map((item, itemIndex, items) => (
                      <div key={`${item}-${itemIndex}`} className="flex items-center gap-2 rounded-xl border border-brand-primary/20 bg-surface/60 px-3 py-2 text-brand-text">
                        <span className="text-xs text-brand-textMuted w-5">{itemIndex + 1}</span>
                        <span className="flex-1">{item}</span>
                        <button type="button" disabled={itemIndex === 0} onClick={() => moveReorderItem(q.id, itemIndex, -1)} className="px-2 py-1 rounded-lg bg-surface disabled:opacity-30">↑</button>
                        <button type="button" disabled={itemIndex === items.length - 1} onClick={() => moveReorderItem(q.id, itemIndex, 1)} className="px-2 py-1 rounded-lg bg-surface disabled:opacity-30">↓</button>
                      </div>
                    ))}
                  </div>
                )}
                {q.type === "matching" && (
                  <div className="flex flex-col gap-3">
                    {(q.matchingLeft ?? []).map((left, leftIndex) => (
                      <label key={`${left}-${leftIndex}`} className="grid grid-cols-1 sm:grid-cols-2 items-center gap-2 text-sm text-brand-text">
                        <span>{left}</span>
                        <select value={Array.isArray(answers[q.id]) ? (answers[q.id] as string[])[leftIndex] ?? "" : ""} onChange={(e) => {
                          const next = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]).slice() : [];
                          next[leftIndex] = e.target.value;
                          updateAnswer(q.id, next);
                        }} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70">
                          <option value="">اختر المطابقة</option>
                          {(q.matchingRight ?? []).map((right) => <option key={right} value={right}>{right}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
                {(q.type === "short-answer" || q.type === "essay") && (
                  <>
                    <textarea value={typeof answers[q.id] === "string" ? answers[q.id] as string : ""} onChange={(e) => updateAnswer(q.id, e.target.value)} className="w-full px-3 py-3 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text" rows={q.type === "essay" ? 6 : 3} placeholder={q.type === "essay" ? "اكتب إجابتك بالتفصيل؛ سيراجعها الأستاذ." : "اكتب إجابتك هنا؛ قد تحتاج إلى مراجعة الأستاذ."} />
                    <p className="text-xs text-brand-textMuted mt-2">هذا السؤال يُرسل للأستاذ للمراجعة اليدوية.</p>
                  </>
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
