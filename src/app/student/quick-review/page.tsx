"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SpeakButton } from "@/components/SpeakButton";
import { listenCollection, where, orderBy } from "@/lib/firestore-helpers";
import { VocabularyItem, IrregularVerb } from "@/lib/types";
import { useWorkspace } from "@/hooks/useWorkspace";

type ReviewCard = {
  id: string;
  front: string; // إنجليزي
  frontSub?: string; // مثلًا التصريفات التانية للفعل الشاذ
  back: string; // ترجمة عربي
  source: "vocab" | "verb";
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuickReviewPage() {
  const { stageId } = useWorkspace();
  const [vocab, setVocab] = useState<(VocabularyItem & { id: string })[]>([]);
  const [verbs, setVerbs] = useState<(IrregularVerb & { id: string })[]>([]);
  const [source, setSource] = useState<"all" | "vocab" | "verb">("all");

  const [deck, setDeck] = useState<ReviewCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [started, setStarted] = useState(false);
  const [knownCount, setKnownCount] = useState(0);

  useEffect(() => {
    if (!stageId) return;
    const u1 = listenCollection<VocabularyItem>(
      "vocabulary_items",
      [where("stageId", "==", stageId)],
      setVocab
    );
    const u2 = listenCollection<IrregularVerb>(
      "irregular_verbs",
      [where("stageId", "==", stageId), where("active", "==", true)],
      setVerbs
    );
    return () => {
      u1();
      u2();
    };
  }, [stageId]);

  const availableCounts = useMemo(
    () => ({ vocab: vocab.length, verb: verbs.length, all: vocab.length + verbs.length }),
    [vocab.length, verbs.length]
  );

  const buildDeck = () => {
    const vocabCards: ReviewCard[] = vocab.map((v) => ({
      id: v.id,
      front: v.word,
      back: v.translation,
      source: "vocab",
    }));
    const verbCards: ReviewCard[] = verbs.map((v) => ({
      id: v.id,
      front: v.base,
      frontSub: `${v.pastSimple} — ${v.pastParticiple}`,
      back: v.meaningAr,
      source: "verb",
    }));

    const pool =
      source === "vocab" ? vocabCards : source === "verb" ? verbCards : [...vocabCards, ...verbCards];

    setDeck(shuffle(pool));
    setIndex(0);
    setFlipped(false);
    setKnownCount(0);
    setStarted(true);
  };

  const markAndNext = (known: boolean) => {
    if (known) setKnownCount((c) => c + 1);
    if (index + 1 < deck.length) {
      setIndex((i) => i + 1);
      setFlipped(false);
    } else {
      setIndex(deck.length); // نهاية الجولة
    }
  };

  const finished = started && index >= deck.length && deck.length > 0;
  const current = deck[index];

  return (
    <AppShell requireRole="student">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-brand-text">🚀 مراجعة سريعة</h1>
          {started && !finished && (
            <span className="text-brand-textMuted text-sm">
              {index + 1} / {deck.length}
            </span>
          )}
        </div>

        {!started && (
          <GlassCard>
            <p className="text-brand-textMuted text-sm mb-4">
              راجع الكلمات والأفعال الشاذة بسرعة قبل الامتحان — بطاقات تقلبها بضغطة، بدون أي تسجيل نتيجة رسمية.
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {[
                { key: "all", label: `الكل (${availableCounts.all})` },
                { key: "vocab", label: `الكلمات فقط (${availableCounts.vocab})` },
                { key: "verb", label: `الأفعال الشاذة فقط (${availableCounts.verb})` },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSource(opt.key as typeof source)}
                  className={`text-right px-4 py-2.5 rounded-xl border-2 text-sm transition-colors ${
                    source === opt.key
                      ? "border-brand-primary bg-brand-primary/10 text-brand-primary font-medium"
                      : "border-brand-primary/15 text-brand-text"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Button onClick={buildDeck} disabled={availableCounts[source] === 0}>
              {availableCounts[source] === 0 ? "لا يوجد محتوى متاح بعد" : "ابدأ المراجعة"}
            </Button>
          </GlassCard>
        )}

        {started && !finished && current && (
          <>
            <button
              onClick={() => setFlipped((f) => !f)}
              className="w-full text-right"
              aria-label="اضغط لقلب البطاقة"
            >
              <GlassCard className="min-h-[220px] flex flex-col items-center justify-center text-center cursor-pointer select-none">
                {!flipped ? (
                  <>
                    <p dir="ltr" className="text-2xl font-bold text-brand-text mb-1">
                      {current.front}
                    </p>
                    {current.frontSub && (
                      <p dir="ltr" className="text-brand-textMuted text-sm mb-2">
                        {current.frontSub}
                      </p>
                    )}
                    <div onClick={(e) => e.stopPropagation()}>
                      <SpeakButton text={current.front} size="sm" />
                    </div>
                    <p className="text-brand-textMuted text-xs mt-4">اضغط لعرض الترجمة</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-brand-primary mb-2">{current.back}</p>
                    <p className="text-brand-textMuted text-xs">اضغط مجددًا للرجوع</p>
                  </>
                )}
              </GlassCard>
            </button>

            {flipped && (
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => markAndNext(false)}
                  className="py-3 rounded-2xl bg-brand-error/10 text-brand-error font-medium text-sm"
                >
                  ✕ لسا محتاج مراجعة
                </button>
                <button
                  onClick={() => markAndNext(true)}
                  className="py-3 rounded-2xl bg-brand-success/10 text-brand-success font-medium text-sm"
                >
                  ✓ عارفها
                </button>
              </div>
            )}

            <button
              onClick={() => setStarted(false)}
              className="w-full text-center text-brand-textMuted text-xs mt-4"
            >
              إنهاء المراجعة والرجوع
            </button>
          </>
        )}

        {finished && (
          <GlassCard className="text-center">
            <p className="text-4xl mb-2">🎉</p>
            <p className="text-brand-text font-bold mb-1">خلصت الجولة!</p>
            <p className="text-brand-textMuted text-sm mb-4">
              كنت عارف {knownCount} من {deck.length}
            </p>
            <div className="flex gap-3">
              <Button onClick={buildDeck} className="flex-1">
                🔁 جولة جديدة
              </Button>
              <button
                onClick={() => setStarted(false)}
                className="flex-1 px-4 py-2.5 rounded-2xl text-sm border border-brand-primary/25 text-brand-text"
              >
                رجوع
              </button>
            </div>
          </GlassCard>
        )}
      </div>
    </AppShell>
  );
}
