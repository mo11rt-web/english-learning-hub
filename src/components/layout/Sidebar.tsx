"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMobileMenu } from "@/hooks/useMobileMenu";
import { useTheme } from "@/hooks/useTheme";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";

const teacherLinks = [
  { href: "/dashboard", label: "الرئيسية", icon: "🏠" },
  { href: "/students", label: "الطلاب", icon: "🎓" },
  { href: "/groups", label: "المجموعات والصفوف", icon: "👥" },
  { href: "/units", label: "الوحدات والدروس", icon: "📚" },
  { href: "/vocabulary", label: "الكلمات", icon: "🔤" },
  { href: "/irregular-verbs", label: "الأفعال الشاذة", icon: "🔁" },
  { href: "/files", label: "الملفات", icon: "📎" },
  { href: "/questions", label: "بنك الأسئلة", icon: "❓" },
  { href: "/past-exams", label: "أسئلة الدورات السابقة", icon: "🗂️" },
  { href: "/assignments", label: "الواجبات والاختبارات", icon: "📝" },
  { href: "/announcements", label: "الإعلانات", icon: "📣" },
  { href: "/settings", label: "إعدادات النقاط", icon: "⚙️" },
];

const studentLinks = [
  { href: "/student/home", label: "الرئيسية", icon: "🏠" },
  { href: "/student/lessons", label: "دروسي", icon: "📚" },
  { href: "/student/vocabulary", label: "الكلمات", icon: "🔤" },
  { href: "/student/irregular-verbs", label: "الأفعال الشاذة", icon: "🔁" },
  { href: "/student/assignments", label: "الواجبات", icon: "📝" },
  { href: "/student/past-exams", label: "أسئلة الدورات السابقة", icon: "🗂️" },
  { href: "/student/results", label: "نتائجي", icon: "📊" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { stageName } = useWorkspace();
  const { setOpen } = useMobileMenu();
  const { theme, toggleTheme } = useTheme();
  const isStudent = profile?.role === "student";
  const links = isStudent ? studentLinks : teacherLinks;

  return (
    <aside className="w-64 shrink-0 min-h-screen bg-brand-sidebar text-white flex flex-col p-4 gap-2 overflow-y-auto">
      <div className="px-2 py-4 mb-2">
        <h1 className="font-bold text-lg leading-tight" dir="ltr">
          Learn <span className="text-brand-secondary">English</span>
        </h1>
        <p className="text-[10px] text-white/50" dir="ltr">with Mohanad Allawi</p>
        <p className="text-xs text-white/60 mt-1">
          {profile?.fullName ?? "..."}
        </p>
      </div>
      {!isStudent && (
        <Link
          href={`/workspace?from=${encodeURIComponent(pathname)}`}
          onClick={() => setOpen(false)}
          className="flex items-center justify-between px-3.5 py-3 mb-2 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 text-sm min-h-[48px]"
        >
          <span className="truncate">📂 {stageName ?? "اختر القسم"}</span>
          <span className="text-xs text-brand-goldLight shrink-0 font-bold">تبديل</span>
        </Link>
      )}
      <nav className="flex flex-col gap-1 flex-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            className={clsx(
              "flex items-center gap-3 px-3.5 py-2.5 min-h-[46px] rounded-xl text-sm transition-colors",
              pathname === l.href
                ? "bg-gradient-to-l from-brand-primary to-brand-secondary text-white font-bold shadow-md"
                : "hover:bg-white/10 active:bg-white/15 text-white/85"
            )}
          >
            <span>{l.icon}</span>
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>
      <button
        onClick={() => signOut()}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-white/10 text-white/85"
      >
        <span>🚪</span>
        <span>تسجيل الخروج</span>
      </button>
      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-white/85 mt-1">
        <span className="flex items-center gap-2">
          <span>{theme === "dark" ? "🌙" : "☀️"}</span>
          <span>الوضع الداكن</span>
        </span>
        <ToggleSwitch checked={theme === "dark"} onChange={toggleTheme} />
      </div>
    </aside>
  );
}
