"use client";

import { useEffect, useState, useRef } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { listenCollection, createDoc, orderBy } from "@/lib/firestore-helpers";
import { FileAsset } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

export default function FilesPage() {
  const [files, setFiles] = useState<(FileAsset & { id: string })[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [allowDownload, setAllowDownload] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    const u = listenCollection<FileAsset>(
      "files", [orderBy("uploadedAt", "desc")], setFiles
    );
    return () => u();
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
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
        const type = file.type.includes("pdf")
          ? "pdf"
          : file.type.includes("image")
          ? "image"
          : file.type.includes("audio")
          ? "audio"
          : file.type.includes("video")
          ? "video"
          : "other";
        await createDoc("files", {
          name: file.name,
          type,
          storagePath: url,
          sizeBytes: file.size,
          allowDownload,
          uploadedBy: user.uid,
          uploadedAt: Date.now(),
        });
        setProgress(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    );
  };

  return (
    <AppShell requireRole="teacher">
      <h1 className="text-2xl font-bold text-brand-text mb-6">الملفات</h1>

      <GlassCard className="mb-6">
        <h2 className="font-bold text-brand-text mb-3">رفع ملف جديد</h2>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            onChange={handleUpload}
            accept=".pdf,image/*,audio/*,video/*"
            className="text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-brand-text">
            <input
              type="checkbox"
              checked={allowDownload}
              onChange={(e) => setAllowDownload(e.target.checked)}
            />
            السماح بالتنزيل للطلاب
          </label>
        </div>
        {progress !== null && (
          <div className="mt-3 w-full bg-surfaceBorder/40 rounded-full h-2">
            <div
              className="bg-brand-primary h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </GlassCard>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {files.map((f) => (
          <GlassCard key={f.id}>
            <p className="font-medium text-brand-text truncate">{f.name}</p>
            <p className="text-xs text-brand-textMuted mb-2">
              {(f.sizeBytes / 1024).toFixed(0)} KB · {f.type.toUpperCase()}
            </p>
            <a
              href={f.storagePath}
              target="_blank"
              rel="noreferrer"
              className="text-brand-primary text-sm"
            >
              فتح الملف ↗
            </a>
          </GlassCard>
        ))}
        {files.length === 0 && <p className="text-brand-textMuted">لا توجد ملفات بعد.</p>}
      </div>
    </AppShell>
  );
}
