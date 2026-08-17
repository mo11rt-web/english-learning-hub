"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { X, ArrowUpLeft, Users, BookOpen, GraduationCap, ClipboardCheck } from "lucide-react";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatCard } from "@/components/ui/StatCard";
import Link from "next/link";
import { useWorkspace } from "@/hooks/useWorkspace";
import { formatSyrianDate } from "@/lib/dateUtils";

type DetailKey = "students" | "groups" | "lessons" | "pending";

type StudentSummary = {
  id: string;
  fullName: string;
  groupIds: string[];
  lastActivityAt?: number;
};

type GroupSummary = {
  id: string;
  name: string;
};

type LessonSummary = {
  id: string;
  title: string;
  unitId: string;
};

type PendingSummary = {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  studentName: string;
  studentId: string;
  submittedAt?: number;
};

function formatDate(timestamp?: number) {
  return timestamp ? formatSyrianDate(timestamp) : "غير متوفر";
}

export default function DashboardPage() {
  const { stageId, stageName } = useWorkspace();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [publishedLessons, setPublishedLessons] = useState<LessonSummary[]>([]);
  const [units, setUnits] = useState<{ id: string; title: string }[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [attempts, setAttempts] = useState<PendingSummary[]>([]);
  const [activeDetail, setActiveDetail] = useState<DetailKey | null>(null);

  useEffect(() => {
    if (!stageId) return;

    const studentsQ = query(
      collection(db, "profiles"),
      where("role", "==", "student"),
      where("stageId", "==", stageId)
    );
    const groupsQ = query(collection(db, "groups"), where("stageId", "==", stageId));
    const lessonsQ = query(
      collection(db, "lessons"),
      where("stageId", "==", stageId),
      where("status", "==", "published")
    );
    const unitsQ = query(collection(db, "units"), where("stageId", "==", stageId));

    const unsubs = [
      onSnapshot(studentsQ, (snapshot) => {
        setStudents(
          snapshot.docs
            .filter((item) => item.data().status !== "deleted")
            .map((item) => {
              const data = item.data();
              return {
                id: item.id,
                fullName: data.fullName ?? "طالب بدون اسم",
                groupIds: Array.isArray(data.groupIds) ? data.groupIds : [],
                lastActivityAt: data.lastActivityAt ?? data.lastLoginAt,
              };
            })
        );
      }),
      onSnapshot(groupsQ, (snapshot) => {
        setGroups(snapshot.docs.map((item) => ({ id: item.id, name: item.data().name ?? "مجموعة بدون اسم" })));
      }),
      onSnapshot(lessonsQ, (snapshot) => {
        setPublishedLessons(
          snapshot.docs
            .map((item) => ({
              id: item.id,
              title: item.data().title ?? "درس بدون عنوان",
              unitId: item.data().unitId ?? "",
            }))
            .sort((a, b) => a.title.localeCompare(b.title, "ar"))
        );
      }),
      onSnapshot(unitsQ, (snapshot) => {
        setUnits(snapshot.docs.map((item) => ({ id: item.id, title: item.data().title ?? "وحدة بدون عنوان" })));
      }),
      onSnapshot(collection(db, "assignments"), (snapshot) => {
        const next: Record<string, string> = {};
        snapshot.docs.forEach((item) => {
          next[item.id] = item.data().title ?? "واجب بدون عنوان";
        });
        setAssignments(next);
      }),
      onSnapshot(collection(db, "attempts"), (snapshot) => {
        setAttempts(
          snapshot.docs
            .filter((item) => item.data().status === "submitted")
            .map((item) => {
              const data = item.data();
              return {
                id: item.id,
                assignmentId: data.assignmentId ?? "",
                assignmentTitle: "",
                studentName: "",
                studentId: data.studentId ?? "",
                submittedAt: data.submittedAt,
              };
            })
        );
      }),
    ];

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [stageId]);

  const groupNames = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);
  const studentNames = useMemo(() => new Map(students.map((student) => [student.id, student.fullName])), [students]);
  const unitNames = useMemo(() => new Map(units.map((unit) => [unit.id, unit.title])), [units]);

  const activeStudents = students;
  const groupDetails = useMemo(
    () => groups.map((group) => ({ ...group, studentCount: students.filter((student) => student.groupIds.includes(group.id)).length })),
    [groups, students]
  );
  const lessonDetails = publishedLessons;
  const pendingDetails = useMemo(
    () => attempts.map((attempt) => ({
      ...attempt,
      assignmentTitle: assignments[attempt.assignmentId] ?? "واجب غير معروف",
      studentName: studentNames.get(attempt.studentId) ?? "طالب غير معروف",
    })),
    [attempts, assignments, studentNames]
  );

  const counts = {
    students: activeStudents.length,
    groups: groups.length,
    publishedLessons: lessonDetails.length,
    ungradedAnswers: pendingDetails.length,
  };

  const toggleDetail = (key: DetailKey) => {
    setActiveDetail((current) => (current === key ? null : key));
  };

  const selectedTitle = activeDetail === "students"
    ? "الطلاب النشطون"
    : activeDetail === "groups"
      ? "المجموعات"
      : activeDetail === "lessons"
        ? "الدروس المنشورة"
        : "واجبات تنتظر التصحيح";

  const shortcuts = [
    { href: "/units", label: "إضافة درس", icon: "📘" },
    { href: "/students", label: "إضافة طالب", icon: "🎓" },
    { href: "/assignments", label: "إنشاء واجب", icon: "📝" },
    { href: "/vocabulary", label: "إضافة كلمات", icon: "🔤" },
  ];

  return (
    <AppShell requireRole="teacher">
      <div className="rounded-glass bg-gradient-to-br from-brand-sidebar via-brand-sidebar to-brand-primary/40 text-white p-6 mb-6 shadow-glass relative overflow-hidden">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-white/60 text-xs mb-1">القسم الحالي</p>
            <h1 className="text-2xl font-bold">{stageName ?? "—"}</h1>
          </div>
          <Link
            href={`/workspace?from=/dashboard`}
            className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full shrink-0"
          >
            تبديل القسم
          </Link>
        </div>
        <div className="flex items-center gap-6 border-t border-white/10 pt-4">
          <div>
            <p className="text-white/60 text-xs mb-0.5">الطلاب النشطون</p>
            <p className="text-2xl font-bold text-brand-goldLight">{counts.students}</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div>
            <p className="text-white/60 text-xs mb-0.5">المجموعات</p>
            <p className="text-2xl font-bold text-brand-goldLight">{counts.groups}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatCard label="الطلاب النشطون" value={counts.students} icon="🎓" tone={0} active={activeDetail === "students"} onClick={() => toggleDetail("students")} />
        <StatCard label="المجموعات" value={counts.groups} icon="👥" tone={1} active={activeDetail === "groups"} onClick={() => toggleDetail("groups")} />
        <StatCard label="الدروس المنشورة" value={counts.publishedLessons} icon="📚" tone={2} active={activeDetail === "lessons"} onClick={() => toggleDetail("lessons")} />
        <StatCard label="واجبات تنتظر التصحيح" value={counts.ungradedAnswers} icon="✏️" tone={3} active={activeDetail === "pending"} onClick={() => toggleDetail("pending")} />
      </div>

      {activeDetail && (
        <GlassCard className="mb-8 animate-fade-up overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-surfaceBorder pb-3 mb-3">
            <div className="flex items-center gap-2">
              {activeDetail === "students" && <GraduationCap size={19} className="text-brand-primary" />}
              {activeDetail === "groups" && <Users size={19} className="text-brand-primary" />}
              {activeDetail === "lessons" && <BookOpen size={19} className="text-brand-primary" />}
              {activeDetail === "pending" && <ClipboardCheck size={19} className="text-brand-primary" />}
              <h2 className="font-bold text-brand-text">تفاصيل {selectedTitle}</h2>
            </div>
            <button type="button" onClick={() => setActiveDetail(null)} aria-label="إغلاق التفاصيل" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-brand-textMuted hover:bg-surfaceBorder/50 hover:text-brand-text transition-colors">
              <X size={18} />
            </button>
          </div>

          {activeDetail === "students" && (
            activeStudents.length > 0 ? (
              <div className="divide-y divide-surfaceBorder/60 max-h-80 overflow-y-auto">
                {activeStudents.map((student) => (
                  <Link key={student.id} href="/students" className="flex items-center justify-between gap-3 py-3 hover:bg-surface/60 px-2 rounded-xl transition-colors">
                    <div className="min-w-0">
                      <p className="font-medium text-brand-text truncate">{student.fullName}</p>
                      <p className="text-xs text-brand-textMuted mt-1">{student.groupIds.map((id) => groupNames.get(id)).filter(Boolean).join("، ") || "دون مجموعة"}</p>
                    </div>
                    <span className="text-xs text-brand-textMuted shrink-0">آخر نشاط: {formatDate(student.lastActivityAt)} <ArrowUpLeft size={13} className="inline-block mr-1" /></span>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-brand-textMuted py-4">لا يوجد طلاب نشطون في هذا القسم.</p>
          )}

          {activeDetail === "groups" && (
            groupDetails.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-2">
                {groupDetails.map((group) => (
                  <Link key={group.id} href="/groups" className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface/60 hover:bg-surface transition-colors">
                    <span className="text-brand-text font-medium">{group.name}</span>
                    <span className="text-xs text-brand-textMuted">{group.studentCount} طالب <ArrowUpLeft size={13} className="inline-block mr-1" /></span>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-brand-textMuted py-4">لا توجد مجموعات في هذا القسم.</p>
          )}

          {activeDetail === "lessons" && (
            lessonDetails.length > 0 ? (
              <div className="divide-y divide-surfaceBorder/60 max-h-80 overflow-y-auto">
                {lessonDetails.map((lesson) => (
                  <Link key={lesson.id} href={`/lessons/${lesson.id}`} className="flex items-center justify-between gap-3 py-3 px-2 rounded-xl hover:bg-surface/60 transition-colors">
                    <div className="min-w-0">
                      <p className="font-medium text-brand-text truncate">{lesson.title}</p>
                      <p className="text-xs text-brand-textMuted mt-1">الوحدة: {unitNames.get(lesson.unitId) ?? "غير محددة"}</p>
                    </div>
                    <ArrowUpLeft size={15} className="text-brand-primary shrink-0" />
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-brand-textMuted py-4">لا توجد دروس منشورة في هذا القسم.</p>
          )}

          {activeDetail === "pending" && (
            pendingDetails.length > 0 ? (
              <div className="divide-y divide-surfaceBorder/60 max-h-80 overflow-y-auto">
                {pendingDetails.map((item) => (
                  <Link key={item.id} href={`/assignments/${item.assignmentId}/grade`} className="flex items-center justify-between gap-3 py-3 px-2 rounded-xl hover:bg-surface/60 transition-colors">
                    <div className="min-w-0">
                      <p className="font-medium text-brand-text truncate">{item.assignmentTitle}</p>
                      <p className="text-xs text-brand-textMuted mt-1">الطالب: {item.studentName}</p>
                    </div>
                    <span className="text-xs text-brand-warning shrink-0">بانتظار التصحيح <ArrowUpLeft size={13} className="inline-block mr-1" /></span>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-brand-textMuted py-4">لا توجد تسليمات بانتظار التصحيح.</p>
          )}
        </GlassCard>
      )}

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <GlassCard className="md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-brand-text flex items-center gap-2">
              📊 التقرير الأسبوعي للحضور والأداء (آخر 7 أيام)
            </h2>
            <span className="text-xs bg-brand-primary/10 text-brand-primary px-2.5 py-1 rounded-lg font-medium">محدث تلقائياً</span>
          </div>
          <p className="text-xs text-brand-textMuted mb-4">
            ملخص تفصيلي لنشاط الطلاب في القسم الحالي، يوضح معدل تسجيل الدخول والنشاط، متوسط النقاط المكتسبة، والتسليمات الأسبوعية.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface/70 rounded-2xl p-3 border border-surfaceBorder/60 text-center">
              <p className="text-[11px] text-brand-textMuted mb-1">الطلاب النشطون هذا الأسبوع</p>
              <p className="text-xl font-bold text-brand-primary">
                {students.filter(s => s.lastActivityAt && (Date.now() - s.lastActivityAt) <= 7 * 24 * 60 * 60 * 1000).length} <span className="text-xs text-brand-textMuted">/ {students.length}</span>
              </p>
            </div>
            <div className="bg-surface/70 rounded-2xl p-3 border border-surfaceBorder/60 text-center">
              <p className="text-[11px] text-brand-textMuted mb-1">تسليمات الواجبات (الأسبوع)</p>
              <p className="text-xl font-bold text-brand-success">
                {attempts.filter(a => a.submittedAt && (Date.now() - a.submittedAt) <= 7 * 24 * 60 * 60 * 1000).length}
              </p>
            </div>
            <div className="bg-surface/70 rounded-2xl p-3 border border-surfaceBorder/60 text-center">
              <p className="text-[11px] text-brand-textMuted mb-1">إجمالي نقاط الطلاب</p>
              <p className="text-xl font-bold text-brand-gold">
                {students.reduce((acc, s: any) => acc + (s.points ?? 0), 0)}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="font-bold text-brand-text mb-4">اختصارات سريعة</h2>
          <div className="grid grid-cols-2 gap-3">
            {shortcuts.map((shortcut) => (
              <Link
                key={shortcut.href}
                href={shortcut.href}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface/60 hover:bg-surface active:scale-95 transition-all text-center"
              >
                <span className="text-xl">{shortcut.icon}</span>
                <span className="text-xs text-brand-text font-medium">{shortcut.label}</span>
              </Link>
            ))}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
