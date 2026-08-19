"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, setDoc, getDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { HelpCircle, Send, MessageCircle } from "lucide-react";
import { createDoc } from "@/lib/firestore-helpers";
import { notifyUsers, getTeacherUids } from "@/lib/notifications";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { LessonBlockView } from "@/components/LessonBlockView";
import {
  listenCollection,
  where,
} from "@/lib/firestore-helpers";
import { Lesson, LessonQuizQuestion, StudentProfile } from "@/lib/types";
import { matchesStudentGroups } from "@/lib/groupTargeting";
import { useAuth } from "@/hooks/useAuth";
import { awardPoints, getPointsSettings } from "@/lib/gamification";

type Stage = "content" | "quiz" | "summary";

export default function StudentLessonViewPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [lesson, setLesson] = useState<(Lesson & { id: string }) | null>(null);
  const [siblingLessons, setSiblingLessons] = useState<(Lesson & { id: string })[]>([]);
  const [stage, setStage] = useState<Stage>("content");
  const [pointsGiven, setPointsGiven] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // حالة "اسأل الأستاذ"
  const [showAskForm, setShowAskForm] = useState(false);
  const [askText, setAskFormText] = useState("");
  const [isSendingAsk, setIsSendingAsk] = useState(false);

  // حالة الكويز
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "lessons", lessonId), (snap) => {
      if (snap.exists()) setLesson({ ...(snap.data() as Lesson), id: snap.id });
      else setLoadError("الدرس غير موجود أو لم يعد منشورًا.");
    }, (snapshotError) => {
      setLoadError(snapshotError.message?.toLowerCase().includes("permission") ? "لا تملك صلاحية عرض هذا الدرس أو لم يعد منشورًا." : "تعذر تحميل الدرس.");
    });
    return () => unsub();
  }, [lessonId]);

  useEffect(() => {
    if (!lesson) return;
    const u = listenCollection<Lesson>(
      "lessons",
      [where("unitId", "==", lesson.unitId), where("status", "==", "published")],
      (items) => {
        const student = profile as StudentProfile | null;
        setSiblingLessons(
          items
            .filter((item) => matchesStudentGroups(item.targetGroupIds, student?.groupIds ?? []))
            .slice()
            .sort((a, b) => a.order - b.order)
        );
      }
    );
    return () => u();
  }, [lesson?.unitId, profile]);

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

  const quizQuestions: LessonQuizQuestion[] = (() => {
    if (lesson?.quizQuestions?.length) return lesson.quizQuestions.slice().sort((a, b) => a.order - b.order);
    const legacy = (lesson?.blocks ?? [])
      .filter((block) => block.type === "quiz-question")
      .map((block, index) => {
        try {
          const parsed = JSON.parse(block.content || "{}");
          const options = Array.isArray(parsed?.options) ? parsed.options.filter((option: unknown): option is string => typeof option === "string") : [];
          if (!parsed?.text || options.length < 2) return null;
          const rawCorrect = parsed.correctIndex ?? parsed.correctAnswer ?? 0;
          const correctIndex = typeof rawCorrect === "number" ? rawCorrect : options.indexOf(String(rawCorrect));
          if (correctIndex < 0 || correctIndex >= options.length) return null;
          return { id: block.id, text: String(parsed.text), options, correctIndex, order: index };
        } catch {
          return null;
        }
      })
      .filter((question): question is LessonQuizQuestion => question !== null);
    return legacy;
  })();

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
      setStage("summary");
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

  const finishQuiz = async () => {
    if (user) {
      await setDoc(
        doc(db, "lesson_progress", `${user.uid}_${lessonId}`),
        {
          quizCompleted: true,
          quizCorrect: correctCount,
          quizTotal: quizQuestions.length,
          quizScore: Math.round((correctCount / quizQuestions.length) * 100),
          quizCompletedAt: Date.now(),
        },
        { merge: true }
      );
    }
    setStage("summary");
  };

  const handleSendAsk = async () => {
    if (!user || !lesson || !askText.trim() || isSendingAsk) return;
    setIsSendingAsk(true);
    try {
      const now = Date.now();
      const inquiryRef = await createDoc("inquiries", {
        studentId: user.uid,
        studentName: profile?.fullName || "طالب",
        stageId: lesson.stageId,
        groupIds: (profile as StudentProfile)?.groupIds ?? [],
        title: `سؤال عن درس: ${lesson.title}`,
        details: askText.trim(),
        unitId: lesson.unitId,
        lessonId: lesson.id,
        status: "new",
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        lastMessageBy: "student",
      });
      await createDoc(`inquiries/${inquiryRef.id}/messages`, {
        senderId: user.uid,
        senderRole: "student",
        senderName: profile?.fullName || "طالب",
        body: askText.trim(),
        createdAt: now,
      });
      await notifyUsers(await getTeacherUids(), {
        type: "inquiry-new",
        title: `سؤال جديد من الطالب ${profile?.fullName || "طالب"}`,
        body: `بخصوص درس: ${lesson.title}`,
        link: `/inquiries/${inquiryRef.id}`,
      });
      setAskFormText("");
      setShowAskForm(false);
      alert("تم إرسال سؤالك للأستاذ بنجاح ✅");
    } catch (err) {
      alert("تعذر إرسال السؤال، حاول مجدداً.");
    } finally {
      setIsSendingAsk(false);
    }
  };

  const goToNextLessonOrList = () => {
    if (nextLesson) router.push(`/student/lessons/${nextLesson.id}`);
    else router.push("/student/lessons");
  };

  if (!lesson) {
    return <AppShell requireRole="student"><p className="text-brand-error">{loadError ?? "جاري التحميل..."}</p></AppShell>;
  }

  return (
    <AppShell requireRole="student">
      <h1 className="text-2xl font-bold text-brand-text mb-6">{lesson.title}</h1>

      {stage === "content" && (
        <>
          {lesson.description && (
            <p className="text-brand-textMuted mb-4">{lesson.description}</p>
          )}
          <div className="flex flex-col gap-4 pb-24">
            {(lesson.blocks ?? [])
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((block) => (
                <GlassCard key={block.id}>
                  <LessonBlockView block={block} />
                </GlassCard>
              ))}
            {(!lesson.blocks || lesson.blocks.length === 0) && (
              <p className="text-brand-textMuted">لا يوجد محتوى بهذا الدرس بعد.</p>
            )}
          </div>
          <div className="mt-6 pb-36">
            <Button onClick={handleNextFromContent} className="w-full">
              {quizQuestions.length > 0 ? "التالي ← بدء الكويز" : "✅ أنهيت هذا الدرس"}
            </Button>
          </div>
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
        <div className="flex flex-col gap-6">
          <GlassCard className="text-center">
            <h2 className="text-xl font-bold text-brand-text mb-4">
              {quizQuestions.length > 0 ? "انتهى الكويز 🎉" : "أهلاً بك! أنهيت قراءة الدرس بنجاح ✅"}
            </h2>
            {quizQuestions.length > 0 && (
              <>
                <p className="text-4xl font-bold text-brand-primary mb-2">
                  {correctCount} / {quizQuestions.length}
                </p>
                <p className="text-brand-textMuted mb-6">
                  النسبة: {Math.round((correctCount / quizQuestions.length) * 100)}%
                </p>
              </>
            )}
            <Button onClick={goToNextLessonOrList} className="w-full">
              {nextLesson ? "الدرس التالي ←" : "العودة لقائمة الدروس"}
            </Button>
          </GlassCard>

          {!showAskForm ? (
            <button 
              onClick={() => setShowAskForm(true)}
              className="group relative overflow-hidden rounded-3xl bg-white/40 border border-brand-primary/20 p-6 text-right transition-all hover:bg-white/60 hover:shadow-lg active:scale-[0.98]"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-brand-text mb-1">❓ اسأل الأستاذ إذا تحتاج</h3>
                  <p className="text-sm text-brand-textMuted">هل واجهت صعوبة في الكويز؟ أرسل سؤالك للأستاذ مهند مباشرة.</p>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform">
                  <HelpCircle size={40} strokeWidth={2.5} />
                </div>
              </div>
            </button>
          ) : (
            <GlassCard className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                  <MessageCircle size={24} />
                </div>
                <h3 className="font-bold text-brand-text">سؤالك للأستاذ</h3>
              </div>
              <textarea 
                value={askText}
                onChange={(e) => setAskFormText(e.target.value)}
                placeholder="اكتب سؤالك هنا بوضوح..."
                rows={4}
                className="w-full px-4 py-3 rounded-2xl border border-brand-primary/20 bg-surface/50 focus:bg-surface outline-none transition-all focus:ring-2 focus:ring-brand-primary/20 mb-4"
              />
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <Button onClick={handleSendAsk} disabled={isSendingAsk || !askText.trim()} className="flex-1">
                    {isSendingAsk ? "جاري الإرسال..." : "إرسال السؤال للأستاذ"} <Send size={16} className="mr-2" />
                  </Button>
                  <button 
                    onClick={() => setShowAskForm(false)}
                    className="px-6 py-2 rounded-xl bg-surfaceBorder/40 text-brand-textMuted font-bold hover:bg-surfaceBorder/60 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
                <p className="text-[11px] text-brand-textMuted leading-relaxed">
                  يمكنك إرسال سؤال واحد للمدرس، وسيتم الرد عليه من خلال نافذة "أسئلتي". بعد تحديد السؤال كتم الحل، يمكنك إرسال سؤال جديد فقط.
                </p>
              </div>
            </GlassCard>
          )}
        </div>
      )}
    </AppShell>
  );
}
