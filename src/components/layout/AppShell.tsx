"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "./Sidebar";
import { MobileSidebar } from "./MobileSidebar";

export function AppShell({
  children,
  requireRole,
}: {
  children: ReactNode;
  requireRole?: "teacher" | "student"; // teacher تشمل admin
}) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

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
    }
    if (
      requireRole === "teacher" &&
      profile.role === "student"
    ) {
      router.replace("/student/home");
    }
  }, [loading, user, profile, requireRole, router, signOut]);

  if (loading || !profile || profile.status !== "active") {
    return (
      <div className="min-h-screen bg-app-gradient flex items-center justify-center">
        <p className="text-brand-text font-arabic">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-gradient flex" dir="rtl">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <MobileSidebar />
      <main className="flex-1 p-4 md:p-8 max-w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
