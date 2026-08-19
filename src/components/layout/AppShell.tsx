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

function Spinner() {
  // تحميل داخلي محايد فقط؛ لا يعرض شاشة الشعار عند التنقل بين الصفحات.
  return <div className="fixed inset-0 z-[999] bg-app-gradient" aria-busy="true" />;
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
  const [showLaunchSplash, setShowLaunchSplash] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.sessionStorage.getItem("allawi_launch_splash_done") !== "1";
  });

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

  // تظهر شاشة الشعار مرة واحدة عند بداية جلسة التطبيق فقط، ولا تعود عند فتح صفحة أخرى.
  useEffect(() => {
    if (!isReady || !showLaunchSplash) return;
    window.sessionStorage.setItem("allawi_launch_splash_done", "1");
    setShowLaunchSplash(false);
  }, [isReady, showLaunchSplash]);

  if (authError) {
    return <ErrorScreen message={authError} onRetry={() => window.location.reload()} />;
  }

  if (!isReady) {
    return showLaunchSplash ? <Spinner /> : <div className="min-h-screen bg-app-gradient" aria-busy="true" />;
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
    return showLaunchSplash ? <Spinner /> : <div className="min-h-screen bg-app-gradient" aria-busy="true" />;
  }

  return (
    <MobileMenuProvider>
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
