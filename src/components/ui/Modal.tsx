"use client";

import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

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
  // نحتفظ بأحدث نسخة من onClose بمرجع (ref) بدل ما نعتمد عليها كـ dependency
  // بالأثر (useEffect) تحت. هاد هو السبب الجذري الحقيقي لمشكلة "التركيز
  // بيرجع لعنوان الدرس فجأة أثناء الكتابة": كل نافذة منبثقة بالمنصة (مش بس
  // نافذة إضافة الدرس) كانت تستقبل onClose كدالة جديدة بكل مرة الأب يعيد
  // الرندر (وهاد بيصير مع كل ضغطة حرف لأنه onChange بيحدّث الـ state).
  // useEffect تحت كان معتمد على [open, onClose] كـ dependencies، فكل ما
  // onClose تتغيّر (حتى لو المحتوى المنطقي نفسه) كان الأثر يعيد التشغيل،
  // وبالتالي كان يعيد جدولة التركيز التلقائي (focus) على أول حقل (عنوان
  // الدرس) من جديد — حرفيًا بمنتصف الكتابة بأي حقل تاني. الحل الصحيح:
  // الأثر (useEffect) الآن يعتمد على [open] فقط، فما يعيد التشغيل إلا لما
  // النافذة تنفتح أو تنسكر فعليًا، مش مع كل تغيير بالـ state.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    // تركيز تلقائي على أول حقل إدخال داخل النافذة — يصير مرة وحدة فقط عند
    // الفتح الفعلي، مش مع كل تحديث حالة بالأب
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
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
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
