"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SpeakButton } from "@/components/SpeakButton";
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
  image: "صورة (رابط)",
  pdf: "ملف PDF (رابط)",
  audio: "تسجيل صوتي (رابط)",
  "vocabulary-word": "كلمة مفردة",
  "vocabulary-list": "قائمة مفردات",
  "quiz-question": "سؤال داخل الدرس",
};

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
                <BlockPreview block={block} />
              ) : (
                <textarea
                  value={block.content}
                  onChange={(e) => updateBlockContent(block.id, e.target.value)}
                  onBlur={() => commitBlock(block.id)}
                  dir={block.type.includes("en") || block.type === "vocabulary-word" ? "ltr" : "rtl"}
                  rows={block.type === "heading" || block.type === "subheading" ? 1 : 3}
                  placeholder={
                    block.type === "image" || block.type === "pdf" || block.type === "audio"
                      ? "الصق رابط الملف من Firebase Storage هنا"
                      : "اكتب المحتوى هنا..."
                  }
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

function BlockPreview({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case "heading":
      return <h2 className="text-xl font-bold text-brand-text">{block.content}</h2>;
    case "subheading":
      return <h3 className="text-lg font-semibold text-brand-text">{block.content}</h3>;
    case "paragraph-ar":
      return <p dir="rtl" className="text-brand-text leading-relaxed">{block.content}</p>;
    case "paragraph-en":
      return (
        <div className="flex items-start gap-3">
          <p dir="ltr" className="text-brand-text leading-relaxed flex-1">{block.content}</p>
          <SpeakButton text={block.content} size="sm" />
        </div>
      );
    case "vocabulary-word":
      return (
        <div className="flex items-center gap-3">
          <p dir="ltr" className="text-2xl font-bold text-brand-primary">{block.content}</p>
          <SpeakButton text={block.content} />
        </div>
      );
    case "note":
      return <p className="text-brand-text bg-brand-primary/5 rounded-xl p-3">💡 {block.content}</p>;
    case "alert":
      return <p className="text-brand-error bg-brand-error/10 rounded-xl p-3">⚠️ {block.content}</p>;
    case "rule":
      return <p className="text-brand-text bg-brand-success/10 rounded-xl p-3">📏 {block.content}</p>;
    case "example":
      return <p dir="ltr" className="text-brand-text italic bg-brand-secondary/10 rounded-xl p-3">✏️ {block.content}</p>;
    default:
      return <p className="text-brand-text whitespace-pre-wrap">{block.content}</p>;
  }
}
