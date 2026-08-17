"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { BlockFileUpload } from "@/components/BlockFileUpload";
import { LessonBlockView } from "@/components/LessonBlockView";
import { LessonBlock, LessonBlockType } from "@/lib/types";

export const BLOCK_LABELS: Record<LessonBlockType, string> = {
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

const UPLOAD_TYPES: LessonBlockType[] = ["image", "pdf", "audio", "book-page"];
const LINK_ONLY_TYPES: LessonBlockType[] = ["youtube", "google-drive"];

function createBlock(type: LessonBlockType, order: number): LessonBlock {
  return { id: crypto.randomUUID(), type, content: "", order };
}

function normalizeOrders(blocks: LessonBlock[]) {
  return blocks.map((block, index) => ({ ...block, order: index }));
}

export function LessonContentBuilder({
  blocks,
  onChange,
  onCommit,
  preview = false,
  saving = false,
}: {
  blocks: LessonBlock[];
  onChange: (blocks: LessonBlock[]) => void;
  onCommit?: (blocks: LessonBlock[]) => void;
  preview?: boolean;
  saving?: boolean;
}) {
  const orderedBlocks = blocks.slice().sort((a, b) => a.order - b.order);

  const commit = (next: LessonBlock[]) => {
    const normalized = normalizeOrders(next);
    onChange(normalized);
    onCommit?.(normalized);
  };

  const addBlock = (type: LessonBlockType) => {
    commit([...orderedBlocks, createBlock(type, orderedBlocks.length)]);
  };

  const updateBlock = (id: string, content: string, shouldCommit = false) => {
    const next = orderedBlocks.map((block) => (block.id === id ? { ...block, content } : block));
    onChange(next);
    if (shouldCommit) onCommit?.(normalizeOrders(next));
  };

  const removeBlock = (id: string) => {
    commit(orderedBlocks.filter((block) => block.id !== id));
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= orderedBlocks.length) return;
    const next = [...orderedBlocks];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  return (
    <div className="flex flex-col gap-4">
      {!preview && (
        <GlassCard>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="font-bold text-brand-text">إضافة محتوى الدرس</h2>
              <p className="text-xs text-brand-textMuted mt-1">
                اختر كتلة، ثم رتّبها حسب تسلسل شرح الدرس. يمكنك إضافة أكثر من كتلة من النوع نفسه.
              </p>
            </div>
            {saving && <span className="text-xs text-brand-textMuted">جارٍ الحفظ...</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(BLOCK_LABELS) as LessonBlockType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addBlock(type)}
                className="px-3 py-1.5 rounded-xl bg-brand-primary/10 text-brand-primary text-xs hover:bg-brand-primary/20 transition-colors"
              >
                + {BLOCK_LABELS[type]}
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="flex flex-col gap-4">
        {orderedBlocks.map((block, index) => (
          <GlassCard key={block.id} className="relative">
            {!preview && (
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs text-brand-primary font-medium">
                  {index + 1}. {BLOCK_LABELS[block.type]}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} className="text-xs px-1 disabled:opacity-30" aria-label="نقل للأعلى">▲</button>
                  <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === orderedBlocks.length - 1} className="text-xs px-1 disabled:opacity-30" aria-label="نقل للأسفل">▼</button>
                  <button type="button" onClick={() => removeBlock(block.id)} className="text-xs px-2 text-brand-error">حذف</button>
                </div>
              </div>
            )}

            {preview ? (
              <LessonBlockView block={block} />
            ) : UPLOAD_TYPES.includes(block.type) ? (
              <div className="flex flex-col gap-2">
                <BlockFileUpload
                  type={block.type as "image" | "pdf" | "audio" | "book-page"}
                  onUploaded={(url) => {
                    const next = orderedBlocks.map((item) => item.id === block.id ? { ...item, content: url } : item);
                    commit(next);
                  }}
                />
                <input
                  value={block.content}
                  onChange={(e) => updateBlock(block.id, e.target.value)}
                  onBlur={(e) => updateBlock(block.id, e.target.value, true)}
                  dir="ltr"
                  placeholder="أو الصق رابطاً مباشراً هنا"
                  className="w-full px-3 py-2 rounded-xl border border-brand-primary/20 bg-surface/70 outline-none text-xs"
                />
                {block.content && <p className="text-xs text-brand-success">✅ تم إرفاق المحتوى — استخدم المعاينة للتحقق من ظهوره.</p>}
              </div>
            ) : LINK_ONLY_TYPES.includes(block.type) ? (
              <input
                value={block.content}
                onChange={(e) => updateBlock(block.id, e.target.value)}
                onBlur={(e) => updateBlock(block.id, e.target.value, true)}
                dir="ltr"
                placeholder={block.type === "youtube" ? "الصق رابط فيديو يوتيوب (youtube.com أو youtu.be)" : "الصق رابط مشاركة Google Drive"}
                className="w-full px-3 py-2 rounded-xl border border-brand-primary/20 bg-surface/70 outline-none"
              />
            ) : (
              <textarea
                value={block.content}
                onChange={(e) => updateBlock(block.id, e.target.value)}
                onBlur={(e) => updateBlock(block.id, e.target.value, true)}
                dir={block.type.includes("en") || block.type === "vocabulary-word" ? "ltr" : "rtl"}
                rows={block.type === "heading" || block.type === "subheading" ? 1 : block.type === "vocabulary-list" ? 5 : 3}
                placeholder={block.type === "quiz-question" ? "اكتب سؤالاً يظهر داخل الدرس..." : "اكتب محتوى الكتلة هنا..."}
                className="w-full px-3 py-2 rounded-xl border border-brand-primary/20 bg-surface/70 outline-none"
              />
            )}
          </GlassCard>
        ))}
        {orderedBlocks.length === 0 && (
          <p className="text-brand-textMuted text-center py-8">لا يوجد محتوى بعد — استخدم الأزرار أعلاه لإضافة أول كتلة.</p>
        )}
      </div>
    </div>
  );
}
