"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";

const teacherLinks = [
  { href: "/dashboard", label: "الرئيسية", icon: "🏠" },
  { href: "/students", label: "الطلاب", icon: "🎓" },
  { href: "/groups", label: "المجموعات والصفوف", icon: "👥" },
  { href: "/units", label: "الوحدات والدروس", icon: "📚" },
  { href: "/vocabulary", label: "الكلمات", icon: "🔤" },
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
  { href: "/student/assignments", label: "الواجبات", icon: "📝" },
  { href: "/student/past-exams", label: "أسئلة الدورات السابقة", icon: "🗂️" },
  { href: "/student/results", label: "نتائجي", icon: "📊" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const isStudent = profile?.role === "student";
  const links = isStudent ? studentLinks : teacherLinks;

  return (
    <aside className="w-64 shrink-0 min-h-screen bg-brand-sidebar text-white flex flex-col p-4 gap-2">
      <div className="px-2 py-4 mb-2">
        <h1 className="font-bold text-lg">English Learning Hub</h1>
        <p className="text-xs text-white/60 mt-1">
          {profile?.fullName ?? "..."}
        </p>
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
              pathname === l.href
                ? "bg-white/15 font-semibold"
                : "hover:bg-white/10 text-white/85"
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
    </aside>
  );
}
