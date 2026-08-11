"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/hooks/useWorkspace";
import { createDoc } from "@/lib/firestore-helpers";
import { useState } from "react";

const ICONS: Record<string, string> = {
  "الصف التاسع": "9️⃣",
  "التاسع": "9️⃣",
  "بكالوريا": "🎓",
  "البكالوريا": "🎓",
};

function iconFor(name: string) {
  for (const key in ICONS) {
    if (name.includes(key)) return ICONS[key];
  }
  return "📚";
}

export default function WorkspacePage() {
  return (
    <Suspense
      fallback={
        <AppShell requireRole="teacher">
          <p className="text-brand-textMuted text-center">جاري التحميل...</p>
        </AppShell>
      }
    >
      <WorkspacePageInner />
    </Suspense>
  );
}

function WorkspacePageInner() {
  const { stages, setStageId, loading } = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const [newStageName, setNewStageName] = useState("");
  const [adding, setAdding] = useState(false);
  const from = params.get("from") || "/dashboard";

  const choose = (id: string) => {
    setStageId(id);
    router.replace(from);
  };

  const addStage = async () => {
    if (!newStageName.trim()) return;
    setAdding(true);
    const ref = await createDoc("stages", {
      name: newStageName.trim(),
      order: stages.length,
    });
    setAdding(false);
    setNewStageName("");
    choose(ref.id);
  };

  return (
    <AppShell requireRole="teacher">
      <div className="max-w-2xl mx-auto py-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-brand-text mb-2">أي قسم بدك تشتغل عليه؟</h1>
          <p className="text-brand-textMuted">
            اختر المرحلة حتى تنعرض عليك بس بيانات هاد القسم (طلاب، دروس، أسئلة...) — منعًا لاختلاط البيانات بين الأقسام.
            تقدر تبدّل القسم بأي وقت من القائمة الجانبية.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-brand-textMuted">جاري التحميل...</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {stages.map((s) => (
              <button key={s.id} onClick={() => choose(s.id)} className="text-right">
                <GlassCard className="hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer h-full">
                  <div className="text-4xl mb-3">{iconFor(s.name)}</div>
                  <h3 className="font-bold text-brand-text text-lg">{s.name}</h3>
                  <p className="text-brand-textMuted text-sm mt-1">
                    اضغط للدخول إلى بيانات هذه المرحلة
                  </p>
                </GlassCard>
              </button>
            ))}
          </div>
        )}

        {stages.length === 0 && !loading && (
          <p className="text-center text-brand-textMuted mb-6">
            لا توجد أي مرحلة بعد — أضف أول واحدة تحت (مثلًا "الصف التاسع" أو "بكالوريا").
          </p>
        )}

        <GlassCard>
          <h2 className="font-bold text-brand-text mb-3 text-sm">إضافة قسم/مرحلة جديدة</h2>
          <div className="flex gap-2">
            <input
              placeholder="مثال: الصف التاسع، بكالوريا علمي..."
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
            />
            <Button onClick={addStage} disabled={adding}>
              {adding ? "..." : "+ إضافة"}
            </Button>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
