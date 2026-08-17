"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { LessonContentBuilder } from "@/components/LessonContentBuilder";
import { Lesson, LessonQuizQuestion, LessonBlock } from "@/lib/types";
import { notifyUsers, getStudentUidsForStage } from "@/lib/notifications";

export default function LessonEditorPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const router = useRouter();
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

  const publish = async () => {
    if (!lesson) return;
    const willPublish = lesson.status !== "published";
    await updateDoc(doc(db, "lessons", lessonId), {
      status: willPublish ? "published" : "draft",
      publishedAt: Date.now(),
    });
    if (willPublish) {
      const studentUids = await getStudentUidsForStage(lesson.stageId, lesson.targetGroupIds);
      await notifyUsers(studentUids, {
        title: "درس جديد",
        body: lesson.title,
        type: "new-lesson",
        link: `/student/lessons/${lesson.id}`,
      });
    }
  };

  const saveAndPublishAndExit = async () => {
    if (!lesson) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "lessons", lessonId), {
        blocks: lesson.blocks ?? [],
        quizQuestions: lesson.quizQuestions ?? [],
        status: "published",
        publishedAt: Date.now(),
        updatedAt: Date.now(),
      });
      const studentUids = await getStudentUidsForStage(lesson.stageId, lesson.targetGroupIds);
      await notifyUsers(studentUids, {
        title: "درس جديد",
        body: lesson.title,
        type: "new-lesson",
        link: `/student/lessons/${lesson.id}`,
      }).catch(() => {});
      router.push(`/units/${lesson.unitId}`);
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  // ===== أسئلة الكويز (اختيار من متعدد، تغذية راجعة فورية عند الطالب) =====
  const [qText, setQText] = useState("");
  const [qOptions, setQOptions] = useState(["", "", "", ""]);
  const [qCorrect, setQCorrect] = useState(0);
  const [qError, setQError] = useState("");

  const quizQuestions = lesson?.quizQuestions ?? [];

  const saveQuizQuestions = async (questions: LessonQuizQuestion[]) => {
    await updateDoc(doc(db, "lessons", lessonId), {
      quizQuestions: questions,
      updatedAt: Date.now(),
    });
  };

  const addQuizQuestion = () => {
    setQError("");
    const filledOptions = qOptions.filter((o) => o.trim());
    if (!qText.trim()) {
      setQError("لازم تكتب نص السؤال.");
      return;
    }
    if (filledOptions.length < 2) {
      setQError("لازم خيارين على الأقل.");
      return;
    }
    if (!qOptions[qCorrect]?.trim()) {
      setQError("لازم تحدد الإجابة الصحيحة من بين الخيارات المكتوبة.");
      return;
    }
    const newQuestion: LessonQuizQuestion = {
      id: crypto.randomUUID(),
      text: qText.trim(),
      options: qOptions.filter((o) => o.trim()),
      correctIndex: qOptions.filter((o) => o.trim()).indexOf(qOptions[qCorrect]),
      order: quizQuestions.length,
    };
    saveQuizQuestions([...quizQuestions, newQuestion]);
    setQText("");
    setQOptions(["", "", "", ""]);
    setQCorrect(0);
  };

  const removeQuizQuestion = (id: string) => {
    saveQuizQuestions(quizQuestions.filter((q) => q.id !== id));
  };

  const moveQuizQuestion = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= quizQuestions.length) return;
    const arr = [...quizQuestions];
    [arr[index], arr[target]] = [arr[target], arr[index]];
    saveQuizQuestions(arr.map((q, i) => ({ ...q, order: i })));
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
        <div className="flex flex-wrap gap-2 items-center">
          <Button variant="secondary" onClick={() => setPreview((p) => !p)}>
            {preview ? "إنهاء المعاينة" : "معاينة كطالب"}
          </Button>
          <Button onClick={saveAndPublishAndExit} disabled={saving}>
            {saving ? "جارٍ الحفظ..." : "حفظ التعديلات ونشر"}
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/units/${lesson.unitId}`)}>
            إغلاق
          </Button>
        </div>
      </div>

      <LessonContentBuilder
        blocks={lesson.blocks ?? []}
        onChange={(blocks) => setLesson({ ...lesson, blocks })}
        onCommit={save}
        preview={preview}
        saving={saving}
      />

      {!preview && (
        <GlassCard className="mt-8">
          <h2 className="font-bold text-brand-text mb-1">أسئلة الكويز</h2>
          <p className="text-brand-textMuted text-xs mb-4">
            تظهر للطالب بعد إنهاء محتوى الدرس، سؤال واحد في كل مرة مع تصحيح فوري (إطار أخضر/أحمر).
          </p>

          <div className="flex flex-col gap-2 mb-6">
            {quizQuestions.map((q, idx) => (
              <div key={q.id} className="bg-surface/60 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-brand-text font-medium">
                    {idx + 1}. {q.text}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => moveQuizQuestion(idx, -1)} className="text-xs px-1">▲</button>
                    <button onClick={() => moveQuizQuestion(idx, 1)} className="text-xs px-1">▼</button>
                    <button onClick={() => removeQuizQuestion(q.id)} className="text-xs px-1 text-brand-error">حذف</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt, i) => (
                    <span
                      key={i}
                      className={`text-xs px-2 py-1 rounded-lg ${
                        i === q.correctIndex
                          ? "bg-brand-success/15 text-brand-success"
                          : "bg-surfaceBorder/40 text-brand-textMuted"
                      }`}
                    >
                      {opt} {i === q.correctIndex && "✓"}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {quizQuestions.length === 0 && (
              <p className="text-brand-textMuted text-sm">لا توجد أسئلة كويز بعد.</p>
            )}
          </div>

          <div className="border-t border-surfaceBorder pt-4">
            <p className="text-sm font-medium text-brand-text mb-2">+ إضافة سؤال</p>
            <textarea
              placeholder="نص السؤال"
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-brand-primary/20 bg-surface/70 outline-none mb-2"
            />
            <div className="grid grid-cols-2 gap-2 mb-2">
              {qOptions.map((opt, i) => (
                <label
                  key={i}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
                    qCorrect === i ? "border-brand-success bg-brand-success/5" : "border-brand-primary/20 bg-surface/70"
                  }`}
                >
                  <input
                    type="radio"
                    checked={qCorrect === i}
                    onChange={() => setQCorrect(i)}
                  />
                  <input
                    placeholder={`الإجابة ${i + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const options = [...qOptions];
                      options[i] = e.target.value;
                      setQOptions(options);
                    }}
                    className="flex-1 bg-transparent outline-none"
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-brand-textMuted mb-2">
              حدد الدائرة بجانب الإجابة الصحيحة (نظام اختيار من متعدد، إجابة واحدة صحيحة فقط).
            </p>
            {qError && <p className="text-brand-error text-xs mb-2">{qError}</p>}
            <Button onClick={addQuizQuestion}>إضافة السؤال</Button>
          </div>
        </GlassCard>
      )}
    </AppShell>
  );
}

