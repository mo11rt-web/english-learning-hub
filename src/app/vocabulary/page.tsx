"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SpeakButton } from "@/components/SpeakButton";
import {
  listenCollection,
  createDoc,
  deleteDocById,
  orderBy,
} from "@/lib/firestore-helpers";
import { CompactListRow } from "@/components/ui/CompactListRow";
import ActionsDropdown from "@/components/ui/ActionsDropdown";
import { Trash2, Volume2 } from "lucide-react";
import { VocabularyItem, Stage, WordType } from "@/lib/types";
import { useWorkspace } from "@/hooks/useWorkspace";

const wordTypes: WordType[] = [
  "noun", "verb", "adjective", "adverb", "preposition",
  "pronoun", "conjunction", "phrase", "phrasal-verb", "idiom",
];

const wordTypeLabels: Record<WordType, string> = {
  noun: "اسم", verb: "فعل", adjective: "صفة", adverb: "ظرف",
  preposition: "حرف جر", pronoun: "ضمير", conjunction: "أداة ربط",
  phrase: "تعبير", "phrasal-verb": "فعل مركب", idiom: "اصطلاح",
};

export default function VocabularyPage() {
  const [items, setItems] = useState<(VocabularyItem & { id: string })[]>([]);
  const [stages, setStages] = useState<(Stage & { id: string })[]>([]);
  const [form, setForm] = useState({
    word: "", translation: "", wordType: "noun" as WordType,
    example: "", exampleTranslation: "",
    difficulty: "medium" as VocabularyItem["difficulty"],
  });
  const { stageId: workspaceStageId, stageName: workspaceStageName } = useWorkspace();

  useEffect(() => {
    const u1 = listenCollection<VocabularyItem>(
      "vocabulary_items", [orderBy("createdAt", "desc")], setItems
    );
    const u2 = listenCollection<Stage>("stages", [orderBy("order")], setStages);
    return () => { u1(); u2(); };
  }, []);

  const addItem = async () => {
    if (!form.word.trim() || !form.translation.trim() || !workspaceStageId) return;
    await createDoc("vocabulary_items", { ...form, stageId: workspaceStageId, createdAt: Date.now() });
    setForm({ ...form, word: "", translation: "", example: "", exampleTranslation: "" });
  };

  const filtered = items.filter((i) => i.stageId === workspaceStageId);

  return (
    <AppShell requireRole="teacher">
      <PageHeader icon="🔤" title="الكلمات والمفردات" />

      <GlassCard className="mb-6">
        <h2 className="font-bold text-brand-text mb-4">إضافة كلمة جديدة</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <input dir="ltr" placeholder="English word" value={form.word}
            onChange={(e) => setForm({ ...form, word: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
          <input placeholder="الترجمة العربية" value={form.translation}
            onChange={(e) => setForm({ ...form, translation: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
          <select value={form.wordType}
            onChange={(e) => setForm({ ...form, wordType: e.target.value as WordType })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70">
            {wordTypes.map((t) => <option key={t} value={t}>{wordTypeLabels[t]}</option>)}
          </select>
          <input dir="ltr" placeholder="Example sentence" value={form.example}
            onChange={(e) => setForm({ ...form, example: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 md:col-span-2" />
          <input placeholder="ترجمة المثال" value={form.exampleTranslation}
            onChange={(e) => setForm({ ...form, exampleTranslation: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 md:col-span-2" />
          <select value={form.difficulty}
            onChange={(e) => setForm({ ...form, difficulty: e.target.value as any })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70">
            <option value="easy">سهلة</option>
            <option value="medium">متوسطة</option>
            <option value="hard">صعبة</option>
          </select>
        </div>
        <Button onClick={addItem} className="mt-3">إضافة الكلمة</Button>
      </GlassCard>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-brand-text">
          مكتبة "{workspaceStageName ?? "—"}" ({filtered.length})
        </h2>
      </div>

      <GlassCard className="!p-0 overflow-hidden mb-36">
        <div className="flex flex-col">
          {filtered.map((item) => (
            <CompactListRow
              key={item.id}
              avatarLabel={item.word.charAt(0).toUpperCase()}
              title={item.word}
              subtitle={`${item.translation} · ${wordTypeLabels[item.wordType]}`}
              trailing={
                <div className="flex items-center gap-1">
                  <SpeakButton text={item.word} size="sm" />
                  <ActionsDropdown
                    actions={[
                      {
                        label: "نطق الكلمة",
                        icon: <Volume2 className="w-4 h-4" />,
                        onClick: () => { /* SpeakButton handles this, but we can add a manual trigger if needed */ },
                      },
                      {
                        label: "حذف الكلمة",
                        icon: <Trash2 className="w-4 h-4" />,
                        onClick: () => deleteDocById("vocabulary_items", item.id),
                        variant: "danger",
                      },
                    ]}
                  />
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-brand-textMuted text-sm text-center py-12">لا توجد كلمات بعد.</p>
          )}
        </div>
      </GlassCard>
    </AppShell>
  );
}
