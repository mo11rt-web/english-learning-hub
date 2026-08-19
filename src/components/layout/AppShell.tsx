"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Sidebar } from "./Sidebar";
import { MobileSidebar } from "./MobileSidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { MobileMenuProvider } from "@/hooks/useMobileMenu";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAndroidPush } from "@/hooks/useAndroidPush";

function Spinner({ fadeOut = false }: { fadeOut?: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-[999] bg-app-gradient flex flex-col items-center justify-center p-8 text-center overflow-hidden transition-opacity duration-500 ease-out ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-brand-gold/10 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-sm">
        <div className="w-32 h-32 md:w-40 md:h-32 rounded-[2.5rem] bg-white/10 flex items-center justify-center shadow-glass border border-white/20 animate-splash-pop overflow-hidden p-4">
          <img src="/icons/icon-512.png" alt="Allawi Logo" className="w-full h-full object-contain drop-shadow-xl" />
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-black text-brand-text tracking-tight leading-tight animate-fade-up">
            تعلم ملهم،<br />
            <span className="text-brand-primary drop-shadow-sm">مستقبل واعد</span>
          </h1>

          <div className="flex flex-col items-center gap-4 pt-4">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-brand-primary animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2.5 h-2.5 rounded-full bg-brand-primary animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2.5 h-2.5 rounded-full bg-brand-primary animate-bounce" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-app-gradient flex items-center justify-center px-6">
      <div className="text-center max-w-xs">
        <p className="text-brand-text font-bold mb-4">{message}</p>
        <button
          onClick={onRetry}
          className="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-bold"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  requireRole,
}: {
  children: ReactNode;
  requireRole?: "teacher" | "student"; // teacher تشمل admin
}) {
  usePushNotifications();
  useAndroidPush();
  const { user, profile, loading, error: authError, signOut } = useAuth();
  const { stageId, loading: workspaceLoading, error: workspaceError, retry: retryWorkspace } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user || !profile) {
      router.replace("/login");
      return;
    }
    // إذا عطّل المعلم الحساب أو حذفه أثناء استخدام الطالب للمنصة، نطرده
    // فورًا — الملف الشخصي يتحدث لحظيًا (onSnapshot) فلا حاجة لإعادة تحميل
    if (profile.status !== "active") {
      signOut().then(() => router.replace("/login"));
      return;
    }
    if (requireRole === "student" && profile.role !== "student") {
      router.replace("/dashboard");
      return;
    }
    if (requireRole === "teacher" && profile.role === "student") {
      router.replace("/student/home");
      return;
    }
    // المعلم/المدير لازم يختار القسم (تاسع/بكالوريا/...) أول ما يفوت،
    // حتى ما تختلط بيانات الأقسام ببعضها. صفحة اختيار القسم نفسها مستثناة
    // من هذا الشرط لتجنب حلقة تحويل لا نهائية.
    if (
      requireRole === "teacher" &&
      profile.role !== "student" &&
      !workspaceLoading &&
      !stageId &&
      pathname !== "/workspace"
    ) {
      router.replace(`/workspace?from=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, profile, requireRole, router, signOut, stageId, workspaceLoading, pathname]);

  const isReady = !loading && !!profile && profile.status === "active" && !authError;

  useEffect(() => {
    if (!isReady) return;
    if (requireRole === "teacher" && profile?.role !== "student" && !stageId && pathname !== "/workspace") return;
    const t = window.setTimeout(() => setSplashVisible(false), 150);
    return () => window.clearTimeout(t);
  }, [isReady, requireRole, profile, stageId, pathname]);

  if (authError) {
    return <ErrorScreen message={authError} onRetry={() => window.location.reload()} />;
  }

  if (!isReady) {
    return <Spinner />;
  }

  if (
    requireRole === "teacher" &&
    profile.role !== "student" &&
    !workspaceLoading &&
    !stageId &&
    pathname !== "/workspace"
  ) {
    if (workspaceError) {
      return <ErrorScreen message={workspaceError} onRetry={retryWorkspace} />;
    }
    return <Spinner />;
  }

  return (
    <MobileMenuProvider>
      {splashVisible && <Spinner fadeOut />}
      <div className="min-h-screen bg-app-gradient flex" dir="rtl">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <MobileSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar />
          <main className="flex-1 p-4 md:p-8 pb-36 md:pb-8 max-w-full overflow-x-hidden">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    </MobileMenuProvider>
  );
}
