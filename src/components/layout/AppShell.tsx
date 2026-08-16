"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Sidebar } from "./Sidebar";
import { MobileSidebar } from "./MobileSidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { MobileMenuProvider } from "@/hooks/useMobileMenu";

function Spinner() {
  return (
    <div className="min-h-screen bg-app-gradient flex items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-primary/25 border-t-brand-primary" />
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
  const { user, profile, loading, error: authError, signOut } = useAuth();
  const { stageId, loading: workspaceLoading, error: workspaceError, retry: retryWorkspace } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();

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

  if (authError) {
    return <ErrorScreen message={authError} onRetry={() => window.location.reload()} />;
  }

  if (loading || !profile || profile.status !== "active") {
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
