"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { useAuth } from "@/hooks/useAuth";
import { listenCollection, where, orderBy } from "@/lib/firestore-helpers";
import { Lesson, Assignment, Announcement, StudentProfile } from "@/lib/types";
import { computeLevel } from "@/lib/gamification";

export default function StudentHomePage() {
  const { profile } = useAuth();
  const student = profile as StudentProfile | null;
  const [lessons, setLessons] = useState<(Lesson & { id: string })[]>([]);
  const [assignments, setAssignments] = useState<(Assignment & { id: string })[]>([]);
  const [announcements, setAnnouncements] = useState<(Announcement & { id: string })[]>([]);

  useEffect(() => {
    if (!student) return;
    const u1 = listenCollection<Lesson>(
      "lessons",
      [where("stageId", "==", student.stageId), where("status", "==", "published")],
      setLessons
    );
    const u2 = listenCollection<Assignment>(
      "assignments",
      [where("status", "==", "published")],
      (all) =>
        setAssignments(
          all.filter(
            (a) =>
              a.targetGroupIds.length === 0 ||
              a.targetGroupIds.some((g) => student.groupIds?.includes(g))
          )
        )
    );
    const u3 = listenCollection<Announcement>(
      "announcements",
      [orderBy("createdAt", "desc")],
      (all) =>
        setAnnouncements(
          all.filter(
            (a) =>
              a.targetGroupIds.length === 0 ||
              a.targetGroupIds.some((g) => student.groupIds?.includes(g))
          )
        )
    );
    return () => { u1(); u2(); u3(); };
  }, [student]);

  if (!student) {
    return <AppShell requireRole="student"><p>جاري التحميل...</p></AppShell>;
  }

  return (
    <AppShell requireRole="student">
      <h1 className="text-2xl font-bold text-brand-text mb-2">
        مرحبًا، {student.fullName} 👋
      </h1>
      <p className="text-brand-textMuted mb-6">استمر في التعلم اليوم!</p>

      <GlassCard className="mb-6">
        {(() => {
          const points = student.points ?? 0;
          const lvl = computeLevel(points);
          return (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-brand-textMuted mb-1">نقاطك ومستواك</p>
                <p className="text-2xl font-bold text-brand-primary">
                  {points} نقطة <span className="text-brand-text text-base">· {lvl.name}</span>
                </p>
              </div>
              {lvl.next && (
                <div className="flex-1 min-w-[160px]">
                  <div className="flex justify-between text-xs text-brand-textMuted mb-1">
                    <span>{lvl.name}</span>
                    <span>{lvl.next}</span>
                  </div>
                  <div className="w-full bg-surfaceBorder/40 rounded-full h-2">
                    <div
                      className="bg-brand-primary h-2 rounded-full transition-all"
                      style={{ width: `${lvl.progressToNext}%` }}
                    />
                  </div>
                  <p className="text-xs text-brand-textMuted mt-1">
                    {lvl.nextAt! - points > 0 ? `${lvl.nextAt! - points} نقطة للمستوى القادم` : ""}
                  </p>
                </div>
              )}
            </div>
          );
        })()}
      </GlassCard>

      <div className="grid md:grid-cols-2 gap-6">
        <GlassCard>
          <h2 className="font-bold text-brand-text mb-4">📚 دروسي الجديدة</h2>
          <div className="flex flex-col gap-2">
            {lessons.slice(0, 5).map((l) => (
              <Link key={l.id} href={`/student/lessons/${l.id}`}
                className="px-3 py-2 rounded-xl bg-surface/60 hover:bg-surface text-sm text-brand-text">
                {l.title}
              </Link>
            ))}
            {lessons.length === 0 && <p className="text-brand-textMuted text-sm">لا دروس منشورة بعد.</p>}
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="font-bold text-brand-text mb-4">📝 الواجبات الحالية</h2>
          <div className="flex flex-col gap-2">
            {assignments.slice(0, 5).map((a) => (
              <Link key={a.id} href={`/student/assignments/${a.id}`}
                className="px-3 py-2 rounded-xl bg-surface/60 hover:bg-surface text-sm text-brand-text">
                {a.title}
              </Link>
            ))}
            {assignments.length === 0 && <p className="text-brand-textMuted text-sm">لا واجبات حاليًا.</p>}
          </div>
        </GlassCard>

        <GlassCard className="md:col-span-2">
          <h2 className="font-bold text-brand-text mb-4">📣 الإعلانات</h2>
          <div className="flex flex-col gap-2">
            {announcements.slice(0, 3).map((a) => (
              <div key={a.id} className="px-3 py-2 rounded-xl bg-surface/60 text-sm">
                <p className="font-medium text-brand-text">{a.title}</p>
                <p className="text-brand-textMuted">{a.body}</p>
              </div>
            ))}
            {announcements.length === 0 && <p className="text-brand-textMuted text-sm">لا إعلانات بعد.</p>}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
