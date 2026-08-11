"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { useMobileMenu } from "@/hooks/useMobileMenu";

const teacherTabs = [
  { href: "/dashboard", label: "الرئيسية", icon: "🏠" },
  { href: "/students", label: "الطلاب", icon: "🎓" },
  { href: "/units", label: "الدروس", icon: "📚" },
  { href: "/assignments", label: "الواجبات", icon: "📝" },
];

const studentTabs = [
  { href: "/student/home", label: "الرئيسية", icon: "🏠" },
  { href: "/student/lessons", label: "دروسي", icon: "📚" },
  { href: "/student/assignments", label: "الواجبات", icon: "📝" },
  { href: "/student/results", label: "نتائجي", icon: "📊" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const { setOpen } = useMobileMenu();
  const isStudent = profile?.role === "student";
  const tabs = isStudent ? studentTabs : teacherTabs;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-black/5 flex items-stretch pb-[env(safe-area-inset-bottom)]">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={clsx(
            "flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px]",
            pathname === t.href ? "text-brand-primary" : "text-brand-textMuted"
          )}
        >
          <span className="text-lg">{t.icon}</span>
          <span>{t.label}</span>
        </Link>
      ))}
      <button
        onClick={() => setOpen(true)}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] text-brand-textMuted"
      >
        <span className="text-lg">☰</span>
        <span>المزيد</span>
      </button>
    </nav>
  );
}
