"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, where, orderBy, limit, deleteDoc, doc } from "firebase/firestore";
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
  graded: "✅",
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

type AppNotification = Notification & { id: string };

function playNotificationSound() {
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.16);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
    window.setTimeout(() => void context.close?.(), 400);
  } catch {
    // يمنع المتصفح الصوت قبل تفاعل المستخدم أحياناً؛ لا نعطل الإشعار بسببه.
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [toastItem, setToastItem] = useState<AppNotification | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const previousIds = useRef<Set<string>>(new Set());
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    setSoundEnabled(window.localStorage.getItem("english-hub-notification-sound") !== "off");
  }, []);

  useEffect(() => {
    initialized.current = false;
    previousIds.current = new Set();
    setItems([]);
    setToastItem(null);
    if (!user) return;
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const nextItems = snapshot.docs.map((item) => ({ ...(item.data() as Notification), id: item.id }));
      const newItems = initialized.current ? nextItems.filter((item) => !previousIds.current.has(item.id)) : [];
      previousIds.current = new Set(nextItems.map((item) => item.id));
      initialized.current = true;
      setItems(nextItems);

      const newest = newItems[0];
      if (newest) {
        setToastItem(newest);
        if (soundEnabled) playNotificationSound();
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToastItem(null), 6500);
      }
    });
    return () => {
      unsubscribe();
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [user, soundEnabled]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleClick = async (notification: AppNotification) => {
    setOpen(false);
    setToastItem(null);
    if (notification.link) router.push(notification.link);
    await deleteDoc(doc(db, "notifications", notification.id));
  };

  const dismissAll = async () => {
    await Promise.all(items.map((item) => deleteDoc(doc(db, "notifications", item.id))));
    setToastItem(null);
  };

  const toggleSound = () => {
    setSoundEnabled((enabled) => {
      const next = !enabled;
      window.localStorage.setItem("english-hub-notification-sound", next ? "on" : "off");
      if (next) playNotificationSound();
      return next;
    });
  };

  return (
    <div ref={ref} className="relative">
      {toastItem && (
        <div className="fixed top-[calc(env(safe-area-inset-top,0px)+4.75rem)] left-3 right-3 md:left-auto md:right-6 md:w-[360px] z-[80] animate-in slide-in-from-top-3 fade-in duration-300">
          <button onClick={() => handleClick(toastItem)} className="w-full flex items-start gap-3 rounded-2xl border border-brand-primary/20 bg-surface/95 backdrop-blur-xl px-4 py-3 shadow-2xl text-right">
            <span className="text-xl shrink-0">{TYPE_ICON[toastItem.type] ?? "🔔"}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold text-brand-primary mb-0.5">إشعار جديد</span>
              <span className="block text-sm font-bold text-brand-text truncate">{toastItem.title}</span>
              {toastItem.body && <span className="block text-xs text-brand-textMuted truncate mt-0.5">{toastItem.body}</span>}
            </span>
            <span onClick={(event) => { event.stopPropagation(); setToastItem(null); }} className="text-brand-textMuted text-xs">✕</span>
          </button>
        </div>
      )}

      <button onClick={() => setOpen((value) => !value)} className="relative w-10 h-10 rounded-full bg-surface/70 hover:bg-surface flex items-center justify-center shadow-sm" aria-label="الإشعارات">
        <span className="text-lg">🔔</span>
        {items.length > 0 && <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-error text-white text-[10px] font-bold flex items-center justify-center">{items.length > 9 ? "9+" : items.length}</span>}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-80 max-h-96 overflow-y-auto bg-surface/95 backdrop-blur-xl rounded-2xl shadow-glass border border-surfaceBorder z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surfaceBorder">
            <h3 className="font-bold text-brand-text text-sm">الإشعارات</h3>
            <div className="flex items-center gap-3">
              <button onClick={toggleSound} className="text-xs text-brand-textMuted" title="تشغيل أو إيقاف صوت الإشعارات">{soundEnabled ? "🔊" : "🔇"}</button>
              {items.length > 0 && <button onClick={dismissAll} className="text-xs text-brand-textMuted">مسح الكل</button>}
            </div>
          </div>
          {items.length === 0 ? <p className="text-brand-textMuted text-sm text-center py-8">لا توجد إشعارات جديدة</p> : (
            <div className="flex flex-col">
              {items.map((notification) => (
                <button key={notification.id} onClick={() => handleClick(notification)} className="flex items-start gap-3 px-4 py-3 hover:bg-surfaceBorder/40 text-right border-b border-surfaceBorder last:border-0">
                  <span className="text-lg shrink-0">{TYPE_ICON[notification.type] ?? "🔔"}</span>
                  <span className="flex-1 min-w-0"><span className="block text-sm text-brand-text font-medium truncate">{notification.title}</span>{notification.body && <span className="block text-xs text-brand-textMuted truncate">{notification.body}</span>}<span className="block text-[10px] text-brand-textMuted mt-0.5">{timeAgo(notification.createdAt)}</span></span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
