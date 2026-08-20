"use client";

import { useEffect, useState } from "react";

const INTRO_DURATION_MS = 4000;
const SESSION_FLAG = "elh_intro_shown";

/**
 * src/components/WelcomeIntro.tsx
 * ------------------------------------------------------------------
 * شاشة ترحيب متحركة (شعار يبرز + جملتين تظهران بالتتابع + شريط تقدّم)
 * تحل محل نص "جاري التحميل..." الجاف اللي كان أول شي يشوفه المستخدم عند
 * فتح التطبيق. تبقى ظاهرة 4 ثواني بالضبط كحد أدنى (حتى لو تحقق تسجيل
 * الدخول أسرع من هيك)، وبعدين تختفي بانتقال ناعم (fade) وتنادي onDone
 * حتى الصفحة الأب تكمل التوجيه (لتسجيل الدخول أو للوحة التحكم).
 *
 * تظهر مرة وحدة بس بكل "فتحة تطبيق حقيقية" (مش بكل تنقّل بين الصفحات)
 * عبر علم بسيط بـ sessionStorage — إذا المستخدم رجع بطريقة ما لمسار "/"
 * بنفس الجلسة، ما تتكرر الشاشة من جديد.
 * ------------------------------------------------------------------
 */
export function WelcomeIntro({ onDone }: { onDone: () => void }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setFadeOut(true), INTRO_DURATION_MS - 400);
    const doneTimer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SESSION_FLAG, "1");
      } catch {
        // sessionStorage غير متاح — لا مشكلة، أسوأ حالة الشاشة تتكرر
      }
      onDone();
    }, INTRO_DURATION_MS);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[999] bg-app-gradient flex flex-col items-center justify-center p-8 text-center overflow-hidden transition-opacity duration-500 ease-out ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-brand-gold/10 rounded-full blur-3xl" />

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="w-24 h-24 rounded-[2rem] bg-brand-sidebar flex items-center justify-center shadow-glass animate-splash-pop overflow-hidden p-4">
          <img src="/icons/icon-512.png" alt="Allawi English Hub" className="w-full h-full object-contain" />
        </div>

        <div>
          <p className="text-2xl md:text-3xl font-black text-brand-text tracking-tight leading-tight animate-fade-up" style={{ animationDelay: "0.5s", animationFillMode: "both" }}>
            تعلم ملهم،
          </p>
          <p
            className="text-2xl md:text-3xl font-black text-brand-primary tracking-tight leading-tight animate-fade-up"
            style={{ animationDelay: "0.75s", animationFillMode: "both" }}
          >
            مستقبل واعد
          </p>
        </div>

        <div className="w-32 h-[3px] rounded-full bg-brand-primary/15 overflow-hidden mt-2">
          <div className="h-full bg-brand-primary rounded-full animate-intro-bar" />
        </div>
      </div>
    </div>
  );
}

export function hasShownIntroThisSession() {
  try {
    return sessionStorage.getItem(SESSION_FLAG) === "1";
  } catch {
    return false;
  }
}
