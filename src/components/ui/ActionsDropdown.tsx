"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

export interface DropdownAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
}

// نفس مكوّن قائمة الإجراءات (⋮) الموجود بعلاوي نت بالضبط — بيجمع كل
// إجراءات الصف (تعديل/تعطيل/حذف...) بقائمة منسدلة واحدة نظيفة بدل صف
// طويل من الأزرار النصية الصغيرة المتلاصقة.
export default function ActionsDropdown({ actions }: { actions: DropdownAction[] }) {
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
        onClick={() => setOpen((o) => !o)}
        className="grid h-9 w-9 place-items-center rounded-lg border border-brand-primary/20 hover:bg-surfaceBorder/40 text-brand-text"
        aria-label="خيارات"
        type="button"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-20 w-52 overflow-hidden rounded-xl border border-surfaceBorder/60 bg-surface/95 py-1.5 shadow-lg backdrop-blur-md">
          {visible.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
              className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-surfaceBorder/40 ${
                a.danger ? "text-brand-error" : "text-brand-text"
              }`}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
