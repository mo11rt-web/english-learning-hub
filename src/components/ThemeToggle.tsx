"use client";

import { useTheme } from "@/context/ThemeContext";

export function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
      title={dark ? "الوضع النهاري" : "الوضع الليلي"}
      className="w-10 h-10 rounded-full bg-white/70 dark:bg-brand-surface/80 hover:bg-white dark:hover:bg-brand-surface flex items-center justify-center shadow-sm text-lg"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
