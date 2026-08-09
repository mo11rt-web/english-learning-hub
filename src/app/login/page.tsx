"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { phoneToEmail } from "@/lib/phone";

export default function LoginPage() {
  const [mode, setMode] = useState<"teacher" | "student">("teacher");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const email = phoneToEmail(identifier, mode);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, "profiles", cred.user.uid));
      if (!snap.exists()) {
        setError("لا يوجد حساب مرتبط بهذا المستخدم.");
        setLoading(false);
        return;
      }
      const role = snap.data().role;
      router.replace(role === "student" ? "/student/home" : "/dashboard");
    } catch (err: any) {
      setError("بيانات الدخول غير صحيحة، يرجى المحاولة مجددًا.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
      <GlassCard className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-brand-text">
            English Learning Hub
          </h1>
          <p className="text-brand-textMuted text-sm mt-1">
            منصة تعليم اللغة الإنجليزية
          </p>
        </div>

        <div className="flex bg-black/5 rounded-2xl p-1 mb-6">
          <button
            type="button"
            onClick={() => setMode("teacher")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === "teacher" ? "bg-white shadow text-brand-primary" : "text-brand-textMuted"
            }`}
          >
            معلم / مدير
          </button>
          <button
            type="button"
            onClick={() => setMode("student")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === "student" ? "bg-white shadow text-brand-primary" : "text-brand-textMuted"
            }`}
          >
            طالب
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-brand-text block mb-1.5">
              رقم الهاتف
            </label>
            <input
              type="tel"
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
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-brand-primary/25 bg-white/70 focus:bg-white outline-none"
            />
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
