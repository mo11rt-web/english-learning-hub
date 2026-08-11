"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SpeakButton } from "@/components/SpeakButton";
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
  const { user } = useAuth();
  const { stageId: workspaceStageId, stageName: workspaceStageName } = useWorkspace();
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  useEffect(() => {
    const u = listenCollection<IrregularVerb>(
      "irregular_verbs",
      [orderBy("createdAt", "desc")],
      setVerbs
    );
    return () => u();
  }, []);

  const verbsInWorkspace = verbs.filter((v) => v.stageId === workspaceStageId);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
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

  // يستورد القائمة الكاملة (٨٠+ فعل شاذ شائع) دفعة وحدة، ويتجاوز أي فعل
  // موجود مسبقًا بنفس القسم (بالاعتماد على اسم الفعل الأساسي) حتى ما يتكرر
  const importFullList = async () => {
    if (!user || !workspaceStageId) return;
    setImporting(true);
    setImportMsg("");
    try {
      const existingBases = new Set(verbsInWorkspace.map((v) => v.base.trim().toLowerCase()));
      const toAdd = IRREGULAR_VERBS_SEED.filter((v) => !existingBases.has(v.base.toLowerCase()));
      for (const v of toAdd) {
        await createDoc("irregular_verbs", {
          base: v.base,
          pastSimple: v.pastSimple,
          pastParticiple: v.pastParticiple,
          meaningAr: v.meaningAr,
          example: "",
          level: v.level,
          stageId: workspaceStageId,
          active: true,
          createdBy: user.uid,
          createdAt: Date.now(),
        });
      }
      setImportMsg(
        toAdd.length > 0
          ? `✅ تمت إضافة ${toAdd.length} فعل جديد.`
          : "كل الأفعال بالقائمة موجودة أصلًا بهذا القسم."
      );
    } catch (err) {
      console.error("importFullList failed:", err);
      setImportMsg("⚠️ صار خطأ أثناء الاستيراد، حاول مرة ثانية.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <AppShell requireRole="teacher">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-2xl font-bold text-brand-text mb-1">الأفعال الشاذة</h1>
          <p className="text-brand-textMuted text-sm">القسم الحالي: {workspaceStageName ?? "—"}</p>
        </div>
        <Button variant="secondary" onClick={importFullList} disabled={importing || !workspaceStageId}>
          {importing ? "جارٍ الاستيراد..." : `📥 استيراد القائمة الكاملة (${IRREGULAR_VERBS_SEED.length} فعل)`}
        </Button>
      </div>
      {importMsg && <p className="text-sm text-brand-textMuted mb-4">{importMsg}</p>}

      <GlassCard className="mb-6 mt-6">
        <h2 className="font-bold text-brand-text mb-4">
          {editingId ? "تعديل فعل" : "إضافة فعل جديد"}
        </h2>
        <div className="grid md:grid-cols-3 gap-3 mb-3">
          <input
            placeholder="Base (go)"
            dir="ltr"
            value={form.base}
            onChange={(e) => setForm({ ...form, base: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          />
          <input
            placeholder="Past Simple (went)"
            dir="ltr"
            value={form.pastSimple}
            onChange={(e) => setForm({ ...form, pastSimple: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          />
          <input
            placeholder="Past Participle (gone)"
            dir="ltr"
            value={form.pastParticiple}
            onChange={(e) => setForm({ ...form, pastParticiple: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          />
          <input
            placeholder="المعنى بالعربي (يذهب)"
            value={form.meaningAr}
            onChange={(e) => setForm({ ...form, meaningAr: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          />
          <input
            placeholder="مثال (اختياري)"
            dir="ltr"
            value={form.example}
            onChange={(e) => setForm({ ...form, example: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          />
          <select
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value as IrregularVerb["level"] })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
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

      <h2 className="font-bold text-brand-text mb-4">
        القائمة ({verbsInWorkspace.length})
      </h2>
      <div className="grid md:grid-cols-2 gap-3">
        {verbsInWorkspace.map((v) => (
          <GlassCard key={v.id} className={!v.active ? "opacity-50" : ""}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1" dir="ltr">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-brand-primary">{v.base}</span>
                  <SpeakButton text={v.base} size="sm" />
                  <span className="text-brand-textMuted">→</span>
                  <span className="text-brand-text">{v.pastSimple}</span>
                  <span className="text-brand-textMuted">→</span>
                  <span className="text-brand-text">{v.pastParticiple}</span>
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
                  className="text-brand-textMuted text-xs"
                >
                  {v.active ? "تعطيل" : "تفعيل"}
                </button>
                <button onClick={() => deleteDocById("irregular_verbs", v.id)} className="text-brand-error text-xs">
                  حذف
                </button>
              </div>
            </div>
          </GlassCard>
        ))}
        {verbsInWorkspace.length === 0 && (
          <p className="text-brand-textMuted">لا توجد أفعال شاذة بهذا القسم بعد.</p>
        )}
      </div>
    </AppShell>
  );
}
