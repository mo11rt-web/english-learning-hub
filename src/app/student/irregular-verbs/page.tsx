"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SpeakButton } from "@/components/SpeakButton";
import { listenCollection, where } from "@/lib/firestore-helpers";
import { IrregularVerb, StudentProfile } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

type Mode = "past-simple" | "past-participle" | "sentence";
type Level = "easy" | "medium" | "hard" | "all";
type Stage = "study" | "setup" | "playing" | "summary";

interface Question {
  verb: IrregularVerb & { id: string };
  prompt: string;
  options: string[];
  correctAnswer: string;
}

const MODE_LABELS: Record<Mode, string> = {
  "past-simple": "اختر Past Simple",
  "past-participle": "اختر Past Participle",
  sentence: "اختر الفعل المناسب للجملة",
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestions(
  verbs: (IrregularVerb & { id: string })[],
  mode: Mode,
  count: number
): Question[] {
  const pool = shuffle(verbs).slice(0, count);
  return pool.map((verb) => {
    let prompt: string;
    let correctAnswer: string;
    let distractorField: "pastSimple" | "pastParticiple";

    if (mode === "past-simple") {
      prompt = verb.base;
      correctAnswer = verb.pastSimple;
      distractorField = "pastSimple";
    } else if (mode === "past-participle") {
      prompt = verb.base;
      correctAnswer = verb.pastParticiple;
      distractorField = "pastParticiple";
    } else {
      // sentence: نستخدم المثال إن وجد، وإلا جملة عامة بسيطة
      prompt = verb.example?.trim()
        ? verb.example.replace(new RegExp(verb.pastSimple, "i"), "____")
        : `Yesterday, I ____ (${verb.base}) to school.`;
      correctAnswer = verb.pastSimple;
      distractorField = "pastSimple";
    }

    const distractorPool = shuffle(
      verbs.filter((v) => v.id !== verb.id).map((v) => v[distractorField])
    ).filter((v, i, arr) => v !== correctAnswer && arr.indexOf(v) === i);

    const options = shuffle([correctAnswer, ...distractorPool.slice(0, 3)]);

    return { verb, prompt, options, correctAnswer };
  });
}

export default function IrregularVerbsTrainerPage() {
  const { profile } = useAuth();
  const stageId = (profile as StudentProfile | null)?.stageId;
  const [verbs, setVerbs] = useState<(IrregularVerb & { id: string })[]>([]);

  const [stage, setStage] = useState<Stage>("study");
  const [mode, setMode] = useState<Mode>("past-simple");
  const [level, setLevel] = useState<Level>("all");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    if (!stageId) return;
    const u = listenCollection<IrregularVerb>(
      "irregular_verbs",
      [where("stageId", "==", stageId)],
      setVerbs
    );
    return () => u();
  }, [stageId]);

  const availableVerbs = useMemo(
    () =>
      verbs.filter(
        (v) => v.active && (level === "all" || v.level === level)
      ),
    [verbs, level]
  );

  const startSession = () => {
    const count = Math.min(10, availableVerbs.length);
    setQuestions(buildQuestions(availableVerbs, mode, count));
    setQIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setStage("playing");
  };

  const selectAnswer = (opt: string) => {
    if (selected !== null) return;
    setSelected(opt);
    if (opt === questions[qIndex].correctAnswer) setCorrectCount((c) => c + 1);
  };

  const next = () => {
    if (qIndex + 1 < questions.length) {
      setQIndex((i) => i + 1);
      setSelected(null);
    } else {
      setStage("summary");
    }
  };

  const current = questions[qIndex];

  return (
    <AppShell requireRole="student">
      <h1 className="text-2xl font-bold text-brand-text mb-6">
        الأفعال الشاذة 📖
      </h1>

      <div className="flex bg-surfaceBorder/40 rounded-2xl p-1 mb-6 max-w-xs">
        <button
          onClick={() => setStage("study")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
            stage === "study" ? "bg-surface shadow text-brand-primary" : "text-brand-textMuted"
          }`}
        >
          📖 قائمة الدراسة
        </button>
        <button
          onClick={() => setStage("setup")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
            stage !== "study" ? "bg-surface shadow text-brand-primary" : "text-brand-textMuted"
          }`}
        >
          🎮 اختبار نفسك
        </button>
      </div>

      {stage === "study" && (
        <div className="flex flex-col gap-3">
          <p className="text-brand-textMuted text-sm">
            {availableVerbs.length} فعل — اضغط 🔊 لسماع النطق الصحيح لأي شكل من أشكال الفعل (الأمريكي أو البريطاني)، أو 🐢 لسماعه ببطء.
          </p>
          {availableVerbs.map((v) => (
            <GlassCard key={v.id}>
              <div className="grid sm:grid-cols-3 gap-3" dir="ltr">
                <div>
                  <p className="text-xs text-brand-textMuted mb-1">Base</p>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-brand-primary text-lg">{v.base}</span>
                    <SpeakButton text={v.base} size="sm" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-brand-textMuted mb-1">Past Simple</p>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-brand-text text-lg">{v.pastSimple}</span>
                    <SpeakButton text={v.pastSimple} size="sm" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-brand-textMuted mb-1">Past Participle</p>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-brand-text text-lg">{v.pastParticiple}</span>
                    <SpeakButton text={v.pastParticiple} size="sm" />
                  </div>
                </div>
              </div>
              <p dir="rtl" className="text-sm text-brand-textMuted mt-3">
                المعنى: {v.meaningAr}
              </p>
              {v.example && (
                <div className="flex items-center gap-2 mt-1" dir="ltr">
                  <p className="text-xs text-brand-textMuted italic">{v.example}</p>
                  <SpeakButton text={v.example} size="sm" />
                </div>
              )}
            </GlassCard>
          ))}
          {availableVerbs.length === 0 && (
            <GlassCard>
              <p className="text-brand-textMuted text-sm">لا توجد أفعال شاذة مضافة لمرحلتك بعد.</p>
            </GlassCard>
          )}
        </div>
      )}

      {stage === "setup" && (
        <GlassCard>
          <p className="text-brand-textMuted text-sm mb-4">
            {availableVerbs.length} فعل متاح للتدريب حاليًا حسب اختياراتك.
          </p>

          <p className="text-sm font-medium text-brand-text mb-2">نوع التدريب</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-2 rounded-xl text-sm ${
                  mode === m
                    ? "bg-brand-primary text-white"
                    : "bg-surface/70 text-brand-text border border-brand-primary/20"
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          <p className="text-sm font-medium text-brand-text mb-2">المستوى</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {(["all", "easy", "medium", "hard"] as Level[]).map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`px-3 py-2 rounded-xl text-sm ${
                  level === l
                    ? "bg-brand-primary text-white"
                    : "bg-surface/70 text-brand-text border border-brand-primary/20"
                }`}
              >
                {l === "all" ? "الكل" : l === "easy" ? "سهل" : l === "medium" ? "متوسط" : "صعب"}
              </button>
            ))}
          </div>

          <Button onClick={startSession} disabled={availableVerbs.length < 4}>
            ابدأ التدريب (10 أسئلة)
          </Button>
          {availableVerbs.length < 4 && (
            <p className="text-brand-error text-xs mt-2">
              يلزم 4 أفعال على الأقل بهذا المستوى للبدء.
            </p>
          )}
        </GlassCard>
      )}

      {stage === "playing" && current && (
        <GlassCard>
          <p className="text-brand-textMuted text-sm mb-2">
            سؤال {qIndex + 1} من {questions.length}
          </p>
          <h2 dir="ltr" className="text-2xl font-bold text-brand-primary mb-6 text-center py-4">
            {current.prompt}
          </h2>
          <p className="text-brand-text text-sm mb-3">اختر الإجابة الصحيحة:</p>
          <div className="grid grid-cols-2 gap-3">
            {current.options.map((opt) => {
              const isCorrect = opt === current.correctAnswer;
              const isSelected = opt === selected;
              let cls = "border-brand-primary/20 bg-surface/70";
              if (selected !== null) {
                if (isCorrect) cls = "border-brand-success bg-brand-success/10";
                else if (isSelected) cls = "border-brand-error bg-brand-error/10";
              }
              return (
                <button
                  key={opt}
                  dir="ltr"
                  onClick={() => selectAnswer(opt)}
                  disabled={selected !== null}
                  className={`px-4 py-3 rounded-xl border-2 text-brand-text font-medium transition-colors ${cls}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {selected !== null && (
            <div className="mt-5">
              <p
                className={`font-medium mb-3 ${
                  selected === current.correctAnswer ? "text-brand-success" : "text-brand-error"
                }`}
              >
                {selected === current.correctAnswer
                  ? "إجابة صحيحة ✓"
                  : `إجابة خاطئة ✕ — الصحيحة: ${current.correctAnswer}`}
              </p>
              <Button onClick={next}>
                {qIndex + 1 < questions.length ? "التالي" : "عرض النتيجة"}
              </Button>
            </div>
          )}
        </GlassCard>
      )}

      {stage === "summary" && (
        <GlassCard className="text-center">
          <h2 className="text-xl font-bold text-brand-text mb-4">انتهت الجولة 🎉</h2>
          <p className="text-4xl font-bold text-brand-primary mb-2">
            {correctCount} / {questions.length}
          </p>
          <p className="text-brand-textMuted mb-6">
            نسبة النجاح: {Math.round((correctCount / questions.length) * 100)}%
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={startSession}>🔁 إعادة التدريب</Button>
            <button
              onClick={() => setStage("setup")}
              className="px-4 py-2.5 rounded-2xl text-sm text-brand-text border border-brand-primary/25"
            >
              تغيير الإعدادات
            </button>
          </div>
        </GlassCard>
      )}
    </AppShell>
  );
}
