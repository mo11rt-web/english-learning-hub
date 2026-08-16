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
            <section key={unit.id} aria-label={`وحدة ${unit.title}`}>
              <GlassCard className={`mb-3 overflow-hidden ${complete ? "border-brand-success/50" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 rounded-xl p-2 ${complete ? "bg-brand-success/15 text-brand-success" : "bg-brand-primary/10 text-brand-primary"}`}>
                      <Layers3 size={21} />
                    </div>
                    <div className="min-w-0">
                      <h2 className={`font-bold text-lg truncate ${complete ? "text-brand-success" : "text-brand-text"}`}>{unit.title}</h2>
                      <p className="text-xs text-brand-textMuted mt-1">{unitLessons.length} دروس · {completedCount} مكتمل · {remainingCount} متبقي</p>
                    </div>
                  </div>
                  <span className={`font-bold text-sm whitespace-nowrap ${complete ? "text-brand-success" : "text-brand-primary"}`}>{percentage}%</span>
                </div>
                <div className="mt-4 h-3 rounded-full bg-surfaceBorder/40 overflow-hidden" aria-label={`نسبة التقدم ${percentage}%`}>
                  <div className={`h-full rounded-full transition-all duration-500 ${complete ? "bg-brand-success" : "bg-brand-primary"}`} style={{ width: `${percentage}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-brand-textMuted mt-2"><span>التقدم في الوحدة</span><span>{completedCount} من {unitLessons.length}</span></div>
              </GlassCard>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unitLessons.map((lesson) => {
                  const done = completedIds.has(lesson.id);
                  return (
                    <Link key={lesson.id} href={`/student/lessons/${lesson.id}`}>
                      <GlassCard className={`hover:shadow-lg transition-shadow cursor-pointer h-full ${done ? "border-brand-success/40" : ""}`}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-bold text-brand-text">{lesson.title}</h3>
                          {done ? <StatusBadge label="مكتمل" tone="success" /> : <StatusBadge label="متبقي" tone="muted" />}
                        </div>
                        <p className="text-brand-textMuted text-sm mb-3">{lesson.description ?? "درس تعليمي"}</p>
                        <p className="text-xs font-bold flex items-center gap-1.5 text-brand-primary">
                          {done ? <CheckCircle2 size={15} /> : <PlayCircle size={15} />}
                          {done ? "راجع الدرس مرة تانية" : "ابدأ الدرس"}
                        </p>
                      </GlassCard>
                    </Link>
                  );
                })}
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
