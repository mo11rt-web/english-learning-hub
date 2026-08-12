"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // فشل التسجيل ما بوقف التطبيق — بس التثبيت التلقائي ما رح يشتغل
      });
    }
  }, []);
  return null;
}
