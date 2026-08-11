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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    // تركيز تلقائي على أول حقل إدخال داخل النافذة — يفتح لوحة المفاتيح
    // فورًا على الهاتف بدون ما يحتاج المستخدم يضغط بنفسه
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
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={contentRef}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} bg-white/95 backdrop-blur-xl rounded-glass shadow-glass border border-white/70 max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 sticky top-0 bg-white/95 backdrop-blur-xl rounded-t-glass">
          <h3 className="font-bold text-brand-text">{title}</h3>
          <button
            onClick={onClose}
            className="text-brand-textMuted hover:text-brand-text text-lg leading-none"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
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
      <p className="text-brand-text mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm text-brand-text border border-brand-primary/25 hover:bg-black/5"
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
