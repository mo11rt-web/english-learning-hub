"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !profile) {
      router.replace("/login");
    } else if (profile.role === "student") {
      router.replace("/student/home");
    } else {
      router.replace("/dashboard");
    }
  }, [loading, user, profile, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-brand-text">جاري التحميل...</p>
    </div>
  );
}
