"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { listenCollection, orderBy } from "@/lib/firestore-helpers";
import { PastExamQuestion, Stage } from "@/lib/types";

export default function StudentPastExamsPage() {
  const [items, setItems] = useState<(PastExamQuestion & { id: string })[]>([]);
  const [stages, setStages] = useState<(Stage & { id: string })[]>([]);
  const [filterSubject, setFilterSubject] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterRound, setFilterRound] = useState("");
  const [search, setSearch] = useState("");
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});

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

  const subjects = Array.from(new Set(items.map((i) => i.subject))).sort();
  const years = Array.from(new Set(items.map((i) => i.year))).sort((a, b) => b - a);
  const rounds = Array.from(new Set(items.map((i) => i.round))).sort();

  const filtered = items.filter(
    (i) =>
      (!filterSubject || i.subject === filterSubject) &&
      (!filterYear || String(i.year) === filterYear) &&
      (!filterStage || i.stageId === filterStage) &&
      (!filterRound || i.round === filterRound) &&
      (!search.trim() || i.questionText.includes(search.trim()))
  );

  return (
    <AppShell requireRole="student">
      <h1 className="text-2xl font-bold text-brand-text mb-6">أسئلة الدورات السابقة</h1>

      <GlassCard className="mb-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70 text-sm">
            <option value="">كل المواد</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70 text-sm">
            <option value="">كل المراحل</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70 text-sm">
            <option value="">كل السنوات</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterRound} onChange={(e) => setFilterRound(e.target.value)}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70 text-sm">
            <option value="">كل الدورات</option>
            {rounds.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <input
          placeholder="ابحث بنص السؤال..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70 text-sm"
        />
      </GlassCard>

      <div className="flex flex-col gap-3">
        {filtered.map((q) => (
          <GlassCard key={q.id}>
            <p className="text-xs text-brand-primary mb-2">
              {q.subject} · {stages.find((s) => s.id === q.stageId)?.name ?? "—"} · {q.year} · {q.round}
              {q.marks ? ` · ${q.marks} علامة` : ""}
            </p>
            <p className="text-brand-text font-medium mb-2">{q.questionText}</p>
            {q.imageUrl && (
              q.imageUrl.match(/\.pdf(\?|#|$)/i) ? (
                <a href={q.imageUrl} target="_blank" rel="noreferrer" className="text-brand-primary text-sm">
                  📄 فتح ملف السؤال ↗
                </a>
              ) : (
                <img src={q.imageUrl} alt="" className="rounded-xl max-w-full mb-2" loading="lazy" />
              )
            )}
            {revealedAnswers[q.id] ? (
              <div className="mt-2 bg-brand-success/10 rounded-xl p-3 text-sm text-brand-text">
                <p className="font-medium mb-1">الحل:</p>
                <p className="whitespace-pre-wrap">{q.answerText}</p>
              </div>
            ) : (
              <button
                onClick={() => setRevealedAnswers({ ...revealedAnswers, [q.id]: true })}
                className="text-brand-primary text-sm mt-1"
              >
                👁 إظهار الحل
              </button>
            )}
          </GlassCard>
        ))}
        {filtered.length === 0 && (
          <p className="text-brand-textMuted">لا توجد أسئلة مطابقة.</p>
        )}
      </div>
    </AppShell>
  );
}
