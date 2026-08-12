"use client";

import { useEffect, useState } from "react";

// حدث المتصفح (أندرويد/كروم/إيدج) اللي بيسمح نعرض نافذة "تثبيت التطبيق"
// الأصلية بدل ما نعتمد على المستخدم يلاقي الخيار بنفسه جوا قوائم المتصفح
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome === "accepted";
  };

  // نعرض الزر إذا: عندنا نافذة تثبيت جاهزة (أندرويد/كروم)، أو المستخدم على
  // آيفون (بدها تعليمات يدوية لأن Safari ما بيدعم beforeinstallprompt إطلاقًا)
  const canShowButton = !installed && (!!deferredPrompt || isIos());

  return { canShowButton, promptInstall, isIos: isIos(), hasNativePrompt: !!deferredPrompt };
}
