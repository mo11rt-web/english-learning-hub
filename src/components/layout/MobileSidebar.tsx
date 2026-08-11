"use client";

import { Sidebar } from "./Sidebar";
import { useMobileMenu } from "@/hooks/useMobileMenu";

export function MobileSidebar() {
  const { open, setOpen } = useMobileMenu();
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 right-4 z-40 w-11 h-11 rounded-xl bg-brand-sidebar text-white flex items-center justify-center shadow-lg"
        aria-label="فتح القائمة"
      >
        ☰
      </button>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 right-0">
            <Sidebar />
          </div>
        </div>
      )}
    </>
  );
}
