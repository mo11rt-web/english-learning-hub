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

    // الطلاب: مخزّنون فعليًا داخل profiles بحقل role == "student"، وليس
    // بكوليكشن منفصل اسمه students — هذا الاستعلام يصحح ذلك ويقتصر على
    // طلاب القسم النشط فقط (نستثني المحذوفين)
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
      onSnapshot(collection(db, "attempts"), (s) =>
        setCounts((c) => ({
          ...c,
          ungradedAnswers: s.docs.filter((d) => d.data().status === "submitted").length,
        }))
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [stageId]);

  const shortcuts = [
    { href: "/units", label: "إضافة درس", icon: "📘" },
    { href: "/students", label: "إضافة طالب", icon: "🎓" },
    { href: "/assignments", label: "إنشاء واجب", icon: "📝" },
    { href: "/vocabulary", label: "إضافة كلمات", icon: "🔤" },
  ];

  return (
    <AppShell requireRole="teacher">
      <h1 className="text-2xl font-bold text-brand-text mb-1">
        لوحة التحكم
      </h1>
      <p className="text-brand-textMuted text-sm mb-6">القسم الحالي: {stageName ?? "—"}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="الطلاب النشطون" value={counts.students} icon="🎓" tone={0} />
        <StatCard label="المجموعات" value={counts.groups} icon="👥" tone={1} />
        <StatCard
          label="الدروس المنشورة"
          value={counts.publishedLessons}
          icon="📚"
          tone={2}
        />
        <StatCard
          label="واجبات تنتظر التصحيح"
          value={counts.ungradedAnswers}
          icon="✏️"
          tone={3}
        />
      </div>

      <GlassCard>
        <h2 className="font-bold text-brand-text mb-4">اختصارات سريعة</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface/60 hover:bg-surface transition-colors text-center"
            >
              <span className="text-2xl">{s.icon}</span>
              <span className="text-sm text-brand-text font-medium">
                {s.label}
              </span>
            </Link>
          ))}
        </div>
      </GlassCard>
    </AppShell>
  );
}
