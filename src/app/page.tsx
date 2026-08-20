"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { WelcomeIntro, hasShownIntroThisSession } from "@/components/WelcomeIntro";

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(() => !hasShownIntroThisSession());

  const redirect = () => {
    if (loading) return;
    if (!user || !profile) {
      router.replace("/login");
    } else if (profile.role === "student") {
      router.replace("/student/home");
    } else {
      router.replace("/dashboard");
    }
  };

  useEffect(() => {
    if (!showIntro) redirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, profile, showIntro]);

  if (showIntro) {
    return <WelcomeIntro onDone={() => { setShowIntro(false); redirect(); }} />;
  }

  return <div className="min-h-screen bg-app-gradient" />;
}
