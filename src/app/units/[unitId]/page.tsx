"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Modal, Toast } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LessonBlockView } from "@/components/LessonBlockView";
import { QuizPreviewPlayer } from "@/components/QuizPreviewPlayer";
import {
  listenCollection,
  createDoc,
  where,
  orderBy,
} from "@/lib/firestore-helpers";
import { Lesson, Unit, LessonBlock, LessonQuizQuestion } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { getYoutubeEmbedUrl, getDriveEmbedUrl } from "@/lib/embed";

const MAX_PDF_BYTES = 4 * 1024 * 1024; // 4 MB حسب طلبك بالضبط

// سؤال Quick Quiz أثناء الإنشاء — correctIndex يبقى null لحد ما المعلم
// يختار الإجابة الصحيحة بنفسه، حتى نقدر نمنع الحفظ لو ما اختار
interface DraftQuestion {
  id: string;
  text: string;
  options: [string, string, string, string];
  correctIndex: number | null;
}

function emptyDraftQuestion(): DraftQuestion {
  return { id: crypto.randomUUID(), text: "", options: ["", "", "", ""], correctIndex: null };
}

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

export default function UnitLessonsPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const [lessons, setLessons] = useState<(Lesson & { id: string })[]>([]);
  const [unit, setUnit] = useState<(Unit & { id: string }) | null>(null);
  const { user } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", videoUrl: "", notes: "" });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [previewLesson, setPreviewLesson] = useState<(Lesson & { id: string }) | null>(null);

  const [quizDrafts, setQuizDrafts] = useState<DraftQuestion[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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
    setForm({ title: "", description: "", videoUrl: "", notes: "" });
    setPdfFile(null);
    setPdfError("");
    setUploadProgress(null);
    setQuizDrafts([]);
    setFieldErrors({});
  };

  const addQuizQuestion = () => setQuizDrafts((qs) => [...qs, emptyDraftQuestion()]);
  const removeQuizQuestion = (id: string) => setQuizDrafts((qs) => qs.filter((q) => q.id !== id));
  const updateQuizQuestion = (id: string, patch: Partial<DraftQuestion>) =>
    setQuizDrafts((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const updateQuizOption = (id: string, optIndex: number, value: string) =>
    setQuizDrafts((qs) =>
      qs.map((q) => {
        if (q.id !== id) return q;
        const options = [...q.options] as [string, string, string, string];
        options[optIndex] = value;
        return { ...q, options };
      })
    );

  // يتحقق من جميع بيانات الدرس والـ Quick Quiz قبل الحفظ، ويبني رسائل خطأ
  // واضحة مربوطة بكل حقل بالتحديد بدل رسالة عامة واحدة
  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = "عنوان الدرس مطلوب.";

    quizDrafts.forEach((q, i) => {
      if (!q.text.trim()) {
        errors[`quiz-${q.id}`] = `السؤال ${i + 1}: لازم يكون فيه نص للسؤال.`;
        return;
      }
      const emptyOptionIndex = q.options.findIndex((o) => !o.trim());
      if (emptyOptionIndex !== -1) {
        errors[`quiz-${q.id}`] = `السؤال ${i + 1}: الاختيار ${OPTION_LABELS[emptyOptionIndex]} فارغ.`;
        return;
      }
      if (q.correctIndex === null) {
        errors[`quiz-${q.id}`] = `السؤال ${i + 1}: لازم تحدد الإجابة الصحيحة.`;
      }
    });

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const addLesson = async () => {
    if (!validate()) {
      showToast("في حقول ناقصة أو غير مكتملة — راجع التنبيهات الحمراء بالنموذج", "error");
      return;
    }
    if (!user) return;
    if (!unit) {
      showToast("لسا بيانات الوحدة ما تحمّلت، انتظر ثانية وجرب مجددًا", "error");
      return;
    }

    setSaving(true);
    try {
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
          // رابط فيديو غير معروف الصيغة: نضيفه كرابط يوتيوب كمحاولة افتراضية،
          // ويمكن للمعلم تعديل نوع الكتلة لاحقًا من محرر الدرس الكامل
          blocks.push({ id: crypto.randomUUID(), type: "youtube", content: form.videoUrl.trim(), order: order++ });
        }
      }

      if (pdfFile) {
        setUploadProgress(0);
        const path = `lesson-files/${Date.now()}-${pdfFile.name}`;
        const storageRef = ref(storage, path);
        const task = uploadBytesResumable(storageRef, pdfFile);
        const pdfUrl = await new Promise<string>((resolve, reject) => {
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

      const quizQuestions: LessonQuizQuestion[] = quizDrafts.map((q, i) => ({
        id: q.id,
        text: q.text.trim(),
        options: q.options.map((o) => o.trim()),
        correctIndex: q.correctIndex as number,
        order: i,
      }));

      const lessonData = {
        title: form.title.trim(),
        description: form.description.trim() || "",
        unitId,
        stageId: unit.stageId ?? "",
        status: "draft" as const,
        order: lessons.length,
        targetGroupIds: [] as string[],
        blocks,
        quizQuestions,
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // بنتحقق فعليًا من نجاح الكتابة بقاعدة البيانات (createDoc بيرجع
      // مرجع المستند الجديد فقط لو الكتابة نجحت فعلًا — أي فشل بيرمي
      // استثناء بينمسك بالـ catch تحت، فما في احتمال نعتبر الدرس "انحفظ"
      // وهو أصلًا فشل)
      const docRef = await createDoc("lessons", lessonData);

      showToast("✅ تم إنشاء الدرس بنجاح", "success");
      resetForm();
      setModalOpen(false);
      // نفتح معاينة الطالب فورًا بعد نجاح الحفظ، بنفس البيانات يلي
      // تأكدنا إنها انحفظت (بدل ما ننتظر تحميل جديد من Firestore)
      setPreviewLesson({ ...lessonData, id: docRef.id } as Lesson & { id: string });
    } catch (err) {
      // قبل هيك ما كان في أي رسالة للمعلم لما يفشل الحفظ — كان الدرس
      // "بيختفي" بصمت بدون أي تفسير. هلق بنعرض السبب الحقيقي مباشرة.
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`تعذّر حفظ الدرس: ${msg}`, "error");
    } finally {
      setSaving(false);
      setUploadProgress(null);
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
          <GlassCard key={l.id} className="hover:shadow-lg transition-shadow">
            <Link href={`/lessons/${l.id}`}>
              <div className="flex items-center justify-between cursor-pointer">
                <h3 className="font-bold text-brand-text">{l.title}</h3>
                <StatusBadge
                  label={l.status === "published" ? "منشور" : "مسودة"}
                  tone={l.status === "published" ? "success" : "warning"}
                />
              </div>
              <p className="text-brand-textMuted text-sm mt-1">
                {l.blocks?.length ?? 0} كتلة محتوى
                {l.quizQuestions?.length ? ` · ${l.quizQuestions.length} سؤال كويز` : ""}
              </p>
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewLesson(l);
              }}
              className="mt-3 text-xs text-brand-primary font-medium flex items-center gap-1"
            >
              👁️ معاينة كطالب
            </button>
          </GlassCard>
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
            const insideQuiz = !!target.closest("[data-quiz-section]");
            if (e.key === "Enter" && target.tagName !== "TEXTAREA" && !insideQuiz) {
              e.preventDefault();
              if (!saving) addLesson();
            }
          }}
        >
          <div>
            <label className="text-sm text-brand-text block mb-1.5">عنوان الدرس *</label>
            <input
              placeholder="مثال: Present Simple"
              value={form.title}
              onChange={(e) => {
                setForm({ ...form, title: e.target.value });
                if (fieldErrors.title) setFieldErrors((f) => ({ ...f, title: "" }));
              }}
              className={`w-full px-3 py-2 rounded-xl border bg-surface/70 ${
                fieldErrors.title ? "border-brand-error" : "border-brand-primary/25"
              }`}
            />
            {fieldErrors.title && <p className="text-brand-error text-xs mt-1">⚠️ {fieldErrors.title}</p>}
          </div>

          <div>
            <label className="text-sm text-brand-text block mb-1.5">وصف الدرس (اختياري)</label>
            <textarea
              placeholder="وصف مختصر بيشوفه الطالب قبل ما يبلش الدرس..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
            />
          </div>

          <div>
            <label className="text-sm text-brand-text block mb-1.5">رابط الفيديو (اختياري)</label>
            <input
              placeholder="رابط يوتيوب أو Google Drive"
              dir="ltr"
              value={form.videoUrl}
              onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
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
              className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
            />
          </div>

          <p className="text-xs text-brand-textMuted">
            بعد الإنشاء تقدر تضيف المزيد من المحتوى (صور، صفحات كتاب، مفردات...) من صفحة الدرس الكاملة.
          </p>

          {/* Quick Quiz — نفس بنية quizQuestions الموجودة أصلاً بالنظام
              (id, text, options[4], correctIndex, order)، بدون أي جدول
              أو نظام موازٍ جديد */}
          <div className="border-t border-brand-primary/10 pt-4" data-quiz-section>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-brand-text">Quick Quiz (اختياري)</label>
              <button
                type="button"
                onClick={addQuizQuestion}
                className="text-brand-primary text-sm font-medium"
              >
                + إضافة سؤال
              </button>
            </div>

            {quizDrafts.length === 0 && (
              <p className="text-brand-textMuted text-xs">
                ما ضفت أسئلة بعد. الكويز اختياري — تقدر تنشئ الدرس بدونه وتضيفه لاحقًا.
              </p>
            )}

            <div className="flex flex-col gap-3">
              {quizDrafts.map((q, qi) => (
                <div key={q.id} className="bg-brand-primary/5 rounded-2xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-primary">سؤال {qi + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeQuizQuestion(q.id)}
                      className="text-brand-error text-xs"
                    >
                      🗑 حذف
                    </button>
                  </div>
                  <input
                    placeholder="نص السؤال"
                    dir="ltr"
                    value={q.text}
                    onChange={(e) => updateQuizQuestion(q.id, { text: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-brand-primary/20 bg-surface/80 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {OPTION_LABELS.map((label, oi) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={q.correctIndex === oi}
                          onChange={() => updateQuizQuestion(q.id, { correctIndex: oi })}
                          className="shrink-0"
                          aria-label={`الإجابة الصحيحة هي ${label}`}
                        />
                        <input
                          placeholder={label}
                          dir="ltr"
                          value={q.options[oi]}
                          onChange={(e) => updateQuizOption(q.id, oi, e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-brand-primary/20 bg-surface/80 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-brand-textMuted">
                    ● اختر الدائرة جنب الاختيار الصحيح
                  </p>
                  {fieldErrors[`quiz-${q.id}`] && (
                    <p className="text-brand-error text-xs">⚠️ {fieldErrors[`quiz-${q.id}`]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button onClick={addLesson} disabled={saving || !unit}>
            {saving ? "جارٍ الحفظ..." : !unit ? "جارٍ تحميل بيانات الوحدة..." : "إنشاء الدرس"}
          </Button>
        </div>
      </Modal>

      {/* معاينة الدرس بالضبط متل ما رح يشوفه الطالب — بنفس المكوّن يلي
          الطالب نفسه يشوفه (LessonBlockView)، جوا نافذة منبثقة داخل
          التطبيق نفسه، بدون ما نضطر نفتح حساب طالب تجريبي أو صفحة منفصلة. */}
      <Modal
        open={!!previewLesson}
        onClose={() => setPreviewLesson(null)}
        title={previewLesson ? `معاينة كطالب — ${previewLesson.title}` : "معاينة"}
        maxWidth="max-w-2xl"
      >
        {previewLesson && (
          <div className="flex flex-col gap-5">
            <p className="text-xs text-brand-textMuted bg-brand-primary/5 rounded-xl p-2.5">
              هيك بالضبط رح يشوف الطالب هالدرس — نفس الترتيب ونفس المحتوى. هاي معاينة فقط، ما بتأثر على شي.
            </p>
            <div>
              <p className="text-xs text-brand-primary font-medium mb-1">
                الوحدة: {unit?.title ?? "—"}
              </p>
              <h3 dir="ltr" className="text-lg font-bold text-brand-text">{previewLesson.title}</h3>
              {previewLesson.description && (
                <p className="text-brand-textMuted text-sm mt-1">{previewLesson.description}</p>
              )}
            </div>
            {(previewLesson.blocks ?? [])
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((block) => (
                <LessonBlockView key={block.id} block={block} />
              ))}
            {(!previewLesson.blocks || previewLesson.blocks.length === 0) && (
              <p className="text-brand-textMuted text-sm">هذا الدرس ما فيه محتوى مضاف بعد.</p>
            )}
            {previewLesson.quizQuestions && previewLesson.quizQuestions.length > 0 && (
              <div className="border-t border-brand-primary/10 pt-4">
                <p className="text-sm font-medium text-brand-text mb-3">
                  🧠 كويز الدرس ({previewLesson.quizQuestions.length} سؤال) — جرّبه متل ما رح يشوفه الطالب بالضبط
                </p>
                <QuizPreviewPlayer questions={previewLesson.quizQuestions} />
              </div>
            )}
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </AppShell>
  );
}
