"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { BlockFileUpload } from "@/components/BlockFileUpload";
import {
  listenCollection,
  createDoc,
  deleteDocById,
  orderBy,
} from "@/lib/firestore-helpers";
import { CompactListRow } from "@/components/ui/CompactListRow";
import ActionsDropdown from "@/components/ui/ActionsDropdown";
import { Trash2 } from "lucide-react";
import { PastExamQuestion, Stage } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

const emptyForm = {
  year: new Date().getFullYear(),
  subject: "",
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
  const { stageId: workspaceStageId, stageName: workspaceStageName } = useWorkspace();

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
    if (!form.questionText.trim() || !form.subject.trim() || !workspaceStageId || !user) return;
    await createDoc("past_exam_questions", {
      year: Number(form.year),
      subject: form.subject.trim(),
      stageId: workspaceStageId,
      round: form.round.trim() || "—",
      questionText: form.questionText,
      imageUrl: form.imageUrl || "",
      answerText: form.answerText,
      marks: Number(form.marks) || 0,
      createdBy: user.uid,
      createdAt: Date.now(),
    });
    setForm({ ...emptyForm, subject: form.subject, year: form.year });
  };

  const itemsInWorkspace = items.filter((i) => i.stageId === workspaceStageId);
  const subjects = Array.from(new Set(itemsInWorkspace.map((i) => i.subject))).sort();
  const years = Array.from(new Set(itemsInWorkspace.map((i) => i.year))).sort((a, b) => b - a);

  const filtered = itemsInWorkspace.filter(
    (i) =>
      (!filterSubject || i.subject === filterSubject) &&
      (!filterYear || String(i.year) === filterYear)
  );

  return (
    <AppShell requireRole="teacher">
      <PageHeader icon="🗂️" title="أسئلة الدورات السابقة" />

      <GlassCard className="mb-6">
        <h2 className="font-bold text-brand-text mb-4">إضافة سؤال من دورة سابقة</h2>
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <input
            placeholder="المادة (مثلاً: اللغة الإنجليزية، الرياضيات...)"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
          />
          <div className="px-3 py-2 rounded-xl bg-brand-primary/10 text-brand-primary text-sm flex items-center">
            القسم: {workspaceStageName ?? "—"}
          </div>
          <input
            type="number"
            placeholder="السنة"
            value={form.year}
            onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
          />
          <input
            placeholder="الدورة (مثلاً: الدورة الأولى)"
            value={form.round}
            onChange={(e) => setForm({ ...form, round: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
          />
          <input
            type="number"
            placeholder="العلامة"
            value={form.marks}
            onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
          />
        </div>

        <textarea
          placeholder="نص السؤال"
          value={form.questionText}
          onChange={(e) => setForm({ ...form, questionText: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 mb-3"
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
          className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 mb-3"
          rows={2}
        />

        <Button onClick={addItem}>إضافة السؤال</Button>
      </GlassCard>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="font-bold text-brand-text">بنك "{workspaceStageName ?? "—"}" ({filtered.length})</h2>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-brand-primary/25 bg-surface/70 text-sm"
        >
          <option value="">كل المواد</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-brand-primary/25 bg-surface/70 text-sm"
        >
          <option value="">كل السنوات</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <GlassCard className="!p-0 overflow-hidden mb-36">
        <div className="flex flex-col">
          {filtered.map((q) => (
            <CompactListRow
              key={q.id}
              avatarLabel="ا"
              title={q.questionText}
              subtitle={`${q.subject} · ${q.year} · ${q.round} · ${q.marks} علامة`}
              trailing={
                <ActionsDropdown
                  actions={[
                    {
                      label: "حذف السؤال",
                      icon: <Trash2 className="w-4 h-4" />,
                      onClick: () => deleteDocById("past_exam_questions", q.id),
                      variant: "danger",
                    },
                  ]}
                />
              }
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-brand-textMuted text-sm text-center py-12">لا توجد أسئلة بعد.</p>
          )}
        </div>
      </GlassCard>
    </AppShell>
  );
}
