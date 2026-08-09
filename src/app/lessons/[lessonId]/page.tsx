"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { LessonBlockView } from "@/components/LessonBlockView";
import { BlockFileUpload } from "@/components/BlockFileUpload";
import { Lesson, LessonBlock, LessonBlockType } from "@/lib/types";

const blockLabels: Record<LessonBlockType, string> = {
  heading: "عنوان رئيسي",
  subheading: "عنوان فرعي",
  "paragraph-ar": "فقرة عربية",
  "paragraph-en": "فقرة إنجليزية",
  bilingual: "نص ثنائي اللغة",
  note: "ملاحظة",
  alert: "تنبيه",
  example: "مثال",
  rule: "قاعدة",
  image: "صورة",
  pdf: "ملف PDF",
  audio: "تسجيل صوتي",
  youtube: "فيديو يوتيوب",
  "google-drive": "ملف Google Drive",
  "book-page": "صفحة من الكتاب",
  "vocabulary-word": "كلمة مفردة",
  "vocabulary-list": "قائمة مفردات",
  "quiz-question": "سؤال داخل الدرس",
};

// كتل المحتوى اللي بتاخذ ملف مرفوع (رفع مباشر) بدل نص عادي
const UPLOAD_TYPES: LessonBlockType[] = ["image", "pdf", "audio", "book-page"];
// كتل تحتاج فقط لصق رابط (يوتيوب / Google Drive لازم رابط مو ملف)
const LINK_ONLY_TYPES: LessonBlockType[] = ["youtube", "google-drive"];

function newBlock(type: LessonBlockType, order: number): LessonBlock {
  return { id: crypto.randomUUID(), type, content: "", order };
}

export default function LessonEditorPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const [lesson, setLesson] = useState<(Lesson & { id: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "lessons", lessonId), (snap) => {
      if (snap.exists()) setLesson({ ...(snap.data() as Lesson), id: snap.id });
    });
    return () => unsub();
  }, [lessonId]);

  const save = async (blocks: LessonBlock[]) => {
    setSaving(true);
    await updateDoc(doc(db, "lessons", lessonId), {
      blocks,
      updatedAt: Date.now(),
    });
    setSaving(false);
  };

  const addBlock = (type: LessonBlockType) => {
    if (!lesson) return;
    const blocks = [...lesson.blocks, newBlock(type, lesson.blocks.length)];
    save(blocks);
  };

  const updateBlockContent = (id: string, content: string) => {
    if (!lesson) return;
    const blocks = lesson.blocks.map((b) => (b.id === id ? { ...b, content } : b));
    setLesson({ ...lesson, blocks });
  };

  const commitBlock = (id: string) => {
    if (!lesson) return;
    save(lesson.blocks);
  };

  const setBlockContentAndSave = (id: string, content: string) => {
    if (!lesson) return;
    const blocks = lesson.blocks.map((b) => (b.id === id ? { ...b, content } : b));
    setLesson({ ...lesson, blocks });
    save(blocks);
  };

  const removeBlock = (id: string) => {
    if (!lesson) return;
    save(lesson.blocks.filter((b) => b.id !== id));
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    if (!lesson) return;
    const blocks = [...lesson.blocks];
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    save(blocks.map((b, i) => ({ ...b, order: i })));
  };

  const publish = () => {
    if (!lesson) return;
    updateDoc(doc(db, "lessons", lessonId), {
      status: lesson.status === "published" ? "draft" : "published",
      publishedAt: Date.now(),
    });
  };

  if (!lesson) {
    return (
      <AppShell requireRole="teacher">
        <p className="text-brand-textMuted">جاري التحميل...</p>
      </AppShell>
    );
  }

  return (
    <AppShell requireRole="teacher">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-brand-text">{lesson.title}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setPreview((p) => !p)}>
            {preview ? "إنهاء المعاينة" : "معاينة كطالب"}
          </Button>
          <Button
            variant={lesson.status === "published" ? "danger" : "primary"}
            onClick={publish}
          >
            {lesson.status === "published" ? "إلغاء النشر" : "نشر الدرس"}
          </Button>
        </div>
      </div>

      {!preview && (
        <GlassCard className="mb-6">
          <h2 className="font-bold text-brand-text mb-3">إضافة كتلة محتوى</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(blockLabels) as LessonBlockType[]).map((type) => (
              <button
                key={type}
                onClick={() => addBlock(type)}
                className="px-3 py-1.5 rounded-xl bg-brand-primary/10 text-brand-primary text-xs hover:bg-brand-primary/20"
              >
                + {blockLabels[type]}
              </button>
            ))}
          </div>
          {saving && <p className="text-xs text-brand-textMuted mt-2">جارٍ الحفظ...</p>}
        </GlassCard>
      )}

      <div className="flex flex-col gap-4">
        {lesson.blocks
          .sort((a, b) => a.order - b.order)
          .map((block, idx) => (
            <GlassCard key={block.id} className="relative">
              {!preview && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-brand-primary font-medium">
                    {blockLabels[block.type]}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => moveBlock(idx, -1)} className="text-xs px-1">▲</button>
                    <button onClick={() => moveBlock(idx, 1)} className="text-xs px-1">▼</button>
                    <button
                      onClick={() => removeBlock(block.id)}
                      className="text-xs px-1 text-brand-error"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              )}

              {preview ? (
                <LessonBlockView block={block} />
              ) : UPLOAD_TYPES.includes(block.type) ? (
                <div className="flex flex-col gap-2">
                  <BlockFileUpload
                    type={block.type as "image" | "pdf" | "audio" | "book-page"}
                    onUploaded={(url) => setBlockContentAndSave(block.id, url)}
                  />
                  <input
                    value={block.content}
                    onChange={(e) => updateBlockContent(block.id, e.target.value)}
                    onBlur={() => commitBlock(block.id)}
                    dir="ltr"
                    placeholder="أو الصق رابط مباشر هنا"
                    className="w-full px-3 py-2 rounded-xl border border-brand-primary/20 bg-white/70 outline-none text-xs"
                  />
                  {block.content && (
                    <p className="text-xs text-brand-success">✅ تم إرفاق ملف — اضغط "معاينة كطالب" لمشاهدته</p>
                  )}
                </div>
              ) : LINK_ONLY_TYPES.includes(block.type) ? (
                <input
                  value={block.content}
                  onChange={(e) => updateBlockContent(block.id, e.target.value)}
                  onBlur={() => commitBlock(block.id)}
                  dir="ltr"
                  placeholder={
                    block.type === "youtube"
                      ? "الصق رابط فيديو يوتيوب (youtube.com أو youtu.be)"
                      : "الصق رابط مشاركة Google Drive"
                  }
                  className="w-full px-3 py-2 rounded-xl border border-brand-primary/20 bg-white/70 outline-none"
                />
              ) : (
                <textarea
                  value={block.content}
                  onChange={(e) => updateBlockContent(block.id, e.target.value)}
                  onBlur={() => commitBlock(block.id)}
                  dir={block.type.includes("en") || block.type === "vocabulary-word" ? "ltr" : "rtl"}
                  rows={block.type === "heading" || block.type === "subheading" ? 1 : 3}
                  placeholder="اكتب المحتوى هنا..."
                  className="w-full px-3 py-2 rounded-xl border border-brand-primary/20 bg-white/70 outline-none"
                />
              )}
            </GlassCard>
          ))}
        {lesson.blocks.length === 0 && (
          <p className="text-brand-textMuted text-center py-8">
            لا يوجد محتوى بعد — استخدم الأزرار أعلاه لإضافة كتل.
          </p>
        )}
      </div>
    </AppShell>
  );
}

