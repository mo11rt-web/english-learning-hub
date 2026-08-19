"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SpeakButton } from "@/components/SpeakButton";
import { Toast } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  listenCollection,
  createDoc,
  updateDocById,
  deleteDocById,
  orderBy,
} from "@/lib/firestore-helpers";
import { CompactListRow } from "@/components/ui/CompactListRow";
import ActionsDropdown from "@/components/ui/ActionsDropdown";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Edit2, Trash2, CheckCircle, XCircle, Volume2 } from "lucide-react";
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
      <PageHeader
        icon="🔄"
        title="الأفعال الشاذة"
        meta={
          <Button onClick={importFullList} disabled={importing || !workspaceStageId}>
            {importing ? "جارٍ الاستيراد..." : `📥 استيراد القائمة الكاملة (${IRREGULAR_VERBS_SEED.length} فعل)`}
          </Button>
        }
      />
      <p className="text-brand-textMuted text-sm -mt-4 mb-1">القسم الحالي: {workspaceStageName ?? "—"}</p>
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
      <GlassCard className="!p-0 overflow-hidden mb-36">
        <div className="flex flex-col">
          {visibleVerbs.map((v) => (
            <CompactListRow
              key={v.id}
              avatarLabel={v.base.charAt(0).toUpperCase()}
              title={`${v.base} (${v.pastSimple} / ${v.pastParticiple})`}
              titleMuted={!v.active}
              subtitle={`${v.meaningAr} · ${levelLabel[v.level]}`}
              badge={<StatusBadge label={v.active ? "مفعّل" : "معطّل"} tone={v.active ? "success" : "muted"} />}
              trailing={
                <div className="flex items-center gap-1">
                  <SpeakButton text={v.base} size="sm" />
                  <ActionsDropdown
                    actions={[
                      {
                        label: "تعديل الفعل",
                        icon: <Edit2 className="w-4 h-4" />,
                        onClick: () => startEdit(v),
                      },
                      {
                        label: v.active ? "تعطيل الفعل" : "تفعيل الفعل",
                        icon: v.active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4 text-brand-success" />,
                        onClick: () => updateDocById("irregular_verbs", v.id, { active: !v.active }),
                      },
                      {
                        label: "نطق الفعل",
                        icon: <Volume2 className="w-4 h-4" />,
                        onClick: () => { /* SpeakButton handles this */ },
                      },
                      {
                        label: "حذف الفعل",
                        icon: <Trash2 className="w-4 h-4" />,
                        onClick: () => deleteDocById("irregular_verbs", v.id),
                        variant: "danger",
                      },
                    ]}
                  />
                </div>
              }
            />
          ))}
          {visibleVerbs.length === 0 && (
            <p className="text-brand-textMuted text-sm text-center py-12">لا توجد أفعال شاذة تطابق هذا الفلتر.</p>
          )}
        </div>
      </GlassCard>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </AppShell>
  );
}
