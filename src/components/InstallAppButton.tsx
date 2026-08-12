"use client";

import { useState } from "react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { Modal } from "@/components/ui/Modal";

export function InstallAppButton() {
  const { canShowButton, promptInstall, isIos, hasNativePrompt } = useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (!canShowButton) return null;

  const handleClick = async () => {
    if (hasNativePrompt) {
      await promptInstall();
    } else if (isIos) {
      setShowIosHelp(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="mx-auto flex items-center gap-1.5 text-brand-primary text-xs font-medium hover:underline"
      >
        ⬇️ تحميل التطبيق (إضافة اختصار للشاشة الرئيسية)
      </button>

      <Modal open={showIosHelp} onClose={() => setShowIosHelp(false)} title="تثبيت التطبيق على آيفون">
        <ol className="flex flex-col gap-3 text-sm text-brand-text list-decimal pr-5">
          <li>اضغط زر المشاركة <span className="font-mono">⬆️</span> بأسفل شاشة Safari</li>
          <li>مرّر لتحت واختر <strong>"إضافة إلى الشاشة الرئيسية"</strong> (Add to Home Screen)</li>
          <li>اضغط <strong>"إضافة"</strong> بأعلى الشاشة</li>
        </ol>
        <p className="text-xs text-brand-textMuted mt-3">
          بعدها رح يظهر أيقونة المنصة على شاشتك الرئيسية متل أي تطبيق عادي.
        </p>
      </Modal>
    </>
  );
}
