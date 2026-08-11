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
import { detectVideoType } from "@/lib/embed";

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
  const [formError, setFormError] = useState("");

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
    setFormError("");
  };

  const addLesson = async () => {
    setFormError("");
    if (!form.title.trim()) {
      setFormError("لازم تكتب عنوان الدرس.");
      return;
    }
    if (!user || !unit) {
      setFormError("تعذّر تحديد المستخدم أو الوحدة. أعد تحميل الصفحة وحاول مجددًا.");
      return;
    }

    const blocks: LessonBlock[] = [];
    let order = 0;

    const videoUrl = form.videoUrl.trim();
    if (videoUrl) {
      const videoType = detectVideoType(videoUrl);
      if (!videoType) {
        // رابط فيديو غير مدعوم (مو يوتيوب ولا Google Drive) — نوقف الحفظ ونوضّح للمعلم
        // بدل ما نخزّن كتلة فيديو مكسورة ما بتشتغل عند الطالب
        setFormError(
          "رابط الفيديو غير مدعوم. استخدم رابط يوتيوب (youtube.com / youtu.be) أو رابط مشاركة Google Drive فقط."
        );
        return;
      }
      blocks.push({ id: crypto.randomUUID(), type: videoType, content: videoUrl, order: order++ });
    }

    setSaving(true);
    try {
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

      // نتأكد إنه ما في أي قيمة undefined بالمستند — Firestore يرفض الحفظ بصمت
      // (بدون رسالة خطأ واضحة بالواجهة) إذا لقى undefined بأي حقل، وهاد كان
      // سبب مشكلة "الدرس ما ينزل" عند بعض الوحدات القديمة اللي بدون stageId
      await createDoc("lessons", {
        title: form.title.trim(),
        unitId,
        stageId: unit.stageId ?? "",
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
    } catch (err) {
      console.error("addLesson failed:", err);
      setFormError("صار خطأ أثناء حفظ الدرس. تأكد من اتصال الإنترنت وحاول مرة ثانية.");
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

          {formError && (
            <p className="text-brand-error text-sm bg-brand-error/10 rounded-xl p-3">⚠️ {formError}</p>
          )}

          <Button onClick={addLesson} disabled={saving || !form.title.trim()}>
            {saving ? "جارٍ الحفظ..." : "إنشاء الدرس"}
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}
