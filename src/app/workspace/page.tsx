"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { useWorkspace } from "@/hooks/useWorkspace";
import { createDoc } from "@/lib/firestore-helpers";

// الأقسام الثابتة الوحيدة المسموحة بالمنصة — لا يوجد إضافة أقسام حرة، فقط
// هاي الثلاثة (تُنشأ تلقائيًا أول مرة إذا لم تكن موجودة أصلًا)
const FIXED_BRANCHES: { name: string; icon: string; order: number }[] = [
  { name: "الصف التاسع", icon: "9️⃣", order: 0 },
  { name: "بكالوريا علمي", icon: "🔬", order: 1 },
  { name: "بكالوريا أدبي", icon: "📖", order: 2 },
];

export default function WorkspacePage() {
  return (
    <Suspense
      fallback={
        <AppShell requireRole="teacher">
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary/25 border-t-brand-primary" />
          </div>
        </AppShell>
      }
    >
      <WorkspacePageInner />
    </Suspense>
  );
}

function WorkspacePageInner() {
  const { stages, setStageId, loading, error, retry } = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const [seeding, setSeeding] = useState(false);
  const from = params.get("from") || "/dashboard";

  // ننشئ الأقسام الثلاثة الثابتة تلقائيًا أول مرة فقط (إذا لم تكن موجودة)
  useEffect(() => {
    if (loading || seeding) return;
    const missing = FIXED_BRANCHES.filter(
      (b) => !stages.some((s) => s.name === b.name)
    );
    if (missing.length === 0) return;
    setSeeding(true);
    Promise.all(
      missing.map((b) => createDoc("stages", { name: b.name, order: b.order }))
    ).finally(() => setSeeding(false));
  }, [loading, stages, seeding]);

  const choose = (id: string) => {
    setStageId(id);
    router.replace(from);
  };

  const branchCards = FIXED_BRANCHES.map((b) => ({
    ...b,
    stage: stages.find((s) => s.name === b.name),
  }));

  return (
    <AppShell requireRole="teacher">
      <div className="max-w-2xl mx-auto py-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-brand-text mb-2">أي فرع بدك تشتغل عليه؟</h1>
          <p className="text-brand-textMuted">
            اختر الفرع قبل ما تبلش — كل بياناتك (طلاب، دروس، أسئلة، مجموعات) رح تكون خاصة
            بهاد الفرع بس. تقدر تبدّله بأي وقت من القائمة الجانبية.
          </p>
        </div>

        {error ? (
          <div className="text-center py-8">
            <p className="text-brand-error font-bold mb-4">{error}</p>
            <button
              onClick={retry}
              className="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-bold"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : loading || seeding ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary/25 border-t-brand-primary" />
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            {branchCards.map((b) => (
              <button
                key={b.name}
                onClick={() => b.stage && choose(b.stage.id)}
                disabled={!b.stage}
                className="block w-full text-right disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <GlassCard className="hover:shadow-lg active:scale-[0.98] hover:-translate-y-0.5 transition-all cursor-pointer h-full text-center">
                  <div className="text-4xl mb-3">{b.icon}</div>
                  <h3 className="font-bold text-brand-text text-lg">{b.name}</h3>
                  <p className="text-brand-textMuted text-xs mt-1">
                    اضغط للدخول
                  </p>
                </GlassCard>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
