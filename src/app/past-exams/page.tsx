"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { BlockFileUpload } from "@/components/BlockFileUpload";
import {
  listenCollection,
  createDoc,
  deleteDocById,
  orderBy,
} from "@/lib/firestore-helpers";
import { PastExamQuestion, Stage } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

const emptyForm = {
  year: new Date().getFullYear(),
  subject: "",
  stageId: "",
  round: "",
  questionText: "",
  imageUrl: "",
  answerText: "",
  marks: 10,
};

export default function PastExamsPage() {
  const [items, setItems] = useState<(PastExamQuestion & { id: string })[]>([]);
  const [stages, setStages] = useState<(Stage & { id: string })[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [filterSubject, setFilterSubject] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    const u1 = listenCollection<PastExamQuestion>(
      "past_exam_questions",
      [orderBy("createdAt", "desc")],
      setItems
    );
    const u2 = listenCollection<Stage>("stages", [orderBy("order")], setStages);
    return () => {
      u1();
      u2();
    };
  }, []);

  const addItem = async () => {
    if (!form.questionText.trim() || !form.subject.trim() || !form.stageId || !user) return;
    await createDoc("past_exam_questions", {
      year: Number(form.year),
      subject: form.subject.trim(),
      stageId: form.stageId,
      round: form.round.trim() || "—",
      questionText: form.questionText,
      imageUrl: form.imageUrl || "",
      answerText: form.answerText,
      marks: Number(form.marks) || 0,
      createdBy: user.uid,
      createdAt: Date.now(),
    });
    setForm({ ...emptyForm, subject: form.subject, stageId: form.stageId, year: form.year });
  };

  const subjects = Array.from(new Set(items.map((i) => i.subject))).sort();
  const years = Array.from(new Set(items.map((i) => i.year))).sort((a, b) => b - a);

  const filtered = items.filter(
    (i) =>
      (!filterSubject || i.subject === filterSubject) &&
      (!filterYear || String(i.year) === filterYear)
  );

  return (
    <AppShell requireRole="teacher">
      <h1 className="text-2xl font-bold text-brand-text mb-6">أسئلة الدورات السابقة</h1>

      <GlassCard className="mb-6">
        <h2 className="font-bold text-brand-text mb-4">إضافة سؤال من دورة سابقة</h2>
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <input
            placeholder="المادة (مثلاً: اللغة الإنجليزية، الرياضيات...)"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          />
          <select
            value={form.stageId}
            onChange={(e) => setForm({ ...form, stageId: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          >
            <option value="">اختر المرحلة</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="السنة"
            value={form.year}
            onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          />
          <input
            placeholder="الدورة (مثلاً: الدورة الأولى)"
            value={form.round}
            onChange={(e) => setForm({ ...form, round: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          />
          <input
            type="number"
            placeholder="العلامة"
            value={form.marks}
            onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          />
        </div>

        <textarea
          placeholder="نص السؤال"
          value={form.questionText}
          onChange={(e) => setForm({ ...form, questionText: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70 mb-3"
          rows={2}
        />

        <div className="mb-3">
          <p className="text-sm text-brand-text mb-1.5">صورة أو PDF للسؤال (اختياري)</p>
          <BlockFileUpload
            type="book-page"
            onUploaded={(url) => setForm({ ...form, imageUrl: url })}
          />
          {form.imageUrl && <p className="text-xs text-brand-success mt-1">✅ تم إرفاق الملف</p>}
        </div>

        <textarea
          placeholder="الحل / الإجابة النموذجية"
          value={form.answerText}
          onChange={(e) => setForm({ ...form, answerText: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70 mb-3"
          rows={2}
        />

        <Button onClick={addItem}>إضافة السؤال</Button>
      </GlassCard>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="font-bold text-brand-text">البنك ({filtered.length})</h2>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-brand-primary/25 bg-white/70 text-sm"
        >
          <option value="">كل المواد</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-brand-primary/25 bg-white/70 text-sm"
        >
          <option value="">كل السنوات</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((q) => (
          <GlassCard key={q.id} className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-brand-primary mb-1">
                {q.subject} · {stages.find((s) => s.id === q.stageId)?.name ?? "—"} · {q.year} · {q.round} · {q.marks} علامة
              </p>
              <p className="text-brand-text font-medium">{q.questionText}</p>
              {q.imageUrl && <p className="text-xs text-brand-textMuted mt-1">📎 يحتوي ملف مرفق</p>}
            </div>
            <button
              onClick={() => deleteDocById("past_exam_questions", q.id)}
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
