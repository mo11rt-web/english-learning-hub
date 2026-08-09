"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatCard } from "@/components/ui/StatCard";
import Link from "next/link";

export default function DashboardPage() {
  const [counts, setCounts] = useState({
    students: 0,
    groups: 0,
    publishedLessons: 0,
    ungradedAnswers: 0,
  });

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "students"), (s) =>
        setCounts((c) => ({ ...c, students: s.size }))
      ),
      onSnapshot(collection(db, "groups"), (s) =>
        setCounts((c) => ({ ...c, groups: s.size }))
      ),
      onSnapshot(collection(db, "lessons"), (s) =>
        setCounts((c) => ({
          ...c,
          publishedLessons: s.docs.filter(
            (d) => d.data().status === "published"
          ).length,
        }))
      ),
      onSnapshot(collection(db, "attempts"), (s) =>
        setCounts((c) => ({
          ...c,
          ungradedAnswers: s.docs.filter((d) => d.data().status === "submitted")
            .length,
        }))
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const shortcuts = [
    { href: "/units", label: "إضافة درس", icon: "📘" },
    { href: "/students", label: "إضافة طالب", icon: "🎓" },
    { href: "/assignments", label: "إنشاء واجب", icon: "📝" },
    { href: "/vocabulary", label: "إضافة كلمات", icon: "🔤" },
  ];

  return (
    <AppShell requireRole="teacher">
      <h1 className="text-2xl font-bold text-brand-text mb-6">
        لوحة التحكم
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="الطلاب النشطون" value={counts.students} icon="🎓" />
        <StatCard label="المجموعات" value={counts.groups} icon="👥" />
        <StatCard
          label="الدروس المنشورة"
          value={counts.publishedLessons}
          icon="📚"
        />
        <StatCard
          label="واجبات تنتظر التصحيح"
          value={counts.ungradedAnswers}
          icon="✏️"
        />
      </div>

      <GlassCard>
        <h2 className="font-bold text-brand-text mb-4">اختصارات سريعة</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/60 hover:bg-white transition-colors text-center"
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
