"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressDonut } from "@/components/ui/ProgressDonut";
import { useAuth } from "@/hooks/useAuth";
import { listenCollection, where as fsWhere } from "@/lib/firestore-helpers";
import { Lesson, StudentProfile } from "@/lib/types";

export default function StudentLessonsPage() {
  const { user, profile } = useAuth();
  const student = profile as StudentProfile | null;
  const [lessons, setLessons] = useState<(Lesson & { id: string })[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!student) return;
    const u = listenCollection<Lesson>(
      "lessons",
      [fsWhere("stageId", "==", student.stageId), fsWhere("status", "==", "published")],
      setLessons
    );
    return () => u();
  }, [student]);

  // نتابع تقدّم الطالب (الدروس اللي خلّصها) عشان نلوّن الكرت بالأخضر ونحسب
  // نسبة التقدّم الإجمالية بأعلى الصفحة
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "lesson_progress"), where("studentId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const ids = new Set<string>();
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.completed) ids.add(data.lessonId as string);
      });
      setCompletedIds(ids);
    });
    return () => unsub();
  }, [user]);

  const completedCount = lessons.filter((l) => completedIds.has(l.id)).length;
  const percentage = lessons.length > 0 ? (completedCount / lessons.length) * 100 : 0;

  return (
    <AppShell requireRole="student">
      <h1 className="text-2xl font-bold text-brand-text mb-6">دروسي</h1>

      {lessons.length > 0 && (
        <GlassCard className="mb-6">
          <ProgressDonut percentage={percentage} />
          <p className="text-center text-brand-textMuted text-sm mt-3">
            أنهيت {completedCount} من {lessons.length} درس
          </p>
        </GlassCard>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lessons.map((l) => {
          const done = completedIds.has(l.id);
          return (
            <Link key={l.id} href={`/student/lessons/${l.id}`}>
              <GlassCard
                className={`hover:shadow-lg transition-shadow cursor-pointer h-full relative ${
                  done ? "ring-2 ring-brand-success/50" : ""
                }`}
              >
                {done && (
                  <span className="absolute top-3 left-3 w-7 h-7 rounded-full bg-brand-success text-white flex items-center justify-center text-sm shadow-md">
                    ✓
                  </span>
                )}
                <h3 className="font-bold text-brand-text mb-1">{l.title}</h3>
                <p className="text-brand-textMuted text-sm">{l.description ?? "درس تعليمي"}</p>
                {done && (
                  <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-brand-success/15 text-brand-success">
                    ✓ مكتمل
                  </span>
                )}
              </GlassCard>
            </Link>
          );
        })}
        {lessons.length === 0 && <p className="text-brand-textMuted">لا توجد دروس منشورة بعد.</p>}
      </div>
    </AppShell>
  );
}
