"use client";

import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronLeft, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useMobileMenu } from "@/hooks/useMobileMenu";
import { NotificationBell } from "@/components/NotificationBell";

const labels: Record<string, string> = {
  dashboard: "الرئيسية",
  students: "الطلاب",
  groups: "المجموعات والصفوف",
  units: "الوحدات والدروس",
  vocabulary: "الكلمات",
  "irregular-verbs": "الأفعال الشاذة",
  files: "الملفات",
  questions: "بنك الأسئلة",
  "past-exams": "أسئلة الدورات السابقة",
  assignments: "الواجبات والاختبارات",
  inquiries: "أسئلة الطلاب",
  announcements: "الإعلانات",
  settings: "الإعدادات",
  student: "واجهة الطالب",
  home: "الرئيسية",
  lessons: "الدروس",
  results: "النتائج",
};

function breadcrumbItems(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const items: { label: string; href: string }[] = [{ label: "الرئيسية", href: pathname.startsWith("/student") ? "/student/home" : "/dashboard" }];
  let href = "";
  parts.forEach((part, index) => {
    href += `/${part}`;
    if (index === 0 && (part === "dashboard" || part === "student")) return;
    items.push({ label: labels[part] ?? (part.length > 18 ? "التفاصيل" : part), href });
  });
  return items.filter((item, index, list) => index === 0 || item.href !== list[index - 1].href);
}

export function TopBar() {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { setOpen } = useMobileMenu();
  const pathname = usePathname();
  const crumbs = breadcrumbItems(pathname);
  const welcome = profile ? `مرحباً بك، ${profile.fullName}` : "";

  return (
    <header className="sticky top-0 z-30 border-b border-surfaceBorder/80 bg-surface/[0.9] backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="flex items-center justify-between gap-3 px-4 md:px-8 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => setOpen(true)} className="md:hidden w-10 h-10 shrink-0 rounded-xl bg-brand-sidebar text-white flex items-center justify-center" aria-label="فتح القائمة"><Menu size={19} /></button>
          <div className="min-w-0">
            <p className="truncate text-sm md:text-base font-bold text-brand-text">{welcome}</p>
            <div className="hidden sm:flex items-center gap-1 mt-1 text-[10px] text-brand-textMuted truncate">
              {crumbs.map((crumb, index) => <span key={`${crumb.href}-${index}`} className="flex items-center gap-1"><span className={index === crumbs.length - 1 ? "text-brand-primary font-bold" : ""}>{crumb.label}</span>{index < crumbs.length - 1 && <ChevronLeft size={11} />}</span>)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => window.history.back()} className="hidden sm:flex w-9 h-9 rounded-xl border border-brand-gold/40 text-brand-textMuted hover:bg-brand-goldLight/35 items-center justify-center transition-colors" aria-label="رجوع" title="رجوع"><ArrowRight size={16} /></button>
          <button onClick={() => window.history.forward()} className="hidden sm:flex w-9 h-9 rounded-xl border border-brand-gold/40 text-brand-textMuted hover:bg-brand-goldLight/35 items-center justify-center transition-colors" aria-label="تقدم" title="تقدم"><ArrowLeft size={16} /></button>
          <NotificationBell />
          <button onClick={toggleTheme} className="w-10 h-10 rounded-full bg-surface/70 hover:bg-surfaceBorder/40 flex items-center justify-center shadow-sm transition-colors" aria-label="تبديل الوضع الليلي">{theme === "dark" ? "☀️" : "🌙"}</button>
        </div>
      </div>
    </header>
  );
}
