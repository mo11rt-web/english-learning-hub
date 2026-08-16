"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, PlayCircle, BookOpen } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { listenCollection, where } from "@/lib/firestore-helpers";
import { Lesson, StudentProfile } from "@/lib/types";
import { matchesStudentGroups } from "@/lib/groupTargeting";

export default function StudentLessonsPage() {
  const { profile, user } = useAuth();
  const student = profile as StudentProfile | null;
  const [lessons, setLessons] = useState<(Lesson & { id: string })[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!student) return;
    // نقيّد القراءة بالمرحلة والحالة فقط. تصفية المجموعات تتم بعد الجلب
    // عبر matchesStudentGroups حتى تعمل أيضًا مع الدروس القديمة التي كانت
    // تُخزّن targetGroupIds كمصفوفة فارغة قبل اعتماد __all__.
    const u = listenCollection<Lesson>(
      "lessons",
      [
        where("stageId", "==", student.stageId),
        where("status", "==", "published"),
      ],
      setLessons
    );
    return () => u();
  }, [student]);

  // تقدّم الطالب بكل درس (مكتمل أو لا) — نفس الكوليكشن (lesson_progress)
  // اللي صفحة "نتائجي" ورابط مشاركة النتائج مع الأهل بتعتمد عليه أصلًا،
  // فقط منعرض هون علامة "مكتمل" فوق كل درس خلص فيه الطالب.
  useEffect(() => {
    if (!user) return;
    const u = listenCollection<{ studentId: string; lessonId: string; completed?: boolean }>(
      "lesson_progress",
      [where("studentId", "==", user.uid)],
      (items) => {
        setCompletedIds(new Set(items.filter((p) => p.completed).map((p) => p.lessonId)));
      }
    );
    return () => u();
  }, [user]);

  const visibleLessons = lessons.filter((l) =>
    matchesStudentGroups(l.targetGroupIds, student?.groupIds)
  );

  return (
    <AppShell requireRole="student">
      <PageHeader icon="📚" title="دروسي" />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleLessons.map((l) => {
          const done = completedIds.has(l.id);
          return (
            <Link key={l.id} href={`/student/lessons/${l.id}`}>
              <GlassCard
                className={`hover:shadow-lg transition-shadow cursor-pointer h-full ${
                  done ? "border-brand-success/40" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-bold text-brand-text">{l.title}</h3>
                  {done ? (
                    <StatusBadge label="مكتمل" tone="success" />
                  ) : (
                    <StatusBadge label="لسا" tone="muted" />
                  )}
                </div>
                <p className="text-brand-textMuted text-sm mb-3">
                  {l.description ?? "درس تعليمي"}
                </p>
                <p className="text-xs font-bold flex items-center gap-1.5 text-brand-primary">
                  {done ? <CheckCircle2 size={15} /> : <PlayCircle size={15} />}
                  {done ? "راجع الدرس مرة تانية" : "ابدأ الدرس"}
                </p>
              </GlassCard>
            </Link>
          );
        })}
        {visibleLessons.length === 0 && (
          <div className="col-span-full flex flex-col items-center text-center py-12 text-brand-textMuted">
            <BookOpen size={32} className="mb-2 opacity-50" />
            <p>لا توجد دروس منشورة بعد.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
