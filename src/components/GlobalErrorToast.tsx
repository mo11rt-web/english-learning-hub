"use client";

import { useEffect, useState, useRef } from "react";
import { onFirestoreError } from "@/lib/firestore-helpers";

interface Toast {
  id: number;
  message: string;
}

let nextId = 1;

function messageFor(err: Error): string {
  if (err.message?.toLowerCase().includes("permission")) {
    return "لا توجد صلاحية كافية لعرض بعض البيانات.";
  }
  if (err.message?.toLowerCase().includes("unavailable") || err.message?.toLowerCase().includes("network")) {
    return "تعذر الاتصال بالخادم. تحقق من الإنترنت.";
  }
  return "حدث خطأ أثناء تحميل بعض البيانات.";
}

export function GlobalErrorToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // يمنع تكرار نفس الخطأ من نفس المسار أكثر من مرة كل 8 ثواني — الاتصال
  // المتذبذب ممكن يطلق نفس الخطأ عشرات المرات بثواني قليلة
  const recentPaths = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const unsub = onFirestoreError((err, path) => {
      const now = Date.now();
      const last = recentPaths.current.get(path) ?? 0;
      if (now - last < 8000) return;
      recentPaths.current.set(path, now);

      const id = nextId++;
      setToasts((t) => [...t.slice(-2), { id, message: messageFor(err) }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 6000);
    });
    return () => {
      unsub();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[60] left-1/2 -translate-x-1/2 flex flex-col gap-2 items-center w-[calc(100%-2rem)] max-w-sm"
      style={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-fade-up w-full px-4 py-3 rounded-xl bg-brand-sidebar text-white text-sm font-bold shadow-glass text-center"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
