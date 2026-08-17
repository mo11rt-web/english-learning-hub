"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Home, GraduationCap, Users, BookOpen, Type, RotateCcw, Paperclip,
  HelpCircle, FolderArchive, ClipboardList, Megaphone, Settings, MessageCircle,
  BarChart3, LogOut, FolderOpen, Sun, Moon, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useMobileMenu } from "@/hooks/useMobileMenu";
import { useTheme } from "@/hooks/useTheme";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";

const teacherLinks: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "الرئيسية", icon: Home },
  { href: "/students", label: "الطلاب", icon: GraduationCap },
  { href: "/groups", label: "المجموعات والصفوف", icon: Users },
  { href: "/units", label: "الوحدات والدروس", icon: BookOpen },
  { href: "/vocabulary", label: "الكلمات", icon: Type },
  { href: "/irregular-verbs", label: "الأفعال الشاذة", icon: RotateCcw },
  { href: "/files", label: "الملفات", icon: Paperclip },
  { href: "/questions", label: "بنك الأسئلة", icon: HelpCircle },
  { href: "/past-exams", label: "أسئلة الدورات السابقة", icon: FolderArchive },
  { href: "/assignments", label: "الواجبات والاختبارات", icon: ClipboardList },
  { href: "/inquiries", label: "أسئلة الطلاب", icon: MessageCircle },
  { href: "/announcements", label: "الإعلانات", icon: Megaphone },
  { href: "/settings", label: "إعدادات النقاط", icon: Settings },
];

const studentLinks: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/student/home", label: "الرئيسية", icon: Home },
  { href: "/student/lessons", label: "دروسي", icon: BookOpen },
  { href: "/student/vocabulary", label: "الكلمات", icon: Type },
  { href: "/student/irregular-verbs", label: "الأفعال الشاذة", icon: RotateCcw },
  { href: "/student/assignments", label: "الواجبات", icon: ClipboardList },
  { href: "/student/inquiries", label: "أسئلتي واستفساراتي", icon: MessageCircle },
  { href: "/student/past-exams", label: "أسئلة الدورات السابقة", icon: FolderArchive },
  { href: "/student/results", label: "نتائجي", icon: BarChart3 },
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
    <aside className="w-64 shrink-0 h-full bg-brand-sidebar text-white flex flex-col p-4 gap-2 overflow-y-auto">
      <div className="px-2 py-4 mb-2">
        <h1 className="font-extrabold text-lg leading-tight tracking-tight" dir="ltr">
          ENGLISH <span className="text-brand-gold">HUB</span>
        </h1>
        <p className="text-[10px] text-white/60" dir="rtl">تعلم ملهم، مستقبل واعد</p>
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
          <span className="flex items-center gap-2 truncate">
            <FolderOpen size={17} className="shrink-0 opacity-80" />
            <span className="truncate">{stageName ?? "اختر القسم"}</span>
          </span>
          <span className="text-xs text-brand-goldLight shrink-0 font-bold">تبديل</span>
        </Link>
      )}
      <nav className="flex flex-col gap-1 flex-1">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={clsx(
                "flex items-center gap-3 px-3.5 py-2.5 min-h-[46px] rounded-2xl text-sm transition-all duration-150",
                pathname === l.href
                  ? "bg-gradient-to-l from-brand-primary to-brand-secondary text-white font-bold shadow-md shadow-black/10 ring-1 ring-brand-gold/25"
                  : "hover:bg-white/10 active:bg-white/15 text-white/85"
              )}
            >
              <Icon size={18} className="shrink-0" />
              <span>{l.label}</span>
            </Link>
          );
        })}
      </nav>
      <button
        onClick={() => signOut()}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-white/10 active:bg-white/15 text-white/85 min-h-[44px] shrink-0"
      >
        <LogOut size={18} />
        <span>تسجيل الخروج</span>
      </button>
      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm text-white/85 mt-1 min-h-[44px] shrink-0">
        <span className="flex items-center gap-2">
          {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
          <span>الوضع الداكن</span>
        </span>
        <ToggleSwitch checked={theme === "dark"} onChange={toggleTheme} />
      </div>
    </aside>
  );
}
