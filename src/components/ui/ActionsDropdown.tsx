"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

export interface DropdownAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  variant?: "danger" | "default";
  hidden?: boolean;
}

// نفس مكوّن قائمة الإجراءات (⋮) الموجود بعلاوي نت بالضبط — بيجمع كل
// إجراءات الصف (تعديل/تعطيل/حذف...) بقائمة منسدلة واحدة نظيفة بدل صف
// طويل من الأزرار النصية الصغيرة المتلاصقة.
export function ActionsDropdown({ actions }: { actions: DropdownAction[] }) {
  return <ActionsDropdownDefault actions={actions} />;
}

export default function ActionsDropdownDefault({ actions }: { actions: DropdownAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const visible = actions.filter((a) => !a.hidden);
  if (visible.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surfaceBorder/40 active:bg-surfaceBorder/60 text-brand-textMuted transition-colors"
        aria-label="خيارات"
        type="button"
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-20 w-48 overflow-hidden rounded-xl border border-surfaceBorder/60 bg-surface/95 py-1 shadow-lg backdrop-blur-md">
          {visible.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                a.onClick();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-[13px] font-medium transition-colors hover:bg-surfaceBorder/40 active:bg-surfaceBorder/60 ${
                a.danger || a.variant === "danger" ? "text-brand-error" : "text-brand-text"
              }`}
            >
              {a.icon && <span className="shrink-0">{a.icon}</span>}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
