"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, type AuthError } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { normalizePhone } from "@/lib/phone";
import { usePwaInstall } from "@/lib/usePwaInstall";

// المنصة ما بتسأل المستخدم "معلم ولا طالب" — بتكتشف نوع الحساب تلقائياً.
// كل رقم هاتف مسجّل ببريد وهمي واحد بس (إما @teacher.com أو @student.com)،
// فنجرب النوعين بالترتيب لحد ما ندخل، ورسالة الخطأ النهائية موحّدة حتى ما
// نكشف لأي حد (شخص بيحاول يخمّن) إذا الرقم أصلاً مسجل كمعلم أو كطالب.
const EMAIL_DOMAINS = ["student.com", "teacher.com"] as const;

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const router = useRouter();
  const { canInstall, promptInstall, showManualIosInstructions, installed } = usePwaInstall();

  const handleInstallClick = async () => {
    if (canInstall) {
      const accepted = await promptInstall();
      if (!accepted) setShowInstallHelp(true);
      return;
    }
    setShowInstallHelp(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const phone = normalizePhone(identifier);
    let lastError: AuthError | null = null;

    for (const domain of EMAIL_DOMAINS) {
      const email = `${phone}@${domain}`;
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const snap = await getDoc(doc(db, "profiles", cred.user.uid));
        if (!snap.exists()) {
          await auth.signOut();
          setError("لا يوجد حساب مرتبط بهذا المستخدم.");
          setLoading(false);
          return;
        }
        const profileData = snap.data();
        if (profileData.status === "disabled") {
          await auth.signOut();
          setError("تم تعطيل هذا الحساب. تواصل مع المعلم لإعادة تفعيله.");
          setLoading(false);
          return;
        }
        if (profileData.status === "deleted") {
          await auth.signOut();
          setError("هذا الحساب لم يعد موجودًا على المنصة.");
          setLoading(false);
          return;
        }
        // النظام بيتعرف على نوع الحساب مباشرة من بيانات المستخدم بقاعدة
        // البيانات (role) — مش من أي اختيار دوّي المستخدم.
        const role = profileData.role;
        router.replace(role === "student" ? "/student/home" : "/dashboard");
        return; // نجح الدخول، ما في داعي نجرب الدومين الثاني
      } catch (err) {
        lastError = err as AuthError;
        // نجرب الدومين التاني بس إذا كان سبب الفشل إنه ما في حساب بهاد
        // البريد أصلاً. أي سبب تاني (مثلاً كثرة محاولات) نوقف فوراً.
        const code = lastError?.code ?? "";
        if (code === "auth/too-many-requests") break;
      }
    }

    const code = lastError?.code ?? "unknown";
    if (code === "auth/too-many-requests") {
      setError(`محاولات كثيرة خاطئة متتالية. انتظر دقيقة وحاول مجددًا. (${code})`);
    } else {
      // ما منفرّق بالرسالة بين "الرقم غير مسجل" و"كلمة المرور غلط" — Firebase
      // نفسه صار يوحّد هالخطأين تحت auth/invalid-credential لأسباب أمنية،
      // وهاد أفضل تجربة برضو حتى ما نكشف معلومات عن الحسابات.
      setError(`رقم الهاتف أو كلمة المرور غير صحيحة. تأكد من كتابتها بالضبط. (${code})`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
      <GlassCard className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-brand-text tracking-tight" dir="ltr">
            Learn <span className="text-brand-primary">English</span>
          </h1>
          <p className="text-brand-textMuted text-xs mt-0.5" dir="ltr">
            with Mohanad Allawi
          </p>
          <p className="text-brand-textMuted text-sm mt-2">
            تعلّم. احترف. انجح.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-brand-text block mb-1.5">
              رقم الهاتف
            </label>
            <input
              type="tel"
              inputMode="tel"
              enterKeyHint="next"
              autoFocus
              autoComplete="tel"
              dir="ltr"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-brand-primary/25 bg-surface/70 focus:bg-surface outline-none"
              placeholder="0912345678"
            />
          </div>
          <div>
            <label className="text-sm text-brand-text block mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                dir="ltr"
                enterKeyHint="done"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-brand-primary/25 bg-surface/70 focus:bg-surface outline-none pl-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-textMuted text-xs"
                tabIndex={-1}
              >
                {showPassword ? "إخفاء" : "إظهار"}
              </button>
            </div>
          </div>
          {error && (
            <p className="text-brand-error text-sm bg-brand-error/10 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-full mt-2">
            {loading ? "جاري الدخول..." : "تسجيل الدخول"}
          </Button>
        </form>

        {!installed && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-primary/25 bg-surface/70 px-4 py-3 text-sm font-bold text-brand-text backdrop-blur transition hover:bg-surface active:scale-[0.99]"
          >
            <span aria-hidden>⬇</span>
            تحميل التطبيق (Install App)
          </button>
        )}
      </GlassCard>

      <Modal open={showInstallHelp} onClose={() => setShowInstallHelp(false)} title="تثبيت التطبيق" maxWidth="max-w-sm">
        {showManualIosInstructions ? (
          <div className="flex items-start gap-2.5 text-sm text-brand-text">
            <span aria-hidden className="mt-0.5 shrink-0">⬆</span>
            <span>
              دوس زر <b>المشاركة</b> بالمتصفح (أسفل الشاشة)، ثم اختر <b>&quot;إضافة إلى الشاشة الرئيسية&quot;</b>.
            </span>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-brand-text">
            <p>لم يعرض متصفحك خيار التثبيت المباشر بعد. يمكنك تثبيت التطبيق يدوياً:</p>
            <div className="flex items-start gap-2.5 rounded-xl bg-surfaceBorder/30 p-3">
              <span aria-hidden className="mt-0.5 shrink-0">⬇</span>
              <span>
                افتح قائمة المتصفح (⋮ أو ⋯ أعلى أو أسفل الشاشة) وابحث عن <b>&quot;تثبيت التطبيق&quot;</b> أو <b>&quot;إضافة إلى الشاشة الرئيسية&quot;</b>.
              </span>
            </div>
            <p className="text-xs text-brand-textMuted">
              ملاحظة: بعض المتصفحات (مثل فايرفوكس) لا تدعم التثبيت المباشر للتطبيقات — استخدم Chrome أو Edge لأفضل تجربة تثبيت.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
