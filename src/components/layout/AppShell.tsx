"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTheme } from "@/hooks/useTheme";
import { useMobileMenu, MobileMenuProvider } from "@/hooks/useMobileMenu";
import { Sidebar } from "./Sidebar";
import { MobileSidebar } from "./MobileSidebar";
import { BottomNav } from "./BottomNav";
import { NotificationBell } from "@/components/NotificationBell";

export function AppShell({
  children,
  requireRole,
}: {
  children: ReactNode;
  requireRole?: "teacher" | "student";
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
      <ShellFrame profileName={profile.fullName}>{children}</ShellFrame>
    </MobileMenuProvider>
  );
}

function ShellFrame({ children, profileName }: { children: ReactNode; profileName: string }) {
  const { theme, toggleTheme } = useTheme();
  const { setOpen } = useMobileMenu();

  return (
    <div className="min-h-screen bg-app-gradient flex" dir="rtl">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <MobileSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 flex items-center justify-between border-b border-surfaceBorder bg-surface/90 px-4 py-3 backdrop-blur-md md:px-8"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
        >
          <div className="flex items-center gap-2 md:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-sidebar text-sm font-extrabold text-white">LE</div>
            <div>
              <p className="text-sm font-extrabold text-brand-text">Learn English</p>
              <p className="text-[10px] text-brand-textMuted">{profileName}</p>
            </div>
          </div>
          <div className="hidden text-sm font-bold text-brand-textMuted md:block">مرحباً بك، {profileName}</div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-10 w-10 place-items-center rounded-full border border-surfaceBorder text-base hover:bg-brand-primary/10"
              aria-label="تبديل الوضع الليلي"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-full border border-surfaceBorder text-lg md:hidden"
              aria-label="فتح القائمة"
            >
              ☰
            </button>
          </div>
        </header>
        <main className="flex-1 max-w-full overflow-x-hidden px-4 pt-5 pb-28 md:px-8 md:pb-10">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
