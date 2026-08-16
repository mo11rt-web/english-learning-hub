"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Home, GraduationCap, BookOpen, ClipboardList, BarChart3, Menu, MessageCircle, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMobileMenu } from "@/hooks/useMobileMenu";

const teacherTabs: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "الرئيسية", icon: Home },
  { href: "/students", label: "الطلاب", icon: GraduationCap },
  { href: "/units", label: "الدروس", icon: BookOpen },
  { href: "/assignments", label: "الواجبات", icon: ClipboardList },
  { href: "/inquiries", label: "الأسئلة", icon: MessageCircle },
];

const studentTabs: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/student/home", label: "الرئيسية", icon: Home },
  { href: "/student/lessons", label: "دروسي", icon: BookOpen },
  { href: "/student/assignments", label: "الواجبات", icon: ClipboardList },
  { href: "/student/inquiries", label: "أسئلتي", icon: MessageCircle },
  { href: "/student/results", label: "نتائجي", icon: BarChart3 },
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
      className="md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pointer-events-none"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <nav
        className="pointer-events-auto grid rounded-3xl border border-surfaceBorder/60 bg-surface/90 backdrop-blur-xl shadow-glass"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {tabs.map((t) => {
          const active = pathname === t.href;
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={clsx(
                "flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] text-[11px] font-bold transition-colors",
                active ? "text-brand-primary" : "text-brand-textMuted"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              <span>{t.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[52px] text-[11px] font-bold text-brand-textMuted"
        >
          <Menu size={20} />
          <span>المزيد</span>
        </button>
      </nav>
    </div>
  );
}
