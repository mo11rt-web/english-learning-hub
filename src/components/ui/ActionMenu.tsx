"use client";

import { useEffect, useRef, useState } from "react";

export interface ActionMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
}

export function ActionMenu({ items }: { items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label="خيارات"
        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-brand-textMuted text-lg leading-none shrink-0"
      >
        ⋮
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 mt-1 w-52 bg-white/98 dark:bg-[#0c1f23]/98 backdrop-blur-xl rounded-2xl shadow-glass border border-white/70 dark:border-white/10 z-50 py-1.5 animate-sheet-in"
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-right hover:bg-black/5 dark:hover:bg-white/10 ${
                item.danger ? "text-brand-error" : "text-brand-text"
              }`}
            >
              {item.icon && <span>{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
