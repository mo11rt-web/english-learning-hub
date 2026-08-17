"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { Eye, ImagePlus, Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal, Toast } from "@/components/ui/Modal";
import { listenCollection, createDoc, deleteDocById, updateDocById, orderBy } from "@/lib/firestore-helpers";
import { Announcement, AnnouncementStatus, Group } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { notifyUsers, getStudentUidsForStage } from "@/lib/notifications";
import { toStoredTargetGroupIds } from "@/lib/groupTargeting";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { formatSyrianDate } from "@/lib/dateUtils";

const statusLabels: Record<AnnouncementStatus, string> = { draft: "مسودة", published: "منشور", expired: "منتهي" };
const statusStyles: Record<AnnouncementStatus, string> = {
  draft: "bg-surfaceBorder/50 text-brand-textMuted",
  published: "bg-brand-success/15 text-brand-success",
  expired: "bg-brand-error/10 text-brand-error",
};

type PreviewAnnouncement = Omit<Announcement, "id"> & { id?: string };

function formatDate(timestamp?: number) {
  return timestamp ? formatSyrianDate(timestamp) : "بدون تاريخ انتهاء";
}

function asDateTimeLocal(timestamp?: number) {
  if (!timestamp) return "";
  const original = new Date(timestamp);
  const adjusted = new Date(original.getTime() - original.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { stageId: workspaceStageId, stageName: workspaceStageName } = useWorkspace();
  const [items, setItems] = useState<(Announcement & { id: string })[]>([]);
  const [groups, setGroups] = useState<(Group & { id: string })[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [status, setStatus] = useState<AnnouncementStatus>("draft");
  const [featured, setFeatured] = useState(false);
  const [publicAnnouncement, setPublicAnnouncement] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewItem, setPreviewItem] = useState<PreviewAnnouncement | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    const u1 = listenCollection<Announcement>("announcements", [orderBy("createdAt", "desc")], setItems, (error) => showToast(`تعذّر تحميل الإعلانات: ${error.message}`, "error"));
    const u2 = listenCollection<Group>("groups", [], setGroups);
    return () => { u1(); u2(); };
  }, []);

  const groupsInWorkspace = groups.filter((group) => group.stageId === workspaceStageId);
  const itemsInWorkspace = useMemo(() => items.filter((item) => !workspaceStageId || item.stageId === workspaceStageId || !item.stageId), [items, workspaceStageId]);

  const resetForm = () => {
    setEditingId(null); setTitle(""); setBody(""); setTargetGroupId(""); setLinkUrl(""); setStartAt(""); setEndAt(""); setStatus("draft"); setFeatured(false); setPublicAnnouncement(false); setImageUrl(""); setImageFile(null);
  };

  const notifyPublished = async (announcementTitle: string, targetIds: string[]) => {
    if (!workspaceStageId || status !== "published") return;
    const studentUids = await getStudentUidsForStage(workspaceStageId, targetIds);
    await notifyUsers(studentUids, { title: "إعلان جديد من المعلم", body: announcementTitle, type: "announcement", link: "/student/home" });
  };

  const save = async () => {
    if (!user || !workspaceStageId) return showToast("اختر القسم الحالي أولاً.", "error");
    if (!title.trim() || !body.trim()) return showToast("يجب إدخال عنوان ونص الإعلان.", "error");
    if (publicAnnouncement && targetGroupId) return showToast("الإعلان الظاهر قبل تسجيل الدخول يجب أن يكون موجهاً لجميع الطلاب.", "error");
    setSaving(true);
    try {
      const targetGroupIds = toStoredTargetGroupIds(targetGroupId ? [targetGroupId] : []);
      const uploadedImageUrl = imageFile ? (await uploadImageToCloudinary(imageFile)).secureUrl : imageUrl.trim();
      const now = Date.now();
      const payload = {
        title: title.trim(), body: body.trim(), targetGroupIds, stageId: workspaceStageId,
        ...(uploadedImageUrl ? { imageUrl: uploadedImageUrl } : {}), ...(linkUrl.trim() ? { linkUrl: linkUrl.trim() } : {}),
        ...(startAt ? { startAt: new Date(startAt).getTime() } : {}), ...(endAt ? { endAt: new Date(endAt).getTime() } : {}),
        featured, public: publicAnnouncement, status, updatedAt: now,
      };
      if (editingId) await updateDocById("announcements", editingId, payload);
      else await createDoc("announcements", { ...payload, createdBy: user.uid, createdAt: now });
      if (status === "published") await notifyPublished(title.trim(), targetGroupId ? [targetGroupId] : []);
      showToast(editingId ? "تم تحديث الإعلان ✅" : "تم حفظ الإعلان ✅");
      resetForm();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "تعذّر حفظ الإعلان.", "error");
    } finally { setSaving(false); }
  };

  const startEdit = (item: Announcement & { id: string }) => {
    setEditingId(item.id); setTitle(item.title); setBody(item.body); setTargetGroupId(item.targetGroupIds?.find((id) => id !== "__all__") ?? ""); setLinkUrl(item.linkUrl ?? ""); setStartAt(asDateTimeLocal(item.startAt)); setEndAt(asDateTimeLocal(item.endAt)); setStatus(item.status ?? "published"); setFeatured(Boolean(item.featured)); setPublicAnnouncement(Boolean(item.public)); setImageUrl(item.imageUrl ?? ""); setImageFile(null); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AppShell requireRole="teacher">
      <PageHeader icon="📣" title="الإعلانات" meta={<span className="text-xs text-brand-textMuted">القسم الحالي: {workspaceStageName ?? "—"}</span>} />
      <GlassCard className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-4"><h2 className="font-bold text-brand-text">{editingId ? "تعديل الإعلان" : "إعلان جديد"}</h2>{editingId && <button onClick={resetForm} className="text-xs text-brand-textMuted">إلغاء التعديل</button>}</div>
        <div className="grid md:grid-cols-2 gap-3">
          <input placeholder="عنوان الإعلان" value={title} onChange={(event) => setTitle(event.target.value)} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
          <select value={targetGroupId} onChange={(event) => setTargetGroupId(event.target.value)} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"><option value="">جميع الطلاب في القسم</option>{groupsInWorkspace.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
          <textarea placeholder="نص الإعلان" value={body} onChange={(event) => setBody(event.target.value)} rows={4} className="md:col-span-2 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
          <input placeholder="رابط اختياري" dir="ltr" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
          <div className="flex flex-col gap-1.5 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"><label className="flex items-center gap-2 text-sm text-brand-textMuted cursor-pointer"><ImagePlus size={17} /><span className="truncate">{imageFile?.name ?? "رفع صورة عبر Cloudinary المجاني"}</span><input type="file" accept="image/*" className="hidden" onChange={(event) => { setImageFile(event.target.files?.[0] ?? null); setImageUrl(""); }} /></label><input dir="ltr" placeholder="أو ضع رابط صورة خارجي" value={imageUrl} onChange={(event) => { setImageUrl(event.target.value); setImageFile(null); }} className="w-full bg-transparent outline-none text-xs" /></div>
          <label className="text-sm text-brand-textMuted">يبدأ العرض<input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" /></label>
          <label className="text-sm text-brand-textMuted">ينتهي العرض<input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value as AnnouncementStatus)} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"><option value="draft">مسودة</option><option value="published">منشور</option><option value="expired">منتهي</option></select>
          <div className="flex flex-wrap items-center gap-4 text-sm text-brand-text"><label className="flex items-center gap-2"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} /> إعلان بارز</label><label className="flex items-center gap-2"><input type="checkbox" checked={publicAnnouncement} onChange={(event) => setPublicAnnouncement(event.target.checked)} /> يظهر قبل تسجيل الدخول</label></div>
        </div>
        <div className="flex gap-2 mt-4"><Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "نشر الإعلان"} <Plus size={16} /></Button>{(title || body) && <button onClick={() => setPreviewItem({ title, body, targetGroupIds: [], createdBy: user?.uid ?? "", createdAt: Date.now(), imageUrl: imageFile ? "" : imageUrl, linkUrl, status, featured, public: publicAnnouncement })} className="px-4 py-2 rounded-xl bg-surfaceBorder/50 text-brand-text text-sm flex items-center gap-2"><Eye size={16} /> معاينة</button>}</div>
      </GlassCard>

      <div className="flex flex-col gap-3 pb-24">{itemsInWorkspace.map((item) => <GlassCard key={item.id} className={item.status === "expired" ? "opacity-60" : ""}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-brand-text">{item.title}</h3><span className={`px-2 py-1 rounded-lg text-[11px] ${statusStyles[item.status ?? "published"]}`}>{statusLabels[item.status ?? "published"]}</span>{item.featured && <span className="text-[11px] text-brand-gold">بارز</span>}</div><p className="text-brand-text text-sm mt-1 whitespace-pre-wrap">{item.body}</p><p className="text-xs text-brand-textMuted mt-2">يبدأ: {formatDate(item.startAt)} · ينتهي: {formatDate(item.endAt)}</p></div><div className="flex items-center gap-1 shrink-0"><button onClick={() => setPreviewItem(item)} className="p-2 text-brand-textMuted hover:text-brand-primary" title="معاينة"><Eye size={16} /></button><button onClick={() => startEdit(item)} className="p-2 text-brand-primary" title="تعديل"><Pencil size={16} /></button><button onClick={async () => { if (window.confirm("هل تريد حذف الإعلان؟")) { await deleteDocById("announcements", item.id); showToast("تم حذف الإعلان"); } }} className="p-2 text-brand-error" title="حذف"><Trash2 size={16} /></button></div></div></GlassCard>)}{itemsInWorkspace.length === 0 && <p className="text-brand-textMuted">لا توجد إعلانات في هذا القسم.</p>}</div>
      <Modal open={Boolean(previewItem)} onClose={() => setPreviewItem(null)} title="معاينة الإعلان" maxWidth="max-w-xl">{previewItem && <div className="rounded-3xl overflow-hidden border border-brand-primary/20 bg-surface"><div className="h-2 bg-gradient-to-l from-brand-primary to-brand-secondary" />{previewItem.imageUrl && <img src={previewItem.imageUrl} alt="" className="w-full max-h-64 object-cover" />}<div className="p-5"><div className="flex items-center justify-between gap-2"><h3 className="text-xl font-bold text-brand-text">{previewItem.title}</h3><span className="text-brand-primary">📣</span></div><p className="text-brand-textMuted mt-3 whitespace-pre-wrap">{previewItem.body}</p>{previewItem.linkUrl && <a href={previewItem.linkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-brand-primary mt-4"><Link2 size={15} /> فتح الرابط</a>}</div></div>}</Modal>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </AppShell>
  );
}
