"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, type AuthError } from "firebase/auth";
import { collection, doc, getDoc, limit, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { normalizePhone } from "@/lib/phone";
import { usePwaInstall } from "@/lib/usePwaInstall";
import { Announcement, LeaderboardSettings } from "@/lib/types";

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
  const [publicAnnouncements, setPublicAnnouncements] = useState<(Announcement & { id: string })[]>([]);
  const [dismissedPublicAnnouncementId, setDismissedPublicAnnouncementId] = useState<string | null>(null);
  const [publicLeaderboards, setPublicLeaderboards] = useState<(LeaderboardSettings & { id: string })[]>([]);
  const router = useRouter();
  const { canInstall, promptInstall, showManualIosInstructions, installed } = usePwaInstall();

  useEffect(() => {
    if (!db) {
      setError("إعدادات Firebase غير مكتملة. أضف متغيرات NEXT_PUBLIC_FIREBASE_* ثم أعد تشغيل التطبيق.");
      return;
    }
    const now = Date.now();
    const announcementsUnsubscribe = onSnapshot(
      query(collection(db, "announcements"), where("public", "==", true), where("status", "==", "published"), limit(5)),
      (snapshot) => setPublicAnnouncements(snapshot.docs.map((item) => ({ ...(item.data() as Announcement), id: item.id })).filter((item) => (!item.startAt || item.startAt <= now) && (!item.endAt || item.endAt >= now))),
      () => setPublicAnnouncements([])
    );
    const leaderboardUnsubscribe = onSnapshot(
      query(collection(db, "public_leaderboards"), where("enabled", "==", true), limit(10)),
      (snapshot) => setPublicLeaderboards(snapshot.docs.map((item) => ({ ...(item.data() as LeaderboardSettings), id: item.id }))),
      () => setPublicLeaderboards([])
    );
    return () => { announcementsUnsubscribe(); leaderboardUnsubscribe(); };
  }, []);

  const activePublicAnnouncement = publicAnnouncements.find((item) => item.id !== dismissedPublicAnnouncementId) ?? null;

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
    if (!auth || !db) {
      setError("إعدادات Firebase غير مكتملة. لا يمكن تسجيل الدخول قبل إضافتها.");
      return;
    }
    setLoading(true);

    const phone = normalizePhone(identifier);

    // قبل هذا التعديل كنا نجرب الدومينين بالتتابع (student.com ثم
    // teacher.com) — يعني أي معلم يسجّل دخول كان ينتظر أولاً فشل محاولة
    // كاملة عبر الشبكة (student.com) قبل ما نبدأ حتى محاولة teacher.com
    // الصحيحة. هذا كان يُضاعف وقت تسجيل الدخول فعليًا (ثانية إلى ثانيتين
    // إضافيتين حسب سرعة الشبكة) لنصف المستخدمين تقريبًا. الحل: نجرب
    // الدومينين بالتوازي (Promise.allSettled) فيصير وقت الانتظار = أبطأ
    // محاولة وحدها، مش مجموع الاثنتين.
    const results = await Promise.allSettled(
      EMAIL_DOMAINS.map((domain) =>
        signInWithEmailAndPassword(auth, `${phone}@${domain}`, password)
      )
    );

    const success = results.find(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof signInWithEmailAndPassword>>> =>
        r.status === "fulfilled"
    );

    if (success) {
      try {
        const cred = success.value;
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
        return;
      } catch {
        setError("حدث خطأ غير متوقع. حاول مرة أخرى.");
        setLoading(false);
        return;
      }
    }

    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => (r.reason as AuthError)?.code ?? "unknown");
    const code = errors.find((c) => c === "auth/too-many-requests") ?? errors[0] ?? "unknown";
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
      <div className="w-full max-w-5xl grid lg:grid-cols-[1.05fr_0.95fr] gap-5 items-start">
        <div className="flex flex-col gap-4 order-2 lg:order-1">
          {publicLeaderboards.map((board) => <div key={board.id} className="rounded-3xl border border-brand-primary/20 bg-surface/90 p-5 shadow-glass"><div className="flex items-center justify-between mb-4"><div><h2 className="font-bold text-brand-text">🏆 نجوم هذا الشهر</h2><p className="text-xs text-brand-textMuted mt-1">اجتهد، اجمع النقاط، وقد يكون اسمك هنا ⭐</p></div><span className="text-3xl">🏆</span></div><div className="flex flex-col gap-2">{board.entries.slice(0, board.limit).map((entry) => <div key={`${board.id}-${entry.rank}`} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${entry.rank === 1 ? "bg-brand-gold/15" : "bg-surface/60"}`}><span className="text-xl">{entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : "⭐"}</span><span className="font-bold text-brand-text flex-1 truncate">{entry.studentName}</span><span className="text-sm text-brand-primary font-bold whitespace-nowrap">{entry.points} نقطة</span></div>)}</div></div>)}
        </div>
        <GlassCard className="w-full max-w-md mx-auto order-1 lg:order-2">
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
      </div>

      <Modal
        open={Boolean(activePublicAnnouncement)}
        onClose={() => activePublicAnnouncement && setDismissedPublicAnnouncementId(activePublicAnnouncement.id)}
        title="إعلان عام"
        maxWidth="max-w-xl"
      >
        {activePublicAnnouncement && (
          <div className="rounded-3xl overflow-hidden border border-brand-primary/20 bg-surface">
            <div className="h-2 bg-gradient-to-l from-brand-primary to-brand-secondary" />
            {activePublicAnnouncement.imageUrl && <img src={activePublicAnnouncement.imageUrl} alt="" className="w-full max-h-64 object-cover" />}
            <div className="p-5">
              <h2 className="text-xl font-bold text-brand-text">{activePublicAnnouncement.title}</h2>
              <p className="text-brand-textMuted mt-3 whitespace-pre-wrap leading-7">{activePublicAnnouncement.body}</p>
              {activePublicAnnouncement.linkUrl && <a href={activePublicAnnouncement.linkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center mt-5 px-4 py-2.5 rounded-xl bg-brand-primary text-white font-bold text-sm">فتح الرابط</a>}
            </div>
          </div>
        )}
      </Modal>

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
