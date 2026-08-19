"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { Eye, ImagePlus, Link2, Pencil, Plus, Trash2, X, Users, Layout } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal, Toast } from "@/components/ui/Modal";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
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
  const [targetGroupIds, setTargetGroupIds] = useState<string[]>([]);
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
    setEditingId(null);
    setTitle("");
    setBody("");
    setTargetGroupIds([]);
    setLinkUrl("");
    setStartAt("");
    setEndAt("");
    setStatus("draft");
    setFeatured(false);
    setPublicAnnouncement(false);
    setImageUrl("");
    setImageFile(null);
  };

  const notifyPublished = async (announcementTitle: string, targetIds: string[]) => {
    if (!workspaceStageId || status !== "published") return;
    const studentUids = await getStudentUidsForStage(workspaceStageId, targetIds);
    await notifyUsers(studentUids, { title: "إعلان جديد من المعلم", body: announcementTitle, type: "announcement", link: "/student/home" });
  };

  const save = async () => {
    if (!user || !workspaceStageId) return showToast("اختر القسم الحالي أولاً.", "error");
    if (!title.trim() || !body.trim()) return showToast("يجب إدخال عنوان ونص الإعلان.", "error");
    if (publicAnnouncement && targetGroupIds.length > 0) return showToast("الإعلان الظاهر قبل تسجيل الدخول يجب أن يكون موجهاً لجميع الطلاب.", "error");
    setSaving(true);
    try {
      const storedGroupIds = toStoredTargetGroupIds(targetGroupIds);
      const uploadedImageUrl = imageFile ? (await uploadImageToCloudinary(imageFile)).secureUrl : imageUrl.trim();
      const now = Date.now();
      const payload = {
        title: title.trim(), body: body.trim(), targetGroupIds: storedGroupIds, stageId: workspaceStageId,
        ...(uploadedImageUrl ? { imageUrl: uploadedImageUrl } : {}), ...(linkUrl.trim() ? { linkUrl: linkUrl.trim() } : {}),
        ...(startAt ? { startAt: new Date(startAt).getTime() } : {}), ...(endAt ? { endAt: new Date(endAt).getTime() } : {}),
        featured, public: publicAnnouncement, status, updatedAt: now,
      };
      if (editingId) await updateDocById("announcements", editingId, payload);
      else await createDoc("announcements", { ...payload, createdBy: user.uid, createdAt: now });
      if (status === "published") await notifyPublished(title.trim(), targetGroupIds);
      showToast(editingId ? "تم تحديث الإعلان ✅" : "تم حفظ الإعلان ✅");
      resetForm();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "تعذّر حفظ الإعلان.", "error");
    } finally { setSaving(false); }
  };

  const startEdit = (item: Announcement & { id: string }) => {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    setTargetGroupIds(item.targetGroupIds?.filter((id) => id !== "__all__") ?? []);
    setLinkUrl(item.linkUrl ?? "");
    setStartAt(asDateTimeLocal(item.startAt));
    setEndAt(asDateTimeLocal(item.endAt));
    setStatus(item.status ?? "published");
    setFeatured(Boolean(item.featured));
    setPublicAnnouncement(Boolean(item.public));
    setImageUrl(item.imageUrl ?? "");
    setImageFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AppShell requireRole="teacher">
      <PageHeader icon="📣" title="الإعلانات" meta={<span className="text-xs text-brand-textMuted">القسم الحالي: {workspaceStageName ?? "—"}</span>} />
      <GlassCard className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-4"><h2 className="font-bold text-brand-text">{editingId ? "تعديل الإعلان" : "إعلان جديد"}</h2>{editingId && <button onClick={resetForm} className="text-xs text-brand-textMuted">إلغاء التعديل</button>}</div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-bold text-brand-primary px-1">عنوان الإعلان</label>
            <input placeholder="مثلاً: تنبيه هام لطلاب البكالوريا" value={title} onChange={(event) => setTitle(event.target.value)} className="px-4 py-3 rounded-2xl border border-brand-primary/20 bg-surface/50 focus:bg-surface transition-all outline-none focus:ring-2 focus:ring-brand-primary/20" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-brand-primary px-1">المنصة المستهدفة</label>
            <div className="px-4 py-3 rounded-2xl border border-brand-primary/10 bg-brand-primary/5 text-brand-primary font-bold flex items-center gap-2 cursor-not-allowed">
              <Layout size={16} /> {workspaceStageName || "القسم الحالي"}
            </div>
            <p className="text-[10px] text-brand-textMuted px-1">يتم ربط الإعلان تلقائياً بالقسم الذي تعمل عليه حالياً.</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-brand-primary px-1">المجموعات المستهدفة</label>
            <div className="relative">
              <Users size={16} className="absolute left-3 top-3.5 text-brand-textMuted" />
              <select 
                multiple
                value={targetGroupIds} 
                onChange={(event) => setTargetGroupIds(Array.from(event.target.selectedOptions, option => option.value))}
                className="w-full pl-3 pr-9 py-3 rounded-2xl border border-brand-primary/20 bg-surface/50 focus:bg-surface transition-all outline-none focus:ring-2 focus:ring-brand-primary/20 min-h-[50px]"
              >
                <option value="">جميع المجموعات</option>
                {groupsInWorkspace.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </div>
            <p className="text-[10px] text-brand-textMuted px-1">اضغط مع Ctrl لاختيار أكثر من مجموعة.</p>
          </div>

          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs font-bold text-brand-primary px-1">نص الإعلان</label>
            <textarea placeholder="اكتب تفاصيل الإعلان هنا..." value={body} onChange={(event) => setBody(event.target.value)} rows={4} className="px-4 py-3 rounded-2xl border border-brand-primary/20 bg-surface/50 focus:bg-surface transition-all outline-none focus:ring-2 focus:ring-brand-primary/20" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-brand-primary px-1">رابط خارجي (اختياري)</label>
            <input placeholder="https://..." dir="ltr" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} className="px-4 py-3 rounded-2xl border border-brand-primary/20 bg-surface/50 focus:bg-surface transition-all outline-none focus:ring-2 focus:ring-brand-primary/20" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-brand-primary px-1">صورة الإعلان</label>
            <div className="flex flex-col gap-2 px-4 py-2.5 rounded-2xl border border-brand-primary/20 bg-surface/50">
              <label className="flex items-center gap-2 text-sm text-brand-text font-medium cursor-pointer hover:text-brand-primary transition-colors">
                <ImagePlus size={18} />
                <span className="truncate">{imageFile?.name ?? "اختر صورة..."}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(event) => { setImageFile(event.target.files?.[0] ?? null); setImageUrl(""); }} />
              </label>
              <input dir="ltr" placeholder="أو رابط صورة مباشر" value={imageUrl} onChange={(event) => { setImageUrl(event.target.value); setImageFile(null); }} className="w-full bg-transparent border-t border-brand-primary/10 pt-1 outline-none text-xs" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-brand-primary px-1 text-right">يبدأ العرض</label>
            <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="px-4 py-3 rounded-2xl border border-brand-primary/20 bg-surface/50 focus:bg-surface transition-all outline-none focus:ring-2 focus:ring-brand-primary/20" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-brand-primary px-1 text-right">ينتهي العرض</label>
            <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} className="px-4 py-3 rounded-2xl border border-brand-primary/20 bg-surface/50 focus:bg-surface transition-all outline-none focus:ring-2 focus:ring-brand-primary/20" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-brand-primary px-1">حالة النشر</label>
            <select value={status} onChange={(event) => setStatus(event.target.value as AnnouncementStatus)} className="px-4 py-3 rounded-2xl border border-brand-primary/20 bg-surface/50 focus:bg-surface transition-all outline-none focus:ring-2 focus:ring-brand-primary/20">
              <option value="draft">مسودة (حفظ فقط)</option>
              <option value="published">منشور (يظهر للطلاب)</option>
              <option value="expired">منتهي (مخفي)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-6 px-2 py-2">
            <div className="flex items-center gap-3">
              <ToggleSwitch checked={featured} onChange={setFeatured} />
              <span className="text-sm font-bold text-brand-text">إعلان بارز (تنبيه)</span>
            </div>
            <div className="flex items-center gap-3">
              <ToggleSwitch checked={publicAnnouncement} onChange={setPublicAnnouncement} />
              <span className="text-sm font-bold text-brand-text text-right">يظهر قبل تسجيل الدخول</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4"><Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "نشر الإعلان"} <Plus size={16} /></Button>{(title || body) && <Button variant="secondary" onClick={() => setPreviewItem({ title, body, targetGroupIds: [], createdBy: user?.uid ?? "", createdAt: Date.now(), imageUrl: imageFile ? "" : imageUrl, linkUrl, status, featured, public: publicAnnouncement })}><Eye size={16} /> معاينة</Button>}</div>
      </GlassCard>

      <div className="flex flex-col gap-3 pb-24">{itemsInWorkspace.map((item) => <GlassCard key={item.id} className={item.status === "expired" ? "opacity-60" : ""}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-brand-text">{item.title}</h3><span className={`px-2 py-1 rounded-lg text-[11px] ${statusStyles[item.status ?? "published"]}`}>{statusLabels[item.status ?? "published"]}</span>{item.featured && <span className="text-[11px] text-brand-gold">بارز</span>}</div><p className="text-brand-text text-sm mt-1 whitespace-pre-wrap">{item.body}</p><p className="text-xs text-brand-textMuted mt-2">يبدأ: {formatDate(item.startAt)} · ينتهي: {formatDate(item.endAt)}</p></div><div className="flex items-center gap-1 shrink-0"><button onClick={() => setPreviewItem(item)} className="grid h-9 w-9 place-items-center rounded-lg text-brand-textMuted hover:bg-surfaceBorder/40 hover:text-brand-primary transition-colors" title="معاينة"><Eye size={16} /></button><button onClick={() => startEdit(item)} className="grid h-9 w-9 place-items-center rounded-lg text-brand-primary hover:bg-surfaceBorder/40 transition-colors" title="تعديل"><Pencil size={16} /></button><button onClick={async () => { if (window.confirm("هل تريد حذف الإعلان؟")) { await deleteDocById("announcements", item.id); showToast("تم حذف الإعلان"); } }} className="grid h-9 w-9 place-items-center rounded-lg text-brand-error hover:bg-surfaceBorder/40 transition-colors" title="حذف"><Trash2 size={16} /></button></div></div></GlassCard>)}{itemsInWorkspace.length === 0 && <p className="text-brand-textMuted">لا توجد إعلانات في هذا القسم.</p>}</div>
      <Modal open={Boolean(previewItem)} onClose={() => setPreviewItem(null)} title="معاينة الإعلان" maxWidth="max-w-xl">{previewItem && <div className="rounded-3xl overflow-hidden border border-brand-primary/20 bg-surface"><div className="h-2 bg-gradient-to-l from-brand-primary to-brand-secondary" />{previewItem.imageUrl && <img src={previewItem.imageUrl} alt="" className="w-full max-h-64 object-cover" />}<div className="p-5"><div className="flex items-center justify-between gap-2"><h3 className="text-xl font-bold text-brand-text">{previewItem.title}</h3><span className="text-brand-primary">📣</span></div><p className="text-brand-textMuted mt-3 whitespace-pre-wrap">{previewItem.body}</p>{previewItem.linkUrl && <a href={previewItem.linkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-brand-primary mt-4"><Link2 size={15} /> فتح الرابط</a>}</div></div>}</Modal>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </AppShell>
  );
}
