"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { useAuth } from "@/hooks/useAuth";
import { listenCollection, where, orderBy } from "@/lib/firestore-helpers";
import { Announcement, Assignment, LeaderboardEntry, LeaderboardSettings, Lesson, StudentProfile } from "@/lib/types";
import { computeLevel } from "@/lib/gamification";
import { matchesStudentGroups } from "@/lib/groupTargeting";
import { studentLessonHref, studentAssignmentHref } from "@/lib/routes";

export default function StudentHomePage() {
  const { profile } = useAuth();
  const student = profile as StudentProfile | null;
  const [lessons, setLessons] = useState<(Lesson & { id: string })[]>([]);
  const [assignments, setAssignments] = useState<(Assignment & { id: string })[]>([]);
  const [announcements, setAnnouncements] = useState<(Announcement & { id: string })[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardSettings | null>(null);

  useEffect(() => {
    if (!student) return;
    const u1 = listenCollection<Lesson>(
      "lessons",
      [
        where("stageId", "==", student.stageId),
        where("status", "==", "published"),
      ],
      (all) => setLessons(all.filter((l) => matchesStudentGroups(l.targetGroupIds, student.groupIds)))
    );
    const u2 = listenCollection<Assignment>(
      "assignments",
      [where("status", "==", "published")],
      (all) => setAssignments(all.filter((a) => matchesStudentGroups(a.targetGroupIds, student.groupIds)))
    );
    const u3 = listenCollection<Announcement>(
      "announcements",
      [orderBy("createdAt", "desc")],
      (all) => {
        const now = Date.now();
        setAnnouncements(all.filter((announcement) =>
          (!announcement.stageId || announcement.stageId === student.stageId) &&
          (!announcement.status || announcement.status === "published") &&
          (!announcement.startAt || announcement.startAt <= now) &&
          (!announcement.endAt || announcement.endAt >= now) &&
          matchesStudentGroups(announcement.targetGroupIds, student.groupIds)
        ));
      }
    );
    const u4 = listenCollection<LeaderboardSettings>(
      "public_leaderboards",
      [where("enabled", "==", true)],
      (all) => setLeaderboard(all.find((item) => item.stageId === student.stageId) ?? null)
    );
    return () => { u1(); u2(); u3(); u4(); };
  }, [student]);

  if (!student) {
    return (
      <AppShell requireRole="student">
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary/25 border-t-brand-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell requireRole="student">
      <div className="rounded-glass bg-gradient-to-br from-brand-sidebar via-brand-sidebar to-brand-primary/40 text-white p-6 mb-6 shadow-glass">
        {(() => {
          const points = student.points ?? 0;
          const lvl = computeLevel(points);
          return (
            <>
              <p className="text-white/60 text-xs mb-1">نقاطك ومستواك</p>
              <p className="text-2xl font-bold mb-4">
                {points} نقطة <span className="text-white/70 text-base font-normal">· {lvl.name}</span>
              </p>
              {lvl.next && (
                <div>
                  <div className="flex justify-between text-xs text-white/60 mb-1">
                    <span>{lvl.name}</span>
                    <span>{lvl.next}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="bg-brand-goldLight h-2 rounded-full transition-all"
                      style={{ width: `${lvl.progressToNext}%` }}
                    />
                  </div>
                  <p className="text-xs text-white/60 mt-1">
                    {lvl.nextAt! - points > 0 ? `${lvl.nextAt! - points} نقطة للمستوى القادم` : ""}
                  </p>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {announcements.filter((announcement) => announcement.featured).slice(0, 1).map((announcement) => <a key={`featured-${announcement.id}`} href={announcement.linkUrl || "#announcements"} target={announcement.linkUrl ? "_blank" : undefined} rel={announcement.linkUrl ? "noreferrer" : undefined} className="block mb-6"><div className="overflow-hidden rounded-3xl bg-gradient-to-l from-brand-sidebar via-brand-primary to-brand-secondary text-white shadow-glass hover:shadow-xl transition-all">{announcement.imageUrl && <img src={announcement.imageUrl} alt="" className="w-full max-h-56 object-cover opacity-90" />}<div className="p-5"><div className="flex items-center gap-2 text-xs text-white/70 mb-2"><span>📣</span> إعلان مهم</div><h2 className="text-xl font-bold">{announcement.title}</h2><p className="text-sm text-white/80 mt-2 whitespace-pre-wrap">{announcement.body}</p></div></div></a>)}

      <div className="grid md:grid-cols-2 gap-6">
        <GlassCard>
          <h2 className="font-bold text-brand-text mb-4">📚 دروسي الجديدة</h2>
          <div className="flex flex-col gap-2">
            {lessons.slice(0, 5).map((l) => (
              <Link key={l.id} href={studentLessonHref(l.id)}
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
              <Link key={a.id} href={studentAssignmentHref(a.id)}
                className="px-3 py-2 rounded-xl bg-surface/60 hover:bg-surface text-sm text-brand-text">
                {a.title}
              </Link>
            ))}
            {assignments.length === 0 && <p className="text-brand-textMuted text-sm">لا واجبات حاليًا.</p>}
          </div>
        </GlassCard>

        <div id="announcements"><GlassCard className="md:col-span-2">
          <h2 className="font-bold text-brand-text mb-4">📣 إعلانات المنصة</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {announcements.slice(0, 4).map((announcement) => (
              <a key={announcement.id} href={announcement.linkUrl || "#"} target={announcement.linkUrl ? "_blank" : undefined} rel={announcement.linkUrl ? "noreferrer" : undefined} className="overflow-hidden rounded-2xl bg-surface/60 hover:bg-surface border border-brand-primary/10 transition-all">
                {announcement.imageUrl && <img src={announcement.imageUrl} alt="" className="w-full h-28 object-cover" />}
                <div className="p-3"><p className="font-bold text-brand-text">{announcement.title}</p><p className="text-brand-textMuted text-sm mt-1 whitespace-pre-wrap">{announcement.body}</p></div>
              </a>
            ))}
            {announcements.length === 0 && <p className="text-brand-textMuted text-sm">لا إعلانات منشورة حالياً.</p>}
          </div>
        </GlassCard>

        {leaderboard?.enabled && (() => {
          const studentGroupIds = student.groupIds ?? [];
          const groupFilteredEntries = (leaderboard.entries as (LeaderboardEntry & { groupIds?: string[] })[])
            .filter((entry) => {
              if (!entry.groupIds || entry.groupIds.length === 0) return true;
              return entry.groupIds.some((id) => studentGroupIds.includes(id));
            })
            .slice(0, 3);
          
          if (groupFilteredEntries.length === 0) return null;

          return (
            <GlassCard className="md:col-span-2 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-brand-text">🏆 نجوم هذا الشهر (مجموعتك)</h2>
                  <p className="text-xs text-brand-textMuted mt-1">المتنافسون الأوائل في مجموعتك التعليمية ⭐</p>
                </div>
                <span className="text-3xl">🏆</span>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {groupFilteredEntries.map((entry, idx) => (
                  <div key={`${idx}-${entry.studentName}`} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${idx === 0 ? "bg-brand-gold/15 ring-1 ring-brand-gold/30" : "bg-surface/60"}`}>
                    <span className="text-2xl">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                    <div className="min-w-0 flex-1">
                      <span className="block font-bold text-brand-text truncate">{entry.studentName}</span>
                      <span className="block text-xs text-brand-textMuted truncate">{entry.groupName ?? "مجموعتك"}</span>
                    </div>
                    <span className="text-sm font-bold text-brand-primary whitespace-nowrap">{entry.points} نقطة</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          );
        })()}
        </div>
      </div>
    </AppShell>
  );
}
