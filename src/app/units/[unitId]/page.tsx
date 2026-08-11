"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  listenCollection,
  createDoc,
  where,
  orderBy,
} from "@/lib/firestore-helpers";
import { Lesson, Unit, LessonBlock } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { getYoutubeEmbedUrl, getDriveEmbedUrl } from "@/lib/embed";

const MAX_PDF_BYTES = 4 * 1024 * 1024; // 4 MB حسب طلبك بالضبط

export default function UnitLessonsPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const [lessons, setLessons] = useState<(Lesson & { id: string })[]>([]);
  const [unit, setUnit] = useState<(Unit & { id: string }) | null>(null);
  const { user } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: "", videoUrl: "", notes: "" });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const u = listenCollection<Lesson>(
      "lessons",
      [where("unitId", "==", unitId), orderBy("order")],
      setLessons
    );
    getDoc(doc(db, "units", unitId)).then((snap) => {
      if (snap.exists()) setUnit({ ...(snap.data() as Unit), id: snap.id });
    });
    return () => u();
  }, [unitId]);

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPdfError("");
    if (!file) {
      setPdfFile(null);
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setPdfError("الملف يجب أن يكون بصيغة PDF فقط.");
      setPdfFile(null);
      e.target.value = "";
      return;
    }
    if (file.size >= MAX_PDF_BYTES) {
      setPdfError(
        `حجم الملف (${(file.size / (1024 * 1024)).toFixed(1)} MB) أكبر من الحد المسموح (4 MB).`
      );
      setPdfFile(null);
      e.target.value = "";
      return;
    }
    setPdfFile(file);
  };

  const resetForm = () => {
    setForm({ title: "", videoUrl: "", notes: "" });
    setPdfFile(null);
    setPdfError("");
    setUploadProgress(null);
  };

  const addLesson = async () => {
    if (!form.title.trim() || !user || !unit) return;

    const blocks: LessonBlock[] = [];
    let order = 0;

    if (form.videoUrl.trim()) {
      const isYoutube = !!getYoutubeEmbedUrl(form.videoUrl.trim());
      const isDrive = !!getDriveEmbedUrl(form.videoUrl.trim());
      if (isYoutube) {
        blocks.push({ id: crypto.randomUUID(), type: "youtube", content: form.videoUrl.trim(), order: order++ });
      } else if (isDrive) {
        blocks.push({ id: crypto.randomUUID(), type: "google-drive", content: form.videoUrl.trim(), order: order++ });
      } else {
        // رابط فيديو غير معروف الصيغة: نضيفه كرابط Google Drive كمحاولة افتراضية آمنة،
        // ويمكن للمعلم تعديل نوع الكتلة لاحقًا من محرر الدرس الكامل
        blocks.push({ id: crypto.randomUUID(), type: "youtube", content: form.videoUrl.trim(), order: order++ });
      }
    }

    let pdfUrl = "";
    if (pdfFile) {
      setUploadProgress(0);
      const path = `lesson-files/${Date.now()}-${pdfFile.name}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, pdfFile);
      pdfUrl = await new Promise<string>((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
          (err) => reject(err),
          async () => resolve(await getDownloadURL(task.snapshot.ref))
        );
      });
      blocks.push({ id: crypto.randomUUID(), type: "pdf", content: pdfUrl, order: order++ });
    }

    if (form.notes.trim()) {
      blocks.push({ id: crypto.randomUUID(), type: "note", content: form.notes.trim(), order: order++ });
    }

    setSaving(true);
    try {
      await createDoc("lessons", {
        title: form.title.trim(),
        unitId,
        stageId: unit.stageId,
        status: "draft",
        order: lessons.length,
        targetGroupIds: [],
        blocks,
        quizQuestions: [],
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      resetForm();
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell requireRole="teacher">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand-text">
          دروس الوحدة {unit ? `— ${unit.title}` : ""}
        </h1>
        <Button onClick={() => setModalOpen(true)}>+ إضافة درس</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {lessons.map((l) => (
          <Link key={l.id} href={`/lessons/${l.id}`}>
            <GlassCard className="hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-brand-text">{l.title}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    l.status === "published"
                      ? "bg-brand-success/15 text-brand-success"
                      : "bg-brand-warning/15 text-brand-warning"
                  }`}
                >
                  {l.status === "published" ? "منشور" : "مسودة"}
                </span>
              </div>
              <p className="text-brand-textMuted text-sm mt-1">
                {l.blocks?.length ?? 0} كتلة محتوى
                {l.quizQuestions?.length ? ` · ${l.quizQuestions.length} سؤال كويز` : ""}
              </p>
            </GlassCard>
          </Link>
        ))}
        {lessons.length === 0 && (
          <p className="text-brand-textMuted">لا توجد دروس بعد.</p>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title="إضافة درس جديد"
        maxWidth="max-w-lg"
      >
        <div
          className="flex flex-col gap-4"
          onKeyDown={(e) => {
            const target = e.target as HTMLElement;
            if (e.key === "Enter" && target.tagName !== "TEXTAREA") {
              e.preventDefault();
              if (!saving && form.title.trim()) addLesson();
            }
          }}
        >
          <div>
            <label className="text-sm text-brand-text block mb-1.5">عنوان الدرس *</label>
            <input
              placeholder="مثال: Present Simple"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
            />
          </div>

          <div>
            <label className="text-sm text-brand-text block mb-1.5">رابط الفيديو (اختياري)</label>
            <input
              placeholder="رابط يوتيوب أو Google Drive"
              dir="ltr"
              value={form.videoUrl}
              onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
            />
          </div>

          <div>
            <label className="text-sm text-brand-text block mb-1.5">
              ملف PDF (اختياري — حد أقصى 4 MB)
            </label>
            <input type="file" accept=".pdf,application/pdf" onChange={handlePdfSelect} className="text-sm" />
            {pdfError && <p className="text-brand-error text-xs mt-1">{pdfError}</p>}
            {pdfFile && !pdfError && (
              <p className="text-brand-success text-xs mt-1">
                ✅ {pdfFile.name} ({(pdfFile.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            )}
            {uploadProgress !== null && (
              <p className="text-brand-textMuted text-xs mt-1">جارٍ الرفع {Math.round(uploadProgress)}%</p>
            )}
          </div>

          <div>
            <label className="text-sm text-brand-text block mb-1.5">ملاحظات الدرس (اختياري)</label>
            <textarea
              placeholder="شرح إضافي أو ملاحظات للطالب..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
            />
          </div>

          <p className="text-xs text-brand-textMuted">
            بعد الإنشاء تقدر تضيف المزيد من المحتوى (صور، صفحات كتاب، مفردات...) وأسئلة الكويز من صفحة الدرس الكاملة.
          </p>

          <Button onClick={addLesson} disabled={saving || !form.title.trim()}>
            {saving ? "جارٍ الحفظ..." : "إنشاء الدرس"}
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}
