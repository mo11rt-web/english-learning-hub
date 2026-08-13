"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, where, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Notification } from "@/lib/types";

const TYPE_ICON: Record<Notification["type"], string> = {
  "new-lesson": "📘",
  "new-pdf": "📄",
  "new-video": "🎬",
  "new-exercise": "✏️",
  "new-exam": "📝",
  announcement: "📣",
  submission: "📥",
  system: "🔔",
};

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "الآن";
  if (min < 60) return `منذ ${min} د`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `منذ ${hr} س`;
  return `منذ ${Math.floor(hr / 24)} يوم`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<(Notification & { id: string })[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ ...(d.data() as Notification), id: d.id })));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleClick = async (n: Notification & { id: string }) => {
    setOpen(false);
    if (n.link) router.push(n.link);
    // "احذف عند القراءة": نحذف الإشعار من قاعدة البيانات فور الضغط عليه —
    // onSnapshot يحدّث الواجهة تلقائيًا بدون أي إعادة تحميل
    await deleteDoc(doc(db, "notifications", n.id));
  };

  const dismissAll = async () => {
    await Promise.all(items.map((n) => deleteDoc(doc(db, "notifications", n.id))));
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-10 h-10 rounded-full bg-surface/70 hover:bg-surface flex items-center justify-center shadow-sm"
        aria-label="الإشعارات"
      >
        <span className="text-lg">🔔</span>
        {items.length > 0 && (
          <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-error text-white text-[10px] font-bold flex items-center justify-center">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-80 max-h-96 overflow-y-auto bg-surface/95 backdrop-blur-xl rounded-2xl shadow-glass border border-surfaceBorder z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surfaceBorder">
            <h3 className="font-bold text-brand-text text-sm">الإشعارات</h3>
            {items.length > 0 && (
              <button onClick={dismissAll} className="text-xs text-brand-textMuted">
                مسح الكل
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="text-brand-textMuted text-sm text-center py-8">لا توجد إشعارات جديدة</p>
          ) : (
            <div className="flex flex-col">
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-surfaceBorder/40 text-right border-b border-surfaceBorder last:border-0"
                >
                  <span className="text-lg shrink-0">{TYPE_ICON[n.type] ?? "🔔"}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-brand-text font-medium truncate">{n.title}</span>
                    {n.body && <span className="block text-xs text-brand-textMuted truncate">{n.body}</span>}
                    <span className="block text-[10px] text-brand-textMuted mt-0.5">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
