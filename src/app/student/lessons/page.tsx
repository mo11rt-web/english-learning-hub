"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { useAuth } from "@/hooks/useAuth";
import { listenCollection, where } from "@/lib/firestore-helpers";
import { Lesson, StudentProfile } from "@/lib/types";

export default function StudentLessonsPage() {
  const { profile } = useAuth();
  const student = profile as StudentProfile | null;
  const [lessons, setLessons] = useState<(Lesson & { id: string })[]>([]);

  useEffect(() => {
    if (!student) return;
    const u = listenCollection<Lesson>(
      "lessons",
      [where("stageId", "==", student.stageId), where("status", "==", "published")],
      setLessons
    );
    return () => u();
  }, [student]);

  const visibleLessons = lessons.filter(
    (l) => l.targetGroupIds.length === 0 || l.targetGroupIds.some((g) => student?.groupIds?.includes(g))
  );

  return (
    <AppShell requireRole="student">
      <h1 className="text-2xl font-bold text-brand-text mb-6">دروسي</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleLessons.map((l) => (
          <Link key={l.id} href={`/student/lessons/${l.id}`}>
            <GlassCard className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <h3 className="font-bold text-brand-text mb-1">{l.title}</h3>
              <p className="text-brand-textMuted text-sm">{l.description ?? "درس تعليمي"}</p>
            </GlassCard>
          </Link>
        ))}
        {visibleLessons.length === 0 && <p className="text-brand-textMuted">لا توجد دروس منشورة بعد.</p>}
      </div>
    </AppShell>
  );
}
