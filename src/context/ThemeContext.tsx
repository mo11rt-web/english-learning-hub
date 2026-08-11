"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState>({ dark: false, toggle: () => {} });
const KEY = "english_hub_theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  // بنبلش بالوضع النهاري دائمًا لحد ما يوصل الكلاينت (تجنّب اختلاف
  // العرض بين السيرفر والمتصفح)، وبعدين نطبّق تفضيل المستخدم المحفوظ
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    setDark(saved === "dark");
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(KEY, dark ? "dark" : "light");
  }, [dark, ready]);

  const toggle = () => setDark((d) => !d);

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
