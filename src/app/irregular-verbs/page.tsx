"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SpeakButton } from "@/components/SpeakButton";
import { Toast } from "@/components/ui/Modal";
import {
  listenCollection,
  createDoc,
  updateDocById,
  deleteDocById,
  orderBy,
} from "@/lib/firestore-helpers";
import { IrregularVerb } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { IRREGULAR_VERBS_SEED } from "@/lib/irregularVerbsData";

const emptyForm = {
  base: "",
  pastSimple: "",
  pastParticiple: "",
  meaningAr: "",
  example: "",
  level: "easy" as IrregularVerb["level"],
};

export default function IrregularVerbsPage() {
  const [verbs, setVerbs] = useState<(IrregularVerb & { id: string })[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const { user } = useAuth();
  const { stageId: workspaceStageId, stageName: workspaceStageName } = useWorkspace();

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const u = listenCollection<IrregularVerb>(
      "irregular_verbs",
      [orderBy("createdAt", "desc")],
      setVerbs
    );
    return () => u();
  }, []);

  const verbsInWorkspace = verbs.filter((v) => v.stageId === workspaceStageId);
  const visibleVerbs = verbsInWorkspace.filter((v) =>
    filterActive === "all" ? true : filterActive === "active" ? v.active : !v.active
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  // استيراد القائمة الكاملة (~125 فعل شائع) دفعة وحدة، كل فعل بينضاف
  // "معطّل" افتراضيًا (active: false) — المعلم بعدين بيراجعهم ويفعّل بس
  // يلي بدو يعرضهم فعليًا للطلاب، بضغطة "تفعيل" لكل فعل (موجودة بالأسفل).
  // ما منكرر أي فعل عنده أصلاً بنفس القسم (مطابقة بالاسم base).
  const importFullList = async () => {
    if (!user || !workspaceStageId) return;
    setImporting(true);
    try {
      const existingBases = new Set(verbsInWorkspace.map((v) => v.base.toLowerCase()));
      const toImport = IRREGULAR_VERBS_SEED.filter(
        (seed) => !existingBases.has(seed.base.toLowerCase())
      );
      for (const seed of toImport) {
        await createDoc("irregular_verbs", {
          base: seed.base,
          pastSimple: seed.pastSimple,
          pastParticiple: seed.pastParticiple,
          meaningAr: seed.meaningAr,
          example: seed.example,
          level: seed.level,
          stageId: workspaceStageId,
          active: false,
          createdBy: user.uid,
          createdAt: Date.now(),
        });
      }
      const skipped = IRREGULAR_VERBS_SEED.length - toImport.length;
      showToast(
        `تم استيراد ${toImport.length} فعل جديد (معطّل افتراضيًا)${
          skipped ? ` — تم تخطي ${skipped} موجود مسبقًا` : ""
        } ✅`
      );
      setFilterActive("inactive");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`تعذّر الاستيراد: ${msg}`, "error");
    } finally {
      setImporting(false);
    }
  };

  const submit = async () => {
    if (
      !form.base.trim() ||
      !form.pastSimple.trim() ||
      !form.pastParticiple.trim() ||
      !form.meaningAr.trim() ||
      !user ||
      !workspaceStageId
    )
      return;

    if (editingId) {
      await updateDocById("irregular_verbs", editingId, {
        base: form.base.trim(),
        pastSimple: form.pastSimple.trim(),
        pastParticiple: form.pastParticiple.trim(),
        meaningAr: form.meaningAr.trim(),
        example: form.example.trim(),
        level: form.level,
      });
    } else {
      await createDoc("irregular_verbs", {
        base: form.base.trim(),
        pastSimple: form.pastSimple.trim(),
        pastParticiple: form.pastParticiple.trim(),
        meaningAr: form.meaningAr.trim(),
        example: form.example.trim(),
        level: form.level,
        stageId: workspaceStageId,
        active: true,
        createdBy: user.uid,
        createdAt: Date.now(),
      });
    }
    resetForm();
  };

  const startEdit = (v: IrregularVerb & { id: string }) => {
    setEditingId(v.id);
    setForm({
      base: v.base,
      pastSimple: v.pastSimple,
      pastParticiple: v.pastParticiple,
      meaningAr: v.meaningAr,
      example: v.example ?? "",
      level: v.level,
    });
  };

  const levelLabel: Record<IrregularVerb["level"], string> = {
    easy: "سهل", medium: "متوسط", hard: "صعب",
  };

  return (
    <AppShell requireRole="teacher">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">الأفعال الشاذة</h1>
          <p className="text-brand-textMuted text-sm">القسم الحالي: {workspaceStageName ?? "—"}</p>
        </div>
        <Button onClick={importFullList} disabled={importing || !workspaceStageId}>
          {importing ? "جارٍ الاستيراد..." : `📥 استيراد القائمة الكاملة (${IRREGULAR_VERBS_SEED.length} فعل)`}
        </Button>
      </div>
      <p className="text-brand-textMuted text-xs mb-6">
        بعد الاستيراد، الأفعال بتنضاف معطّلة افتراضيًا — دور بتبويب &quot;معطّل&quot; بالأسفل وفعّل بس يلي بدك تعرضه فعليًا للطلاب.
      </p>

      <GlassCard className="mb-6">
        <h2 className="font-bold text-brand-text mb-4">
          {editingId ? "تعديل فعل" : "إضافة فعل جديد"}
        </h2>
        <div className="grid md:grid-cols-3 gap-3 mb-3">
          <input
            placeholder="Base (go)"
            dir="ltr"
            value={form.base}
            onChange={(e) => setForm({ ...form, base: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
          />
          <input
            placeholder="Past Simple (went)"
            dir="ltr"
            value={form.pastSimple}
            onChange={(e) => setForm({ ...form, pastSimple: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
          />
          <input
            placeholder="Past Participle (gone)"
            dir="ltr"
            value={form.pastParticiple}
            onChange={(e) => setForm({ ...form, pastParticiple: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
          />
          <input
            placeholder="المعنى بالعربي (يذهب)"
            value={form.meaningAr}
            onChange={(e) => setForm({ ...form, meaningAr: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
          />
          <input
            placeholder="مثال (اختياري)"
            dir="ltr"
            value={form.example}
            onChange={(e) => setForm({ ...form, example: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
          />
          <select
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value as IrregularVerb["level"] })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
          >
            <option value="easy">سهل</option>
            <option value="medium">متوسط</option>
            <option value="hard">صعب</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button onClick={submit}>{editingId ? "حفظ التعديل" : "إضافة الفعل"}</Button>
          {editingId && (
            <button onClick={resetForm} className="text-brand-textMuted text-sm px-3">
              إلغاء
            </button>
          )}
        </div>
      </GlassCard>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-bold text-brand-text">
          القائمة ({visibleVerbs.length})
        </h2>
        <div className="flex bg-surfaceBorder/40 rounded-xl p-1">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterActive === f ? "bg-surface shadow text-brand-primary" : "text-brand-textMuted"
              }`}
            >
              {f === "all" ? "الكل" : f === "active" ? "مفعّل" : "معطّل"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {visibleVerbs.map((v) => (
          <GlassCard key={v.id} className={!v.active ? "opacity-60" : ""}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1" dir="ltr">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mb-1">
                  <span className="font-bold text-brand-primary">{v.base}</span>
                  <SpeakButton text={v.base} size="sm" />
                  <span className="text-brand-textMuted">→</span>
                  <span className="text-brand-text">{v.pastSimple}</span>
                  <SpeakButton text={v.pastSimple} size="sm" />
                  <span className="text-brand-textMuted">→</span>
                  <span className="text-brand-text">{v.pastParticiple}</span>
                  <SpeakButton text={v.pastParticiple} size="sm" />
                </div>
                <p dir="rtl" className="text-sm text-brand-textMuted">
                  {v.meaningAr} · {levelLabel[v.level]}
                </p>
                {v.example && <p dir="ltr" className="text-xs text-brand-textMuted italic mt-1">{v.example}</p>}
              </div>
              <div className="flex flex-col gap-1 items-end shrink-0">
                <button onClick={() => startEdit(v)} className="text-brand-primary text-xs">تعديل</button>
                <button
                  onClick={() => updateDocById("irregular_verbs", v.id, { active: !v.active })}
                  className={`text-xs font-medium ${v.active ? "text-brand-textMuted" : "text-brand-success"}`}
                >
                  {v.active ? "تعطيل" : "✓ تفعيل"}
                </button>
                <button onClick={() => deleteDocById("irregular_verbs", v.id)} className="text-brand-error text-xs">
                  حذف
                </button>
              </div>
            </div>
          </GlassCard>
        ))}
        {visibleVerbs.length === 0 && (
          <p className="text-brand-textMuted">لا توجد أفعال شاذة بهذا الفلتر بعد.</p>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </AppShell>
  );
}
