"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Sidebar } from "./Sidebar";
import { MobileSidebar } from "./MobileSidebar";
import { BottomNav } from "./BottomNav";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileMenuProvider } from "@/hooks/useMobileMenu";

export function AppShell({
  children,
  requireRole,
}: {
  children: ReactNode;
  requireRole?: "teacher" | "student"; // teacher تشمل admin
}) {
  const { user, profile, loading, signOut } = useAuth();
  const { stageId, loading: workspaceLoading } = useWorkspace();
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

  if (loading || !profile || profile.status !== "active") {
    return (
      <div className="min-h-screen bg-app-gradient flex items-center justify-center">
        <p className="text-brand-text font-arabic">جاري التحميل...</p>
      </div>
    );
  }

  if (
    requireRole === "teacher" &&
    profile.role !== "student" &&
    !workspaceLoading &&
    !stageId &&
    pathname !== "/workspace"
  ) {
    return (
      <div className="min-h-screen bg-app-gradient flex items-center justify-center">
        <p className="text-brand-text font-arabic">جاري التحويل لاختيار القسم...</p>
      </div>
    );
  }

  return (
    <MobileMenuProvider>
      <div className="min-h-screen bg-app-gradient flex" dir="rtl">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <MobileSidebar />
        <div className="fixed top-4 left-4 z-40 flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
        </div>
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-full overflow-x-hidden">
          {children}
        </main>
        <BottomNav />
      </div>
    </MobileMenuProvider>
  );
}
