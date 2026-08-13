"use client";

import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  // نخزّن onClose بـ ref بدل ما نحطه بـ dependency array الأسفل — لأنه
  // onClose غالبًا arrow function جديدة بكل مرة يعيد فيها المكوّن الأب
  // رسمه (متل كل ضغطة حرف بحقل إدخال جوا النافذة). لو حطيناه بالـ deps،
  // الـ effect كان يعيد التشغيل مع كل حرف يكتبه المستخدم، وبما إنه الـ
  // effect فيه setTimeout يعيد التركيز (focus) لأول حقل بالنافذة (العنوان
  // بحالة نموذج الدرس) — هيك كان التركيز يرجع لحقل العنوان تلقائيًا كل
  // ما المستخدم يكتب حرف بأي حقل تاني. هاد كان السبب الجذري الحقيقي وراء
  // مشكلة "قفز التركيز" — مش مجرد عرض، كان فعليًا يمنع الكتابة الطبيعية
  // بأي حقل غير العنوان، وبالتالي يفسد بيانات الدرس المُدخلة قبل الحفظ.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    // تركيز تلقائي على أول حقل إدخال داخل النافذة — بس أول ما تنفتح
    // (مرة وحدة لكل فتحة)، مش مع كل إعادة رسم للمكوّن الأب
    const t = setTimeout(() => {
      const firstField = contentRef.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])"
      );
      firstField?.focus();
    }, 50);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={contentRef}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} bg-surface/95 backdrop-blur-xl rounded-t-3xl sm:rounded-glass shadow-glass border border-surfaceBorder max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto animate-sheet-in`}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-surfaceBorder sticky top-0 bg-surface/95 backdrop-blur-xl rounded-t-3xl sm:rounded-t-glass"
          style={{ paddingTop: "calc(1rem + env(safe-area-inset-top, 0px))" }}
        >
          <h3 className="font-bold text-brand-text">{title}</h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surfaceBorder/40 text-brand-textMuted hover:text-brand-text text-lg leading-none"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>
        <div className="p-6" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "تأكيد",
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-2xl ${
          danger ? "bg-brand-error/10 text-brand-error" : "bg-brand-warning/15 text-brand-warning"
        }`}
      >
        ⚠️
      </div>
      <p className="text-brand-text mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm text-brand-text border border-brand-primary/25 hover:bg-surfaceBorder/40"
        >
          إلغاء
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`px-4 py-2 rounded-xl text-sm text-white ${
            danger ? "bg-brand-error hover:opacity-90" : "bg-brand-primary hover:bg-brand-secondary"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// Toast بسيط بدون مكتبة خارجية
export function Toast({ message, type = "success" }: { message: string; type?: "success" | "error" }) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-2xl shadow-lg text-sm text-white ${
        type === "success" ? "bg-brand-success" : "bg-brand-error"
      }`}
    >
      {message}
    </div>
  );
}
