"use client";

import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useMobileMenu } from "@/hooks/useMobileMenu";
import { NotificationBell } from "@/components/NotificationBell";

export function TopBar() {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { setOpen } = useMobileMenu();

  // ما منضيف كلمة "أستاذ" يدويًا هون — لأنه بعض حسابات المعلمين أصلاً
  // مخزّنة بالاسم "أستاذ محمد" (باللقب جوّا fullName نفسه)، فإضافة اللقب
  // مرة ثانية بالكود كانت تطلع "مرحباً بك، أستاذ أستاذ محمد" مكرر. نعرض
  // الاسم بالضبط متل ما هو محفوظ بالحساب.
  const welcome = profile ? `مرحباً بك، ${profile.fullName}` : "";

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b border-surfaceBorder bg-surface/90 backdrop-blur-xl px-4 md:px-8 py-3"
      style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => setOpen(true)}
          className="md:hidden w-10 h-10 shrink-0 rounded-xl bg-brand-sidebar text-white flex items-center justify-center"
          aria-label="فتح القائمة"
        >
          <span className="text-lg leading-none">☰</span>
        </button>
        <p className="truncate text-sm md:text-base font-bold text-brand-text">
          {welcome}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <NotificationBell />
        <button
          onClick={toggleTheme}
          className="w-10 h-10 rounded-full bg-surface/70 hover:bg-surfaceBorder/40 flex items-center justify-center shadow-sm transition-colors"
          aria-label="تبديل الوضع الليلي"
        >
          <span className="text-lg">{theme === "dark" ? "☀️" : "🌙"}</span>
        </button>
      </div>
    </header>
  );
}
