"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatCard } from "@/components/ui/StatCard";
import Link from "next/link";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function DashboardPage() {
  const { stageId, stageName } = useWorkspace();
  const [counts, setCounts] = useState({
    students: 0,
    groups: 0,
    publishedLessons: 0,
    ungradedAnswers: 0,
  });

  useEffect(() => {
    if (!stageId) return;

    // Every live listener is scoped to the selected section. This is both a
    // privacy improvement and a direct reduction in free Firestore reads.
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
    const attemptsQ = query(collection(db, "attempts"), where("stageId", "==", stageId));

    const unsubs = [
      onSnapshot(studentsQ, (s) =>
        setCounts((c) => ({
          ...c,
          students: s.docs.filter((d) => d.data().status !== "deleted").length,
        }))
      ),
      onSnapshot(groupsQ, (s) => setCounts((c) => ({ ...c, groups: s.size }))),
      onSnapshot(lessonsQ, (s) =>
        setCounts((c) => ({ ...c, publishedLessons: s.size }))
      ),
      onSnapshot(attemptsQ, (s) =>
        setCounts((c) => ({
          ...c,
          ungradedAnswers: s.docs.filter((d) => d.data().status === "submitted").length,
        }))
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [stageId]);

  const shortcuts = [
    { href: "/students", label: "إدارة الطلاب", hint: "إضافة، تعديل، مجموعات", icon: "🎓" },
    { href: "/units", label: "بناء درس", hint: "وحدات ومحتوى تعليمي", icon: "📘" },
    { href: "/assignments", label: "إنشاء واجب", hint: "اختبار أو واجب مستهدف", icon: "📝" },
    { href: "/groups", label: "تنظيم المجموعات", hint: "تقسيم الطلاب ومتابعتهم", icon: "👥" },
  ];

  return (
    <AppShell requireRole="teacher">
      <section className="mb-6 flex flex-col gap-4 rounded-3xl bg-brand-sidebar p-5 text-white shadow-lg md:flex-row md:items-center md:justify-between md:p-7">
        <div>
          <p className="mb-2 text-xs font-bold text-brand-secondary">مركز عمل المدرس</p>
          <h1 className="text-2xl font-extrabold md:text-3xl">لوحة التحكم</h1>
          <p className="mt-2 text-sm text-white/70">القسم الحالي: {stageName ?? "—"}</p>
        </div>
        <Link
          href="/workspace?from=/dashboard"
          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white/10 px-4 text-sm font-bold transition hover:bg-white/20 active:scale-[0.98]"
        >
          تبديل القسم
        </Link>
      </section>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="الطلاب النشطون" value={counts.students} icon="🎓" tone={0} />
        <StatCard label="المجموعات" value={counts.groups} icon="👥" tone={1} />
        <StatCard label="الدروس المنشورة" value={counts.publishedLessons} icon="📚" tone={2} />
        <StatCard label="تسليمات تنتظر التصحيح" value={counts.ungradedAnswers} icon="✏️" tone={3} />
      </div>

      <GlassCard className="mb-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-extrabold text-brand-text">ابدأ من هنا</h2>
            <p className="mt-1 text-xs text-brand-textMuted">اختصارات للأعمال اليومية الأكثر استخدامًا</p>
          </div>
          <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-[11px] font-bold text-brand-primary">القسم الحالي</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group rounded-2xl border border-surfaceBorder/60 bg-surface/60 p-4 transition hover:-translate-y-0.5 hover:border-brand-primary/40 hover:shadow-md active:scale-[0.98]"
            >
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-primary/10 text-2xl transition group-hover:scale-105">{s.icon}</div>
              <p className="font-bold text-brand-text">{s.label}</p>
              <p className="mt-1 text-xs text-brand-textMuted">{s.hint}</p>
            </Link>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-extrabold text-brand-text">تركيز هذا الإصدار</h2>
            <p className="mt-1 text-sm leading-6 text-brand-textMuted">كل شاشة داخل القسم الحالي، وكل عملية جديدة، يجب أن تبقى مرتبطة بالقسم حتى لا تختلط بيانات الطلاب والمحتوى.</p>
          </div>
          <Link href="/students" className="shrink-0 rounded-2xl bg-brand-primary px-4 py-3 text-center text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.98]">فتح الطلاب</Link>
        </div>
      </GlassCard>
    </AppShell>
  );
}
