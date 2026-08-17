"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, MessageCircle, Info, Clock, CheckCircle2, X } from "lucide-react";
import { collection, onSnapshot, query, where, orderBy, limit, deleteDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Notification } from "@/lib/types";

const TYPE_ICON: Record<Notification["type"], any> = {
  "new-lesson": Info,
  "new-pdf": Info,
  "new-video": Info,
  "new-exercise": Info,
  "new-exam": Info,
  announcement: Bell,
  submission: MessageCircle,
  graded: CheckCircle2,
  "inquiry-new": MessageCircle,
  "inquiry-reply": MessageCircle,
  "inquiry-resolved": CheckCircle2,
  system: Bell,
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
    try {
      if (!notification.read) {
        await updateDoc(doc(db, "notifications", notification.id), { read: true });
      }
    } catch {
      // تجاهل
    }
    if (notification.link) router.push(notification.link);
  };

  const markAllAsRead = async () => {
    try {
      await Promise.all(
        items.filter((item) => !item.read).map((item) => updateDoc(doc(db, "notifications", item.id), { read: true }))
      );
    } catch {
      // تجاهل
    }
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

      <button onClick={() => setOpen((value) => !value)} className="relative w-10 h-10 rounded-full bg-surface/70 hover:bg-surface flex items-center justify-center shadow-sm border border-surfaceBorder transition-all active:scale-95" aria-label="الإشعارات">
        <Bell size={20} className={items.filter((i) => !i.read).length > 0 ? "text-brand-primary animate-pulse" : "text-brand-textMuted"} />
        {items.filter((i) => !i.read).length > 0 && (
          <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-primary text-white text-[10px] font-bold flex items-center justify-center shadow-sm border border-white">
            {items.filter((i) => !i.read).length > 9 ? "9+" : items.filter((i) => !i.read).length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-80 max-h-[80vh] overflow-y-auto bg-surface/95 backdrop-blur-xl rounded-2xl shadow-glass border border-surfaceBorder z-50 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surfaceBorder sticky top-0 bg-surface/80 backdrop-blur-md z-10">
            <h3 className="font-bold text-brand-text text-sm">الإشعارات</h3>
            <div className="flex items-center gap-3">
              <button onClick={toggleSound} className="text-xs text-brand-textMuted hover:text-brand-primary transition-colors" title="تشغيل أو إيقاف صوت الإشعارات">{soundEnabled ? "🔊" : "🔇"}</button>
              {items.some((i) => !i.read) && (
                <button onClick={markAllAsRead} className="text-[11px] text-brand-primary font-bold flex items-center gap-1 hover:underline">
                  <CheckCheck size={13} /> تحديد الكل
                </button>
              )}
              {items.length > 0 && <button onClick={dismissAll} className="text-[11px] text-brand-error hover:underline">مسح</button>}
            </div>
          </div>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-surfaceBorder/30 flex items-center justify-center mb-3 text-brand-textMuted opacity-20"><Bell size={24} /></div>
              <p className="text-brand-textMuted text-sm font-medium">لا توجد إشعارات حالياً</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {items.map((notification) => {
                const Icon = TYPE_ICON[notification.type] || Bell;
                return (
                  <button
                    key={notification.id}
                    onClick={() => handleClick(notification)}
                    className={`flex items-start gap-3 px-4 py-4 text-right border-b border-surfaceBorder last:border-0 transition-all ${
                      notification.read
                        ? "hover:bg-surfaceBorder/30 opacity-70"
                        : "bg-brand-primary/[0.03] hover:bg-brand-primary/[0.08] border-r-4 border-r-brand-primary"
                    }`}
                  >
                    <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${notification.read ? "bg-surfaceBorder/50 text-brand-textMuted" : "bg-brand-primary/15 text-brand-primary"}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${notification.read ? "text-brand-textMuted" : "text-brand-text font-bold"}`}>
                          {notification.title}
                        </span>
                        {!notification.read && <span className="w-2 h-2 rounded-full bg-brand-primary shrink-0 animate-pulse" />}
                      </div>
                      {notification.body && (
                        <p className={`text-xs truncate mt-0.5 ${notification.read ? "text-brand-textMuted/60" : "text-brand-textMuted font-medium"}`}>
                          {notification.body}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-brand-textMuted/60">
                        <Clock size={10} />
                        {timeAgo(notification.createdAt)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
