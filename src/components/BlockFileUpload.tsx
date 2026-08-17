"use client";

import { useState } from "react";
import { Link2, Upload } from "lucide-react";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

const PLACEHOLDER: Record<string, string> = {
  image: "https://... رابط الصورة",
  pdf: "https://... رابط ملف PDF",
  audio: "https://... رابط التسجيل الصوتي",
  "book-page": "https://... رابط صفحة الكتاب",
};

export function BlockFileUpload({
  type,
  onUploaded,
}: {
  type: "image" | "pdf" | "audio" | "book-page";
  onUploaded: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const saveUrl = () => {
    const value = url.trim();
    if (!value.startsWith("http://") && !value.startsWith("https://")) {
      setError("أدخل رابطاً يبدأ بـ https://");
      return;
    }
    setError("");
    onUploaded(value);
    setUrl("");
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const result = await uploadImageToCloudinary(file, "english-hub/lesson-blocks");
      onUploaded(result.secureUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "فشل رفع الصورة.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {type === "image" && (
        <label className="inline-flex items-center gap-2 w-fit px-3 py-1.5 rounded-lg bg-brand-primary/10 text-brand-primary text-xs cursor-pointer">
          <Upload size={14} />
          {uploading ? "جارٍ رفع الصورة..." : "رفع صورة"}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); event.target.value = ""; }} />
        </label>
      )}
      <div className="flex items-center gap-2">
        <Link2 size={15} className="text-brand-textMuted shrink-0" />
        <input
          value={url}
          onChange={(event) => { setUrl(event.target.value); setError(""); }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); saveUrl(); } }}
          dir="ltr"
          placeholder={PLACEHOLDER[type]}
          className="min-w-0 flex-1 px-2.5 py-1.5 rounded-lg border border-brand-primary/20 bg-surface/70 text-xs"
        />
        <button type="button" onClick={saveUrl} className="px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-bold shrink-0">إضافة الرابط</button>
      </div>
      {error && <p className="text-[11px] text-brand-error">{error}</p>}
      <p className="text-[10px] text-brand-textMuted">الصور يمكن رفعها مباشرة، أما PDF والصوت فاستخدم لهما رابط Google Drive أو رابطاً خارجياً.</p>
    </div>
  );
}
