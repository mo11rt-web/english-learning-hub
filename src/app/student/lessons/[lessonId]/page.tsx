"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, setDoc, getDoc, collection, query, where as fbWhere, orderBy as fbOrderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { LessonBlockView } from "@/components/LessonBlockView";
import {
  listenCollection,
  where,
  orderBy as fsOrderBy,
} from "@/lib/firestore-helpers";
import { Lesson } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { awardPoints, getPointsSettings } from "@/lib/gamification";
import { notifyUsers, getTeacherUids } from "@/lib/notifications";

type Stage = "content" | "quiz" | "summary";

export default function StudentLessonViewPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [lesson, setLesson] = useState<(Lesson & { id: string }) | null>(null);
  const [siblingLessons, setSiblingLessons] = useState<(Lesson & { id: string })[]>([]);
  const [stage, setStage] = useState<Stage>("content");
  const [pointsGiven, setPointsGiven] = useState(false);

  // حالة الكويز
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "lessons", lessonId), (snap) => {
      if (snap.exists()) setLesson({ ...(snap.data() as Lesson), id: snap.id });
    });
    return () => unsub();
  }, [lessonId]);

  useEffect(() => {
    if (!lesson) return;
    const u = listenCollection<Lesson>(
      "lessons",
      [where("unitId", "==", lesson.unitId), fsOrderBy("order")],
      setSiblingLessons
    );
    return () => u();
  }, [lesson?.unitId]);

  useEffect(() => {
    // إعادة الحالة عند فتح درس جديد
    setStage("content");
    setQIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setPointsGiven(false);
  }, [lessonId]);

  useEffect(() => {
    if (!user) return;
    setDoc(
      doc(db, "lesson_progress", `${user.uid}_${lessonId}`),
      { studentId: user.uid, lessonId, firstOpenedAt: Date.now(), lastOpenedAt: Date.now() },
      { merge: true }
    );
  }, [user, lessonId]);

  const quizQuestions = lesson?.quizQuestions ?? [];

  const nextLesson = (() => {
    if (!lesson) return null;
    const published = siblingLessons.filter((l) => l.status === "published");
    const after = published
      .filter((l) => l.order > lesson.order)
      .sort((a, b) => a.order - b.order);
    return after[0] ?? null;
  })();

  const finishContentAndAward = async () => {
    if (!user || pointsGiven) return;
    const progressRef = doc(db, "lesson_progress", `${user.uid}_${lessonId}`);
    const existing = await getDoc(progressRef);
    const alreadyCompleted = existing.exists() && existing.data()?.completed;
    await setDoc(progressRef, { completed: true, completedAt: Date.now() }, { merge: true });
    if (!alreadyCompleted) {
      const settings = await getPointsSettings();
      await awardPoints(user.uid, settings.lessonComplete);
    }
    setPointsGiven(true);
  };

  const handleNextFromContent = async () => {
    await finishContentAndAward();
    if (quizQuestions.length > 0) {
      setStage("quiz");
    } else {
      goToNextLessonOrList();
    }
  };

  const selectAnswer = (index: number) => {
    if (selected !== null) return; // منع تغيير الإجابة بعد الاختيار
    setSelected(index);
    const q = quizQuestions[qIndex];
    if (index === q.correctIndex) setCorrectCount((c) => c + 1);
  };

  const nextQuestion = () => {
    if (qIndex + 1 < quizQuestions.length) {
      setQIndex((i) => i + 1);
      setSelected(null);
    } else {
      finishQuiz();
    }
  };

  const FAIL_THRESHOLD = 60; // نفس نسبة النجاح الافتراضية المستخدمة بباقي المنصة (الواجبات)

  // يفحص آخر ٤ محاولات كويز للطالب (عبر كل الدروس)، ولو آخر ٣ منهم فاشلة
  // (وين "فاشل" = تحت ٦٠٪) بينبّه المعلم مرة وحدة بالضبط لحظة ما توصل
  // السلسلة لـ٣ — مو مع كل رسوب إضافي بعدها (لتجنب إزعاج المعلم بإشعارات
  // متكررة لنفس الطالب المستمر بالرسوب)
  const checkConsecutiveFailuresAndNotify = async (studentUid: string, studentName: string) => {
    try {
      const q = query(
        collection(db, "lesson_progress"),
        fbWhere("studentId", "==", studentUid),
        fbOrderBy("quizCompletedAt", "desc"),
        limit(4)
      );
      const snap = await getDocs(q);
      const attempts = snap.docs.map((d) => d.data());
      if (attempts.length < 3) return;

      const lastThreeFailed = attempts.slice(0, 3).every((a) => (a.quizScore ?? 0) < FAIL_THRESHOLD);
      if (!lastThreeFailed) return;

      // لو في محاولة رابعة أقدم وهي كمان كانت فاشلة، معناها الإشعار
      // انبعت أصلًا بمحاولة سابقة (السلسلة تجاوزت ٣ من قبل) — منتجنب التكرار
      const fourthAlsoFailed = attempts.length >= 4 && (attempts[3].quizScore ?? 0) < FAIL_THRESHOLD;
      if (fourthAlsoFailed) return;

      const teacherUids = await getTeacherUids();
      await notifyUsers(teacherUids, {
        title: "⚠️ طالب يحتاج متابعة",
        body: `الطالب ${studentName} رسب بـ 3 اختبارات دروس متتالية (أقل من ${FAIL_THRESHOLD}٪). ممكن يحتاج مراجعة أو مساعدة إضافية.`,
        type: "alert",
        link: `/students`,
      });
    } catch (err) {
      // ما منوقف تجربة الطالب لو فشل الإشعار لأي سبب (مثلاً فهرس Firestore
      // ناقص) — بس منسجل الخطأ بالـ console للمراجعة
      console.error("checkConsecutiveFailuresAndNotify failed:", err);
    }
  };

  const finishQuiz = async () => {
    if (user) {
      const score = Math.round((correctCount / quizQuestions.length) * 100);
      await setDoc(
        doc(db, "lesson_progress", `${user.uid}_${lessonId}`),
        {
          quizCompleted: true,
          quizCorrect: correctCount,
          quizTotal: quizQuestions.length,
          quizScore: score,
          quizCompletedAt: Date.now(),
        },
        { merge: true }
      );
      if (score < FAIL_THRESHOLD) {
        checkConsecutiveFailuresAndNotify(user.uid, user.displayName ?? profile?.fullName ?? "طالب");
      }
    }
    setStage("summary");
  };

  const goToNextLessonOrList = () => {
    if (nextLesson) router.push(`/student/lessons/${nextLesson.id}`);
    else router.push("/student/lessons");
  };

  if (!lesson) {
    return <AppShell requireRole="student"><p>جاري التحميل...</p></AppShell>;
  }

  return (
    <AppShell requireRole="student">
      <h1 className="text-2xl font-bold text-brand-text mb-1">{lesson.title}</h1>
      {lesson.description && (
        <p className="text-brand-textMuted text-sm mb-5">{lesson.description}</p>
      )}

      {stage === "content" && (
        <>
          <div className="flex flex-col gap-4">
            {lesson.blocks
              .sort((a, b) => a.order - b.order)
              .map((block) => (
                <GlassCard key={block.id}>
                  <LessonBlockView block={block} />
                </GlassCard>
              ))}
            {lesson.blocks.length === 0 && (
              <p className="text-brand-textMuted">لا يوجد محتوى بهذا الدرس بعد.</p>
            )}
          </div>
          <Button onClick={handleNextFromContent} className="mt-6">
            {quizQuestions.length > 0 ? "التالي ← الكويز" : "✅ أنهيت هذا الدرس"}
          </Button>
        </>
      )}

      {stage === "quiz" && quizQuestions[qIndex] && (
        <GlassCard>
          <p className="text-brand-textMuted text-sm mb-2">
            سؤال {qIndex + 1} من {quizQuestions.length}
          </p>
          <h2 className="text-lg font-bold text-brand-text mb-4">
            {quizQuestions[qIndex].text}
          </h2>
          <div className="flex flex-col gap-3">
            {quizQuestions[qIndex].options.map((opt, i) => {
              const isCorrect = i === quizQuestions[qIndex].correctIndex;
              const isSelected = i === selected;
              let borderClass = "border-brand-primary/20 bg-surface/70";
              if (selected !== null) {
                if (isCorrect) borderClass = "border-brand-success bg-brand-success/10";
                else if (isSelected) borderClass = "border-brand-error bg-brand-error/10";
              }
              return (
                <button
                  key={i}
                  onClick={() => selectAnswer(i)}
                  disabled={selected !== null}
                  className={`text-right px-4 py-3 rounded-xl border-2 transition-colors text-brand-text ${borderClass}`}
                >
                  {opt}
                  {selected !== null && isCorrect && <span className="mr-2">✓</span>}
                  {selected !== null && isSelected && !isCorrect && <span className="mr-2">✕</span>}
                </button>
              );
            })}
          </div>

          {selected !== null && (
            <div className="mt-4">
              <p
                className={`font-medium mb-3 ${
                  selected === quizQuestions[qIndex].correctIndex ? "text-brand-success" : "text-brand-error"
                }`}
              >
                {selected === quizQuestions[qIndex].correctIndex ? "إجابة صحيحة ✓" : "إجابة خاطئة ✕"}
              </p>
              <Button onClick={nextQuestion}>
                {qIndex + 1 < quizQuestions.length ? "التالي" : "عرض النتيجة"}
              </Button>
            </div>
          )}
        </GlassCard>
      )}

      {stage === "summary" && (
        <GlassCard className="text-center">
          <h2 className="text-xl font-bold text-brand-text mb-4">انتهى الكويز 🎉</h2>
          <p className="text-4xl font-bold text-brand-primary mb-2">
            {correctCount} / {quizQuestions.length}
          </p>
          <p className="text-brand-textMuted mb-6">
            النسبة: {Math.round((correctCount / quizQuestions.length) * 100)}%
          </p>
          <Button onClick={goToNextLessonOrList}>
            {nextLesson ? "الدرس التالي ←" : "العودة لقائمة الدروس"}
          </Button>
        </GlassCard>
      )}
    </AppShell>
  );
}
