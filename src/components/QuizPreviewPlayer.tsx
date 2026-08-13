"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { LessonQuizQuestion } from "@/lib/types";

// نفس منطق ونفس ألوان كويز الطالب الحقيقي (أخضر = صحيح، أحمر = خطأ مع
// إظهار الإجابة الصحيحة بالأخضر)، بس هون بحالة محلية بالكامل (بدون أي
// حفظ لقاعدة البيانات ولا تأثير على نتائج الطالب) — يسمح للمعلم يجرب
// شكل السؤال بالضبط متل ما رح يظهر للطالب، بدون فتح حساب طالب تجريبي
export function QuizPreviewPlayer({ questions }: { questions: LessonQuizQuestion[] }) {
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);

  const sorted = [...questions].sort((a, b) => a.order - b.order);
  const q = sorted[qIndex];
  if (!q) return null;

  const select = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
  };

  const next = () => {
    setAnswers((a) => [...a, selected]);
    setSelected(null);
    setQIndex((i) => i + 1);
  };

  const restart = () => {
    setQIndex(0);
    setSelected(null);
    setAnswers([]);
  };

  if (qIndex >= sorted.length) {
    const correctCount = answers.filter((a, i) => a === sorted[i].correctIndex).length;
    return (
      <GlassCard className="text-center">
        <p className="text-sm text-brand-textMuted mb-2">🧑‍🎓 هيك بالضبط بتنتهي تجربة الطالب</p>
        <p className="text-3xl font-bold text-brand-primary mb-1">
          {correctCount} / {sorted.length}
        </p>
        <button onClick={restart} className="text-brand-primary text-sm mt-3">
          🔁 إعادة تجربة الكويز
        </button>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <p className="text-brand-textMuted text-xs mb-2">
        سؤال {qIndex + 1} من {sorted.length} — معاينة تجريبية (ما بتتسجل بأي مكان)
      </p>
      <h4 dir="ltr" className="text-base font-bold text-brand-text mb-3">
        {q.text}
      </h4>
      <div className="flex flex-col gap-2">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correctIndex;
          const isSelected = i === selected;
          let cls = "border-brand-primary/20 bg-surface/70";
          if (selected !== null) {
            if (isCorrect) cls = "border-brand-success bg-brand-success/10";
            else if (isSelected) cls = "border-brand-error bg-brand-error/10";
          }
          return (
            <button
              key={i}
              dir="ltr"
              onClick={() => select(i)}
              disabled={selected !== null}
              className={`text-left px-4 py-2.5 rounded-xl border-2 transition-colors text-brand-text text-sm ${cls}`}
            >
              {String.fromCharCode(65 + i)}. {opt}
              {selected !== null && isCorrect && <span className="mr-2">✓</span>}
              {selected !== null && isSelected && !isCorrect && <span className="mr-2">✕</span>}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <div className="mt-3">
          <p className={`text-sm font-medium mb-2 ${selected === q.correctIndex ? "text-brand-success" : "text-brand-error"}`}>
            {selected === q.correctIndex ? "إجابة صحيحة ✓" : "إجابة خاطئة ✕"}
          </p>
          <button onClick={next} className="text-brand-primary text-sm font-medium">
            {qIndex + 1 < sorted.length ? "السؤال التالي ←" : "عرض النتيجة"}
          </button>
        </div>
      )}
    </GlassCard>
  );
}
