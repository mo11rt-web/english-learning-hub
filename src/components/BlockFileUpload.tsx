"use client";

import { useState } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

const ACCEPT: Record<string, string> = {
  image: "image/*",
  pdf: ".pdf,application/pdf",
  audio: "audio/*",
  "book-page": ".pdf,application/pdf,image/*",
};

export function BlockFileUpload({
  type,
  onUploaded,
}: {
  type: "image" | "pdf" | "audio" | "book-page";
  onUploaded: (url: string) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `lesson-files/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);
    setProgress(0);
    task.on(
      "state_changed",
      (snap) => setProgress((snap.bytesTransferred / snap.totalBytes) * 100),
      (err) => {
        alert("فشل الرفع: " + err.message);
        setProgress(null);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        onUploaded(url);
        setProgress(null);
        e.target.value = "";
      }
    );
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        accept={ACCEPT[type]}
        onChange={handleChange}
        className="text-xs"
      />
      {progress !== null && (
        <span className="text-xs text-brand-textMuted">جارٍ الرفع {Math.round(progress)}%</span>
      )}
    </div>
  );
}
