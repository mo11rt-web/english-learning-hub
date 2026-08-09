"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SpeakButton } from "@/components/SpeakButton";
import { useAuth } from "@/hooks/useAuth";
import { listenCollection, where } from "@/lib/firestore-helpers";
import { VocabularyItem, StudentProfile } from "@/lib/types";

export default function StudentVocabularyPage() {
  const { profile } = useAuth();
  const student = profile as StudentProfile | null;
  const [items, setItems] = useState<(VocabularyItem & { id: string })[]>([]);
  const [mode, setMode] = useState<"browse" | "flashcards">("browse");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!student) return;
    const u = listenCollection<VocabularyItem>(
      "vocabulary_items", [where("stageId", "==", student.stageId)], setItems
    );
    return () => u();
  }, [student]);

  const current = items[index];

  return (
    <AppShell requireRole="student">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-text">الكلمات</h1>
        <div className="flex bg-black/5 rounded-2xl p-1">
          <button onClick={() => setMode("browse")}
            className={`px-3 py-1.5 rounded-xl text-sm ${mode === "browse" ? "bg-white shadow text-brand-primary" : "text-brand-textMuted"}`}>
            تصفح
          </button>
          <button onClick={() => setMode("flashcards")}
            className={`px-3 py-1.5 rounded-xl text-sm ${mode === "flashcards" ? "bg-white shadow text-brand-primary" : "text-brand-textMuted"}`}>
            بطاقات Flashcards
          </button>
        </div>
      </div>

      {mode === "browse" ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <GlassCard key={item.id}>
              <div className="flex items-center justify-between mb-2">
                <p dir="ltr" className="text-xl font-bold text-brand-primary">{item.word}</p>
                <SpeakButton text={item.word} size="sm" />
              </div>
              <p className="text-brand-text mb-1">{item.translation}</p>
              {item.example && <p dir="ltr" className="text-sm text-brand-textMuted italic">{item.example}</p>}
            </GlassCard>
          ))}
          {items.length === 0 && <p className="text-brand-textMuted">لا توجد كلمات بعد.</p>}
        </div>
      ) : current ? (
        <div className="flex flex-col items-center">
          <GlassCard
            className="w-full max-w-sm h-64 flex flex-col items-center justify-center cursor-pointer text-center"
            
          >
            <div onClick={() => setFlipped(!flipped)} className="flex-1 flex flex-col items-center justify-center w-full">
              {!flipped ? (
                <p dir="ltr" className="text-3xl font-bold text-brand-primary">{current.word}</p>
              ) : (
                <p className="text-2xl text-brand-text">{current.translation}</p>
              )}
              <p className="text-brand-textMuted text-xs mt-4">اضغط للقلب</p>
            </div>
          </GlassCard>
          <div className="flex items-center gap-4 mt-4">
            <Button variant="secondary" onClick={() => { setIndex((i) => Math.max(0, i - 1)); setFlipped(false); }}>
              السابق
            </Button>
            <SpeakButton text={current.word} />
            <Button variant="secondary" onClick={() => { setIndex((i) => Math.min(items.length - 1, i + 1)); setFlipped(false); }}>
              التالي
            </Button>
          </div>
          <p className="text-brand-textMuted text-sm mt-2">{index + 1} / {items.length}</p>
        </div>
      ) : (
        <p className="text-brand-textMuted">لا توجد كلمات بعد.</p>
      )}
    </AppShell>
  );
}
