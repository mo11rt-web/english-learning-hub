"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SpeakButton } from "@/components/SpeakButton";
import { Lesson, LessonBlock } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

export default function StudentLessonViewPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { user } = useAuth();
  const [lesson, setLesson] = useState<(Lesson & { id: string }) | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "lessons", lessonId), (snap) => {
      if (snap.exists()) setLesson({ ...(snap.data() as Lesson), id: snap.id });
    });
    return () => unsub();
  }, [lessonId]);

  useEffect(() => {
    if (!user) return;
    setDoc(
      doc(db, "lesson_progress", `${user.uid}_${lessonId}`),
      { studentId: user.uid, lessonId, firstOpenedAt: Date.now(), lastOpenedAt: Date.now() },
      { merge: true }
    );
  }, [user, lessonId]);

  const markComplete = () => {
    if (!user) return;
    setDoc(
      doc(db, "lesson_progress", `${user.uid}_${lessonId}`),
      { completed: true, completedAt: Date.now() },
      { merge: true }
    );
  };

  if (!lesson) {
    return <AppShell requireRole="student"><p>جاري التحميل...</p></AppShell>;
  }

  return (
    <AppShell requireRole="student">
      <h1 className="text-2xl font-bold text-brand-text mb-6">{lesson.title}</h1>
      <div className="flex flex-col gap-4">
        {lesson.blocks
          .sort((a, b) => a.order - b.order)
          .map((block) => (
            <GlassCard key={block.id}>
              <BlockView block={block} />
            </GlassCard>
          ))}
      </div>
      <Button onClick={markComplete} className="mt-6">✅ أنهيت هذا الدرس</Button>
    </AppShell>
  );
}

function BlockView({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case "heading":
      return <h2 className="text-xl font-bold text-brand-text">{block.content}</h2>;
    case "subheading":
      return <h3 className="text-lg font-semibold text-brand-text">{block.content}</h3>;
    case "paragraph-ar":
      return <p dir="rtl" className="text-brand-text leading-relaxed">{block.content}</p>;
    case "paragraph-en":
      return (
        <div className="flex items-start gap-3">
          <p dir="ltr" className="text-brand-text leading-relaxed flex-1">{block.content}</p>
          <SpeakButton text={block.content} size="sm" />
        </div>
      );
    case "vocabulary-word":
      return (
        <div className="flex items-center gap-3">
          <p dir="ltr" className="text-2xl font-bold text-brand-primary">{block.content}</p>
          <SpeakButton text={block.content} />
        </div>
      );
    case "note":
      return <p className="text-brand-text bg-brand-primary/5 rounded-xl p-3">💡 {block.content}</p>;
    case "alert":
      return <p className="text-brand-error bg-brand-error/10 rounded-xl p-3">⚠️ {block.content}</p>;
    case "rule":
      return <p className="text-brand-text bg-brand-success/10 rounded-xl p-3">📏 {block.content}</p>;
    case "example":
      return <p dir="ltr" className="text-brand-text italic bg-brand-secondary/10 rounded-xl p-3">✏️ {block.content}</p>;
    case "pdf":
      return (
        <a href={block.content} target="_blank" rel="noreferrer" className="text-brand-primary text-sm">
          📄 فتح ملف PDF ↗
        </a>
      );
    case "image":
      return <img src={block.content} alt="" className="rounded-xl max-w-full" />;
    default:
      return <p className="text-brand-text whitespace-pre-wrap">{block.content}</p>;
  }
}
