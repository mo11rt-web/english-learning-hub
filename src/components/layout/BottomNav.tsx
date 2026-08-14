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
  const tabs = profile?.role === "student" ? studentTabs : teacherTabs;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 px-3 md:hidden"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <nav
        className="grid overflow-hidden rounded-3xl border border-surfaceBorder/70 bg-surface/90 shadow-xl backdrop-blur-md"
        style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
        aria-label="التنقل الرئيسي"
      >
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={clsx(
              "flex min-h-[58px] touch-manipulation flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-bold transition active:scale-95",
              pathname === t.href ? "bg-brand-primary/10 text-brand-primary" : "text-brand-textMuted"
            )}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[58px] touch-manipulation flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-bold text-brand-textMuted transition active:scale-95"
          aria-label="فتح المزيد من الخيارات"
        >
          <span className="text-lg leading-none">☰</span>
          <span>المزيد</span>
        </button>
      </nav>
    </div>
  );
}
