"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressDonut } from "@/components/ProgressDonut";
import { CompactListRow } from "@/components/ui/CompactListRow";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { computeStudentReport, StudentReportData } from "@/lib/studentReport";
import { formatSyrianDate } from "@/lib/dateUtils";

export default function StudentResultsPage() {
  const { user } = useAuth();
  const [report, setReport] = useState<StudentReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReport(null);
    user
      .getIdToken()
      .then((idToken) => computeStudentReport(user.uid, idToken))
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "تعذر تحميل تقرير النتائج.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, retryKey]);

  return (
    <AppShell requireRole="student">
      <PageHeader icon="📊" title="تقرير نتائجي" />

      {loading && <p className="text-brand-textMuted">جاري تحميل التقرير...</p>}

      {!loading && error && (
        <GlassCard className="max-w-lg mx-auto text-center">
          <p className="text-brand-error mb-4">{error}</p>
          <button
            onClick={() => setRetryKey((value) => value + 1)}
            className="px-4 py-2 rounded-xl bg-brand-primary text-white text-sm"
          >
            إعادة المحاولة
          </button>
        </GlassCard>
      )}

      {!loading && !error && report && (
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

          <GlassCard className="!p-0 overflow-hidden mb-36">
            <div className="px-5 py-4 border-b border-surfaceBorder/60">
              <h3 className="font-bold text-brand-text">آخر نتائج الاختبارات والواجبات</h3>
            </div>
            {report.recentResults.length === 0 ? (
              <p className="text-center text-brand-textMuted py-12 text-sm">لا توجد نتائج بعد.</p>
            ) : (
              <div className="flex flex-col">
                {report.recentResults.map((r, i) => {
                  const pct = r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0;
                  const pending = r.status === "pending-review";
                  
                  return (
                    <CompactListRow
                      key={i}
                      avatarLabel={r.title?.[0] ?? "ن"}
                      title={r.title}
                      subtitle={formatSyrianDate(r.date ?? Date.now())}
                      badge={
                        <StatusBadge
                          label={pending ? "بانتظار المراجعة" : `${r.score}/${r.maxScore} (${pct}%)`}
                          tone={pending ? "warning" : pct >= 70 ? "success" : pct >= 50 ? "warning" : "error"}
                        />
                      }
                    />
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
