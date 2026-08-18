"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Link2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { listenCollection, createDoc, orderBy } from "@/lib/firestore-helpers";
import { FileAsset } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

type ResourceType = "pdf" | "image" | "audio" | "video" | "other";

export default function FilesPage() {
  const [files, setFiles] = useState<(FileAsset & { id: string })[]>([]);
  const [allowDownload, setAllowDownload] = useState(true);
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceName, setResourceName] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("pdf");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const unsubscribe = listenCollection<FileAsset>("files", [orderBy("uploadedAt", "desc")], setFiles);
    return () => unsubscribe();
  }, []);

  const saveFile = async () => {
    if (!user) return;
    if (!resourceName.trim() && !imageFile) return;
    if (!resourceUrl.trim() && !imageFile) return;
    setSaving(true);
    try {
      const finalUrl = imageFile ? (await uploadImageToCloudinary(imageFile, "english-hub/files")).secureUrl : resourceUrl.trim();
      await createDoc("files", {
        name: resourceName.trim() || imageFile?.name || "ملف تعليمي",
        type: imageFile ? "image" : resourceType,
        storagePath: finalUrl,
        sizeBytes: imageFile?.size ?? 0,
        allowDownload,
        uploadedBy: user.uid,
        uploadedAt: Date.now(),
      });
      setResourceUrl(""); setResourceName(""); setResourceType("pdf"); setImageFile(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "تعذّر حفظ الملف.");
    } finally { setSaving(false); }
  };

  return (
    <AppShell requireRole="teacher">
      <PageHeader icon="📎" title="الملفات" />
      <GlassCard className="mb-6">
        <h2 className="font-bold text-brand-text mb-2">إضافة ملف أو رابط تعليمي</h2>
        <p className="text-xs text-brand-textMuted mb-4">الصور ترفع مباشرة بشكل آمن، وPDF والصوت والفيديو تضاف كرابط خارجي.</p>
        <div className="grid md:grid-cols-2 gap-3">
          <input value={resourceName} onChange={(event) => setResourceName(event.target.value)} placeholder="اسم الملف" className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
          <select value={resourceType} onChange={(event) => setResourceType(event.target.value as ResourceType)} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"><option value="pdf">PDF</option><option value="audio">تسجيل صوتي</option><option value="video">فيديو</option><option value="image">صورة عبر رابط</option><option value="other">أخرى</option></select>
          <label className="md:col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"><Link2 size={16} className="text-brand-textMuted" /><input dir="ltr" value={resourceUrl} onChange={(event) => { setResourceUrl(event.target.value); setImageFile(null); }} placeholder="رابط Google Drive أو الرابط الخارجي" className="min-w-0 flex-1 bg-transparent outline-none text-sm" /></label>
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-sm text-brand-textMuted cursor-pointer"><ImagePlus size={16} />{imageFile?.name ?? "رفع صورة"}<input type="file" accept="image/*" className="hidden" onChange={(event) => { setImageFile(event.target.files?.[0] ?? null); setResourceUrl(""); setResourceType("image"); }} /></label>
          <label className="flex items-center gap-2 text-sm text-brand-text"><input type="checkbox" checked={allowDownload} onChange={(event) => setAllowDownload(event.target.checked)} /> السماح بالتنزيل للطلاب</label>
        </div>
        <Button onClick={saveFile} disabled={saving} className="mt-4">{saving ? "جارٍ الحفظ..." : "إضافة الملف"}</Button>
      </GlassCard>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 pb-24">{files.map((file) => <GlassCard key={file.id}><p className="font-medium text-brand-text truncate">{file.name}</p><p className="text-xs text-brand-textMuted mb-2">{file.sizeBytes ? `${(file.sizeBytes / 1024).toFixed(0)} KB · ` : "رابط خارجي · "}{file.type.toUpperCase()}</p><a href={file.storagePath} target="_blank" rel="noreferrer" className="text-brand-primary text-sm">فتح الملف ↗</a></GlassCard>)}{files.length === 0 && <p className="text-brand-textMuted">لا توجد ملفات بعد.</p>}</div>
    </AppShell>
  );
}
