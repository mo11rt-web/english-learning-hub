"use client";

import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useMobileMenu } from "@/hooks/useMobileMenu";

// اللوحة الجانبية المنبثقة على الهاتف. زر الفتح أصبح واحد فقط (داخل
// الشريط العلوي TopBar) بدل زرّين متكرّرين (هامبرغر عائم بالركن +
// هامبرغر داخل الشريط العلوي) — كان هذا هو سبب ظهور "زر مكرر". هذا
// المكوّن الآن مسؤول فقط عن عرض/إخفاء اللوحة نفسها، مع زر إغلاق واضح
// (✕) بأعلاها وانزلاق ناعم بدل الظهور المفاجئ.
export function MobileSidebar() {
  const { open, setOpen } = useMobileMenu();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0 bg-black/40 animate-fade-up"
        onClick={() => setOpen(false)}
      />
      <div className="absolute inset-y-0 right-0 w-64 animate-sheet-in shadow-lift">
        <div className="relative h-full">
          <button
            onClick={() => setOpen(false)}
            aria-label="إغلاق القائمة"
            className="absolute left-[-44px] top-3 w-9 h-9 rounded-full bg-brand-sidebar text-white flex items-center justify-center shadow-lg"
            style={{ marginTop: "env(safe-area-inset-top, 0px)" }}
          >
            <X size={18} />
          </button>
          <Sidebar />
        </div>
      </div>
    </div>
  );
}
