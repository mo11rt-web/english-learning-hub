"use client";

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
      <GlassCard className="p-0 overflow-hidden">
        {visibleVerbs.length > 0 ? (
          <div className="overflow-x-auto max-h-[68vh] overflow-y-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-surfaceBorder">
                <tr className="text-right text-brand-textMuted">
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">التصريف الأول<br /><span className="text-[10px] font-normal">Base Form</span></th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">التصريف الثاني<br /><span className="text-[10px] font-normal">Past Simple</span></th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">التصريف الثالث<br /><span className="text-[10px] font-normal">Past Participle</span></th>
                  <th className="px-4 py-3 font-semibold">الترجمة العربية</th>
                  <th className="px-4 py-3 font-semibold min-w-[220px]">المثال</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">المستوى / الحالة</th>
                  <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surfaceBorder/60">
                {visibleVerbs.map((v) => (
                  <tr key={v.id} className={`align-top transition-colors hover:bg-surface/60 ${!v.active ? "opacity-60" : ""}`}>
                    <td className="px-4 py-4" dir="ltr">
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <span className="font-bold text-brand-primary">{v.base}</span>
                        <SpeakButton text={v.base} size="sm" />
                      </div>
                    </td>
                    <td className="px-4 py-4" dir="ltr">
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <span className="font-medium text-brand-text">{v.pastSimple}</span>
                        <SpeakButton text={v.pastSimple} size="sm" />
                      </div>
                    </td>
                    <td className="px-4 py-4" dir="ltr">
                      <div className="flex items-center gap-2 min-w-[155px]">
                        <span className="font-medium text-brand-text">{v.pastParticiple}</span>
                        <SpeakButton text={v.pastParticiple} size="sm" />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-brand-text" dir="rtl">{v.meaningAr}</td>
                    <td className="px-4 py-4 text-brand-textMuted italic" dir="ltr">
                      {v.example || "—"}
                    </td>
                    <td className="px-4 py-4" dir="rtl">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className="px-2.5 py-1 rounded-lg bg-brand-primary/10 text-brand-primary text-xs whitespace-nowrap">{levelLabel[v.level]}</span>
                        <span className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap ${v.active ? "bg-brand-success/10 text-brand-success" : "bg-surfaceBorder/50 text-brand-textMuted"}`}>
                          {v.active ? "مفعّل" : "معطّل"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap justify-center gap-2 min-w-[170px]">
                        <button onClick={() => startEdit(v)} className="px-3 py-1.5 rounded-lg bg-brand-primary/10 text-brand-primary text-xs font-bold hover:bg-brand-primary/20">تعديل</button>
                        <button
                          onClick={() => updateDocById("irregular_verbs", v.id, { active: !v.active })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${v.active ? "bg-surfaceBorder/60 text-brand-textMuted hover:bg-surfaceBorder" : "bg-brand-success/10 text-brand-success hover:bg-brand-success/20"}`}
                        >
                          {v.active ? "تعطيل" : "✓ تفعيل"}
                        </button>
                        <button onClick={() => deleteDocById("irregular_verbs", v.id)} className="px-3 py-1.5 rounded-lg bg-brand-error/10 text-brand-error text-xs font-bold hover:bg-brand-error/20">حذف</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-brand-textMuted text-center py-10">لا توجد أفعال شاذة بهذا الفلتر بعد.</p>
        )}
      </GlassCard>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </AppShell>
  );
}
