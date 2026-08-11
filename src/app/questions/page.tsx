"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import {
  listenCollection,
  createDoc,
  deleteDocById,
  orderBy,
} from "@/lib/firestore-helpers";
import { Question, QuestionType, Stage } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

const typeLabels: Record<QuestionType, string> = {
  mcq: "اختيار من متعدد",
  "true-false": "صح أو خطأ",
  "fill-blank": "إكمال الفراغ",
  matching: "مطابقة",
  reorder: "ترتيب",
  "short-answer": "إجابة قصيرة",
  essay: "سؤال مقالي",
};

const AUTO_TYPES: QuestionType[] = ["mcq", "true-false", "fill-blank"];

const emptyForm = {
  text: "",
  type: "mcq" as QuestionType,
  options: ["", "", "", ""],
  correctAnswer: "",
  points: 1,
  difficulty: "medium" as Question["difficulty"],
};

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<(Question & { id: string })[]>([]);
  const [stages, setStages] = useState<(Stage & { id: string })[]>([]);
  const [form, setForm] = useState(emptyForm);
  const { user } = useAuth();
  const { stageId: workspaceStageId, stageName: workspaceStageName } = useWorkspace();

  useEffect(() => {
    const u1 = listenCollection<Question>(
      "question_bank",
      [orderBy("createdAt", "desc")],
      setQuestions
    );
    const u2 = listenCollection<Stage>("stages", [orderBy("order")], setStages);
    return () => {
      u1();
      u2();
    };
  }, []);

  const addQuestion = async () => {
    if (!form.text.trim() || !workspaceStageId || !user) return;
    const autoGrade = AUTO_TYPES.includes(form.type);
    await createDoc("question_bank", {
      text: form.text,
      type: form.type,
      options: form.type === "mcq" ? form.options.filter((o) => o.trim()) : [],
      correctAnswer:
        form.type === "true-false" ? form.correctAnswer || "true" : form.correctAnswer,
      points: Number(form.points) || 1,
      difficulty: form.difficulty,
      stageId: workspaceStageId,
      autoGrade,
      createdBy: user.uid,
      createdAt: Date.now(),
    });
    setForm(emptyForm);
  };

  const filtered = questions.filter((q) => q.stageId === workspaceStageId);

  return (
    <AppShell requireRole="teacher">
      <h1 className="text-2xl font-bold text-brand-text mb-6">بنك الأسئلة</h1>

      <GlassCard className="mb-6">
        <h2 className="font-bold text-brand-text mb-4">إضافة سؤال جديد</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <textarea
            placeholder="نص السؤال"
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            className="md:col-span-2 px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
            rows={2}
          />
          <select
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as QuestionType, correctAnswer: "" })
            }
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          >
            {(Object.keys(typeLabels) as QuestionType[]).map((t) => (
              <option key={t} value={t}>
                {typeLabels[t]}
              </option>
            ))}
          </select>
          {form.type === "mcq" && (
            <div className="md:col-span-2 grid grid-cols-2 gap-2">
              {form.options.map((opt, i) => (
                <input
                  key={i}
                  placeholder={`الخيار ${i + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const options = [...form.options];
                    options[i] = e.target.value;
                    setForm({ ...form, options });
                  }}
                  className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
                />
              ))}
            </div>
          )}

          {form.type === "true-false" ? (
            <select
              value={form.correctAnswer}
              onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
            >
              <option value="true">صح</option>
              <option value="false">خطأ</option>
            </select>
          ) : (
            form.type !== "essay" && (
              <input
                placeholder={
                  form.type === "mcq" ? "الإجابة الصحيحة (طابق أحد الخيارات)" : "الإجابة الصحيحة"
                }
                value={form.correctAnswer as string}
                onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
                className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
              />
            )
          )}

          <input
            type="number"
            min={1}
            placeholder="الدرجة"
            value={form.points}
            onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          />
          <select
            value={form.difficulty}
            onChange={(e) => setForm({ ...form, difficulty: e.target.value as any })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          >
            <option value="easy">سهل</option>
            <option value="medium">متوسط</option>
            <option value="hard">صعب</option>
          </select>
        </div>
        <Button onClick={addQuestion} className="mt-3">
          إضافة السؤال
        </Button>
      </GlassCard>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-brand-text">
          بنك "{workspaceStageName ?? "—"}" ({filtered.length})
        </h2>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((q) => (
          <GlassCard key={q.id} className="flex items-start justify-between gap-3">
            <div>
              <p className="text-brand-text font-medium">{q.text}</p>
              <p className="text-xs text-brand-textMuted mt-1">
                {typeLabels[q.type]} · {q.points} درجة ·{" "}
                {stages.find((s) => s.id === q.stageId)?.name ?? "—"}
                {q.autoGrade ? " · تصحيح تلقائي" : " · تصحيح يدوي"}
              </p>
            </div>
            <button
              onClick={() => deleteDocById("question_bank", q.id)}
              className="text-brand-error text-xs shrink-0"
            >
              حذف
            </button>
          </GlassCard>
        ))}
        {filtered.length === 0 && (
          <p className="text-brand-textMuted">لا توجد أسئلة بعد.</p>
        )}
      </div>
    </AppShell>
  );
}
