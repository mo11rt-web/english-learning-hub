"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, PlayCircle, BookOpen, Layers3, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CompactListRow } from "@/components/ui/CompactListRow";
import { useAuth } from "@/hooks/useAuth";
import { listenCollection, where } from "@/lib/firestore-helpers";
import { Lesson, StudentProfile, Unit } from "@/lib/types";
import { matchesStudentGroups, queryTargetGroupIds } from "@/lib/groupTargeting";

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
      [
        where("stageId", "==", student.stageId),
        where("status", "==", "published"),
        where("targetGroupIds", "array-contains-any", queryTargetGroupIds(student.groupIds)),
      ],
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
              <GlassCard className="!p-0 overflow-hidden mb-4 z-10 relative">
                <CompactListRow
                  avatarLabel={unit.title?.[0] ?? "و"}
                  title={unit.title}
                  subtitle={`${unitLessons.length} دروس · ${completedCount} مكتمل`}
                  badge={
                    <div className="flex flex-col items-end">
                      <span className={`font-extrabold text-sm ${complete ? "text-brand-success" : "text-brand-primary"}`}>{percentage}%</span>
                      <div className="w-16 h-1.5 rounded-full bg-surfaceBorder/40 mt-1 overflow-hidden">
                        <div className={`h-full rounded-full ${complete ? "bg-brand-success" : "bg-brand-primary"}`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  }
                  trailing={<ChevronDown size={18} className="text-brand-textMuted" />}
                />
              </GlassCard>

              <div className="relative mr-3 md:mr-8 pr-5 md:pr-7 border-r-2 border-surfaceBorder/60 pb-8">
                {/* الخط العمودي: الجزء المكتمل يتلوّن بنجاح فوق خط رمادي محايد —
                    النسبة محسوبة من completedCount/unitLessons.length الموجودة
                    أصلاً فوق (سطر 88)، بلا أي state أو بيانات جديدة. */}
                <div
                  className="absolute right-[-3px] top-0 w-1 rounded-full bg-gradient-to-b from-brand-success to-brand-secondary transition-all duration-500"
                  style={{ height: `${percentage}%`, maxHeight: "calc(100% - 1rem)" }}
                />
                <div className="grid gap-3">
                  {(() => {
                    // "الدرس الحالي" = أول درس غير مكتمل بترتيب الوحدة — حساب
                    // بصري بحت من completedIds الموجودة أصلاً، بلا أي استعلام
                    // أو حالة إضافية.
                    const currentLessonId = unitLessons.find((l) => !completedIds.has(l.id))?.id;
                    return unitLessons.map((lesson, lessonIndex) => {
                      const done = completedIds.has(lesson.id);
                      const isCurrent = !done && lesson.id === currentLessonId;
                      return (
                        <Link key={lesson.id} href={`/student/lessons/${lesson.id}`} className="relative block before:absolute before:right-[-29px] md:before:right-[-36px] before:top-1/2 before:w-6 md:before:w-7 before:h-0.5 before:bg-surfaceBorder/60">
                          <div
                            className={`relative rounded-2xl border bg-surface/70 px-4 py-4 md:px-5 transition-all hover:-translate-x-1 hover:shadow-md ${
                              done
                                ? "border-brand-success/35"
                                : isCurrent
                                ? "border-brand-primary/60 ring-1 ring-brand-primary/20 shadow-sm"
                                : "border-surfaceBorder/70 opacity-70"
                            }`}
                          >
                            <div
                              className={`absolute right-[-9px] top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-4 border-app-bg shadow-sm ${
                                done ? "bg-brand-success" : isCurrent ? "bg-brand-primary animate-pulse" : "bg-brand-textMuted/40"
                              }`}
                            />
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <span
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                                    done
                                      ? "bg-brand-success/15 text-brand-success"
                                      : isCurrent
                                      ? "bg-brand-primary/15 text-brand-primary"
                                      : "bg-surfaceBorder/50 text-brand-textMuted"
                                  }`}
                                >
                                  {lessonIndex + 1}
                                </span>
                                <div className="min-w-0">
                                  <p className={`text-[10px] font-bold mb-0.5 ${isCurrent ? "text-brand-primary" : "text-brand-textMuted"}`}>درس {lessonIndex + 1} من الوحدة</p>
                                  <h3 className="font-bold text-brand-text truncate">{lesson.title}</h3>
                                </div>
                              </div>
                              {done ? (
                                <StatusBadge label="مكتمل" tone="success" />
                              ) : isCurrent ? (
                                <StatusBadge label="التالي" tone="primary" />
                              ) : (
                                <StatusBadge label="متبقي" tone="muted" />
                              )}
                            </div>
                            <p className="text-brand-textMuted text-xs mt-2 mr-11 truncate">{lesson.description ?? "درس تعليمي"}</p>
                            <p className={`text-xs font-bold flex items-center gap-1.5 mt-3 mr-11 ${isCurrent ? "text-brand-primary" : "text-brand-textMuted"}`}>
                              {done ? <CheckCircle2 size={15} /> : <PlayCircle size={15} />}
                              {done ? "راجع الدرس مرة تانية" : "ابدأ الدرس"}
                            </p>
                          </div>
                        </Link>
                      );
                    });
                  })()}
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
