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
        ) : (
          /* الكروت الثلاثة تُعرض فورًا دائمًا (الأسماء والأيقونات ثابتة
             ومعروفة مسبقًا)، بدل حجب الشاشة كاملة خلف سبينر لحين وصول
             الرد من Firestore. كل كرت يتحول لحالة "جاهز للضغط" بمجرد ما
             يوصل الـ id الخاص فيه من السيرفر (عادة أجزاء من الثانية بفضل
             الكاش المحلي)، والكروت غير الجاهزة بعد تظهر بحالة نبض خفيف
             بدل الاختفاء بالكامل خلف نص "جاري التحميل". */
          <div className="grid sm:grid-cols-3 gap-4">
            {branchCards.map((b) => {
              const ready = !!b.stage && !seeding && !loading;
              return (
                <button
                  key={b.name}
                  onClick={() => b.stage && choose(b.stage.id)}
                  disabled={!ready}
                  className="block w-full h-full text-right disabled:cursor-wait"
                >
                  <GlassCard
                    className={`transition-all h-full text-center ${
                      ready
                        ? "cursor-pointer hover:shadow-lg active:scale-[0.98] hover:-translate-y-0.5"
                        : "opacity-60"
                    }`}
                  >
                    <div className={`text-4xl mb-3 ${!ready ? "animate-pulse" : ""}`}>{b.icon}</div>
                    <h3 className="font-bold text-brand-text text-lg">{b.name}</h3>
                    <p className="text-brand-textMuted text-xs mt-1">
                      {ready ? "اضغط للدخول" : "جاري التجهيز..."}
                    </p>
                  </GlassCard>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
