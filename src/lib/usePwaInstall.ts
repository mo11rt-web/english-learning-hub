"use client";

import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __pwaInstallEvent: BeforeInstallPromptEvent | null;
  }
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isInAppOrUnsupportedBrowser() {
  // متصفحات التطبيقات المدمجة (إنستغرام/فيسبوك...) ما بتدعم التثبيت حتى
  // على أندرويد، فما في داعي نعرض زر تحميل فيها.
  const ua = window.navigator.userAgent.toLowerCase();
  return /fban|fbav|instagram|line\//.test(ua) || ua.includes("micromessenger");
}

export function usePwaInstall() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(
    () => (typeof window !== "undefined" ? window.__pwaInstallEvent : null)
  );
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    if (!deferredEvent && window.__pwaInstallEvent) {
      setDeferredEvent(window.__pwaInstallEvent);
    }
    const onReady = () => setDeferredEvent(window.__pwaInstallEvent);
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      window.__pwaInstallEvent = e as BeforeInstallPromptEvent;
      setDeferredEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredEvent(null);
      window.__pwaInstallEvent = null;
    };
    window.addEventListener("pwa-install-ready", onReady);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("pwa-install-ready", onReady);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return false;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    setDeferredEvent(null);
    window.__pwaInstallEvent = null;
    return outcome === "accepted";
  }, [deferredEvent]);

  return {
    // Chrome/Edge/Android: في نافذة تثبيت برمجية جاهزة.
    canInstall: !installed && !!deferredEvent,
    promptInstall,
    // iOS Safari وما شابه ما بتطلق beforeinstallprompt أبداً — نعرض تعليمات يدوية.
    showManualIosInstructions:
      typeof window !== "undefined" && !installed && isIOS() && !isInAppOrUnsupportedBrowser(),
    installed,
  };
}
