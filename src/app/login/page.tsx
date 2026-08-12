"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { InstallAppButton } from "@/components/InstallAppButton";
import { phoneToEmail } from "@/lib/phone";

// نجرب الدخول بحساب "معلم/مدير" أول، وإذا ما كان موجود نجرب "طالب" —
// هيك المستخدم بس بكتب رقم هاتفه وكلمة السر، والنظام هو يلي يتعرف على
// نوع حسابه من البيانات، بدون ما يضطر يختار "معلم" أو "طالب" يدويًا
async function trySignIn(identifier: string, password: string) {
  const roles: Array<"teacher" | "student"> = ["teacher", "student"];
  let lastError: any = null;
  for (const role of roles) {
    try {
      const email = phoneToEmail(identifier, role);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return cred;
    } catch (err: any) {
      lastError = err;
      // نكمل نجرب الدور التاني بس إذا الخطأ كان "هالحساب مش موجود" —
      // أي خطأ ثاني (متل كلمة سر غلط أو محاولات كثيرة) نوقف عنده فورًا
      const code = err?.code ?? "";
      if (code !== "auth/user-not-found" && code !== "auth/invalid-email" && code !== "auth/invalid-credential") {
        throw err;
      }
    }
  }
  throw lastError;
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await trySignIn(identifier, password);
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
        setError("تم تعطيل هذا الحساب من قبل المعلم. تواصل مع المعلم لإعادة تفعيله.");
        setLoading(false);
        return;
      }
      if (profileData.status === "deleted") {
        await auth.signOut();
        setError("هذا الحساب لم يعد موجودًا على المنصة.");
        setLoading(false);
        return;
      }
      const role = profileData.role;
      router.replace(role === "student" ? "/student/home" : "/dashboard");
    } catch (err: any) {
      const code = err?.code ?? "unknown";
      if (code === "auth/user-not-found" || code === "auth/invalid-email" || code === "auth/invalid-credential") {
        setError(`لا يوجد حساب بهذا الرقم على المنصة. تأكد من كتابة الرقم بشكل صحيح. (${code})`);
      } else if (code === "auth/wrong-password") {
        setError(`كلمة المرور غير صحيحة. تأكد من كتابتها بالضبط. (${code})`);
      } else if (code === "auth/too-many-requests") {
        setError(`محاولات كثيرة خاطئة متتالية. انتظر دقيقة وحاول مجددًا. (${code})`);
      } else {
        setError(`بيانات الدخول غير صحيحة، يرجى المحاولة مجددًا. (${code})`);
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
      <GlassCard className="w-full max-w-md">
        <div className="text-center mb-4">
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

        <div className="mb-6">
          <InstallAppButton />
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
              className="w-full px-4 py-2.5 rounded-xl border border-brand-primary/25 bg-white/70 focus:bg-white outline-none"
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
                className="w-full px-4 py-2.5 rounded-xl border border-brand-primary/25 bg-white/70 focus:bg-white outline-none pl-12"
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
      </GlassCard>
    </div>
  );
}
