"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { LessonBlockView } from "@/components/LessonBlockView";
import { Lesson } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { awardPoints, getPointsSettings } from "@/lib/gamification";

export default function StudentLessonViewPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { user } = useAuth();
  const [lesson, setLesson] = useState<(Lesson & { id: string }) | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);

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

  const markComplete = async () => {
    if (!user) return;
    const progressRef = doc(db, "lesson_progress", `${user.uid}_${lessonId}`);
    const existing = await getDoc(progressRef);
    const alreadyCompleted = existing.exists() && existing.data()?.completed;
    await setDoc(progressRef, { completed: true, completedAt: Date.now() }, { merge: true });
    // نمنح النقاط مرة واحدة فقط لكل درس (حتى لو ضغط الطالب الزر أكثر من مرة)
    if (!alreadyCompleted) {
      const settings = await getPointsSettings();
      await awardPoints(user.uid, settings.lessonComplete);
      setJustCompleted(true);
    }
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
              <LessonBlockView block={block} />
            </GlassCard>
          ))}
      </div>
      {justCompleted ? (
        <p className="mt-6 text-brand-success font-medium">
          ✅ أحسنت! أنهيت الدرس وحصلت على نقاط إضافية 🎉
        </p>
      ) : (
        <Button onClick={markComplete} className="mt-6">✅ أنهيت هذا الدرس</Button>
      )}
    </AppShell>
  );
}


