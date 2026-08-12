"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressDonut } from "@/components/ProgressDonut";
import { useAuth } from "@/hooks/useAuth";
import { computeStudentReport, StudentReportData } from "@/lib/studentReport";

export default function StudentResultsPage() {
  const { user } = useAuth();
  const [report, setReport] = useState<StudentReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    user
      .getIdToken()
      .then((idToken) => computeStudentReport(user.uid, idToken))
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <AppShell requireRole="student">
      <h1 className="text-2xl font-bold text-brand-text mb-6">تقرير نتائجي</h1>

      {loading && <p className="text-brand-textMuted">جاري تحميل التقرير...</p>}

      {!loading && report && (
        <div className="flex flex-col gap-5">
          <GlassCard>
            <div className="flex flex-wrap justify-center gap-8">
              <ProgressDonut
                percentage={report.completionPercentage}
                label="نسبة إنجاز الدروس"
                subLabel={`${report.lessonsCompleted} من ${report.lessonsTotal} درس`}
                colorVar="--brand-primary"
              />
              <ProgressDonut
                percentage={report.quizAveragePercentage}
                label="متوسط نتائج الاختبارات"
                subLabel={
                  report.recentResults.length
                    ? `آخر ${report.recentResults.length} محاولة`
                    : "لا توجد نتائج بعد"
                }
                colorVar="--brand-success"
              />
            </div>
          </GlassCard>

          <div className="grid sm:grid-cols-2 gap-4">
            <GlassCard>
              <p className="text-xs text-brand-textMuted mb-1">النقاط والمستوى</p>
              <p className="text-3xl font-bold text-brand-primary">
                {report.points} <span className="text-base font-normal text-brand-textMuted">نقطة</span>
              </p>
              <p className="text-sm text-brand-text font-medium mt-1">{report.levelName}</p>
              {report.nextLevelName && (
                <div className="mt-3">
                  <div className="h-2 bg-surfaceBorder/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-primary rounded-full transition-all"
                      style={{ width: `${report.progressToNextLevel}%` }}
                    />
                  </div>
                  <p className="text-xs text-brand-textMuted mt-1">
                    {report.progressToNextLevel}% حتى مستوى &quot;{report.nextLevelName}&quot;
                  </p>
                </div>
              )}
            </GlassCard>

            <GlassCard>
              <p className="text-xs text-brand-textMuted mb-1">ترتيبك بالمجموعة</p>
              {report.rank && report.totalInGroup ? (
                <>
                  <p className="text-3xl font-bold text-brand-primary">
                    #{report.rank} <span className="text-base font-normal text-brand-textMuted">من {report.totalInGroup}</span>
                  </p>
                  <p className="text-sm text-brand-textMuted mt-1">
                    {report.rank === 1
                      ? "🥇 أنت الأول بالمجموعة! استمر هيك."
                      : `مستمر بالتقدم — كمّل نشاطك لترفع ترتيبك.`}
                  </p>
                </>
              ) : (
                <p className="text-brand-textMuted text-sm mt-2">
                  ما في ترتيب متاح حاليًا (لسا ما انضممت لمجموعة، أو المجموعة ما فيها طلاب كفاية).
                </p>
              )}
            </GlassCard>
          </div>

          <GlassCard>
            <h3 className="font-bold text-brand-text mb-3">آخر نتائج الاختبارات والواجبات</h3>
            {report.recentResults.length === 0 ? (
              <p className="text-brand-textMuted text-sm">لا توجد نتائج بعد.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {report.recentResults.map((r, i) => {
                  const pct = r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-surface/60 rounded-xl px-3 py-2.5 text-sm"
                    >
                      <span className="text-brand-text font-medium">{r.title}</span>
                      <span
                        className={`font-bold ${
                          pct >= 70 ? "text-brand-success" : pct >= 50 ? "text-brand-warning" : "text-brand-error"
                        }`}
                      >
                        {r.score}/{r.maxScore} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </AppShell>
  );
}
