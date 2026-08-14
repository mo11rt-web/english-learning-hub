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
  const cols = tabs.length + 1;

  return (
    <div
      className="md:hidden fixed inset-x-0 bottom-0 z-40 px-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <nav
        className="grid rounded-3xl border border-surfaceBorder/60 bg-surface/90 backdrop-blur-xl shadow-glass"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={clsx(
                "flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] text-[11px] font-bold transition-colors",
                active ? "text-brand-primary" : "text-brand-textMuted"
              )}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] text-[11px] font-bold text-brand-textMuted"
        >
          <span className="text-lg leading-none">☰</span>
          <span>المزيد</span>
        </button>
      </nav>
    </div>
  );
}
