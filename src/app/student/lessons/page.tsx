"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, PlayCircle, BookOpen, Layers3 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { listenCollection, where } from "@/lib/firestore-helpers";
import { Lesson, StudentProfile, Unit } from "@/lib/types";
import { matchesStudentGroups } from "@/lib/groupTargeting";

export default function StudentLessonsPage() {
  const { profile, user } = useAuth();
  const student = profile as StudentProfile | null;
  const [lessons, setLessons] = useState<(Lesson & { id: string })[]>([]);
  const [units, setUnits] = useState<(Unit & { id: string })[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!student?.stageId) return;
    const lessonUnsubscribe = listenCollection<Lesson>(
      "lessons",
      [where("stageId", "==", student.stageId), where("status", "==", "published")],
      setLessons
    );
    const unitUnsubscribe = listenCollection<Unit>(
      "units",
      [where("stageId", "==", student.stageId), where("status", "==", "published")],
      (items) => setUnits(items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
    );
    return () => {
      lessonUnsubscribe();
      unitUnsubscribe();
    };
  }, [student?.stageId]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = listenCollection<{ studentId: string; lessonId: string; completed?: boolean }>(
      "lesson_progress",
      [where("studentId", "==", user.uid)],
      (items) => setCompletedIds(new Set(items.filter((item) => item.completed).map((item) => item.lessonId)))
    );
    return () => unsubscribe();
  }, [user]);

  const visibleLessons = useMemo(
    () => lessons.filter((lesson) => matchesStudentGroups(lesson.targetGroupIds, student?.groupIds)),
    [lessons, student?.groupIds]
  );

  const lessonsByUnit = useMemo(() => {
    const grouped = new Map<string, (Lesson & { id: string })[]>();
    for (const lesson of visibleLessons) {
      const key = lesson.unitId || "__without_unit";
      grouped.set(key, [...(grouped.get(key) ?? []), lesson]);
    }
    for (const list of grouped.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return grouped;
  }, [visibleLessons]);

  const visibleUnits = useMemo(() => {
    const knownUnits = units.filter((unit) => lessonsByUnit.has(unit.id));
    const knownIds = new Set(knownUnits.map((unit) => unit.id));
    const orphanLessons = lessonsByUnit.get("__without_unit") ?? [];
    return orphanLessons.length > 0 || lessonsByUnit.size > knownIds.size
      ? [...knownUnits, { id: "__without_unit", title: "دروس أخرى", stageId: student?.stageId ?? "", order: 999999, status: "published" as const, createdAt: 0 }]
      : knownUnits;
  }, [units, lessonsByUnit, student?.stageId]);

  return (
    <AppShell requireRole="student">
      <PageHeader icon="📚" title="دروسي" />
      <div className="flex flex-col gap-6 pb-36">
        {visibleUnits.map((unit) => {
          const unitLessons = lessonsByUnit.get(unit.id) ?? [];
          const completedCount = unitLessons.filter((lesson) => completedIds.has(lesson.id)).length;
          const remainingCount = Math.max(0, unitLessons.length - completedCount);
          const percentage = unitLessons.length > 0 ? Math.round((completedCount / unitLessons.length) * 100) : 0;
          const complete = percentage === 100;

          return (
            <section key={unit.id} aria-label={`وحدة ${unit.title}`} className="relative">
              <GlassCard className={`relative z-10 mb-4 overflow-hidden p-5 md:p-6 ${complete ? "border-brand-success/60" : "border-brand-primary/25"}`}>
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-l from-brand-primary via-brand-secondary to-brand-goldLight" />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 rounded-2xl p-3 shadow-sm ${complete ? "bg-brand-success/15 text-brand-success" : "bg-brand-primary/10 text-brand-primary"}`}>
                      <Layers3 size={24} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold tracking-wide text-brand-primary mb-1">المسار التعليمي · وحدة</p>
                      <h2 className={`font-extrabold text-xl truncate ${complete ? "text-brand-success" : "text-brand-text"}`}>{unit.title}</h2>
                      <p className="text-xs text-brand-textMuted mt-1">{unitLessons.length} دروس · {completedCount} مكتمل · {remainingCount} متبقي</p>
                    </div>
                  </div>
                  <div className="text-center shrink-0">
                    <span className={`font-extrabold text-lg ${complete ? "text-brand-success" : "text-brand-primary"}`}>{percentage}%</span>
                    <span className="block text-[10px] text-brand-textMuted mt-0.5">إنجاز الوحدة</span>
                  </div>
                </div>
                <div className="mt-5 h-3 rounded-full bg-surfaceBorder/40 overflow-hidden" aria-label={`نسبة التقدم ${percentage}%`}>
                  <div className={`h-full rounded-full transition-all duration-500 ${complete ? "bg-brand-success" : "bg-gradient-to-l from-brand-primary to-brand-secondary"}`} style={{ width: `${percentage}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-brand-textMuted mt-2"><span>التقدم في الوحدة</span><span>{completedCount} من {unitLessons.length} دروس</span></div>
              </GlassCard>

              <div className="relative mr-3 md:mr-8 pr-5 md:pr-7 border-r-2 border-brand-primary/20 pb-2">
                <div className="absolute right-[-3px] top-0 bottom-4 w-1 rounded-full bg-gradient-to-b from-brand-primary/40 via-brand-secondary/20 to-transparent" />
                <div className="grid gap-3">
                  {unitLessons.map((lesson, lessonIndex) => {
                    const done = completedIds.has(lesson.id);
                    return (
                      <Link key={lesson.id} href={`/student/lessons/${lesson.id}`} className="relative block before:absolute before:right-[-29px] md:before:right-[-36px] before:top-1/2 before:w-6 md:before:w-7 before:h-0.5 before:bg-brand-primary/25">
                        <div className={`relative rounded-2xl border bg-surface/70 px-4 py-4 md:px-5 transition-all hover:-translate-x-1 hover:shadow-md ${done ? "border-brand-success/35" : "border-surfaceBorder/70"}`}>
                          <div className="absolute right-[-9px] top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-4 border-app-bg bg-brand-primary shadow-sm" />
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${done ? "bg-brand-success/15 text-brand-success" : "bg-brand-primary/10 text-brand-primary"}`}>{lessonIndex + 1}</span>
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold text-brand-primary mb-0.5">درس {lessonIndex + 1} من الوحدة</p>
                                <h3 className="font-bold text-brand-text truncate">{lesson.title}</h3>
                              </div>
                            </div>
                            {done ? <StatusBadge label="مكتمل" tone="success" /> : <StatusBadge label="متبقي" tone="muted" />}
                          </div>
                          <p className="text-brand-textMuted text-xs mt-2 mr-11 truncate">{lesson.description ?? "درس تعليمي"}</p>
                          <p className="text-xs font-bold flex items-center gap-1.5 text-brand-primary mt-3 mr-11">
                            {done ? <CheckCircle2 size={15} /> : <PlayCircle size={15} />}
                            {done ? "راجع الدرس مرة تانية" : "ابدأ الدرس"}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
        {visibleUnits.length === 0 && (
          <div className="flex flex-col items-center text-center py-12 text-brand-textMuted">
            <BookOpen size={32} className="mb-2 opacity-50" />
            <p>لا توجد وحدات أو دروس منشورة بعد.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
