"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressDonut } from "@/components/ProgressDonut";
import { ShareSnapshot } from "@/lib/types";

export default function ShareResultsPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareSnapshot | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "shares", token),
      (snap) => {
        if (snap.exists() && (snap.data() as ShareSnapshot).enabled) {
          setData(snap.data() as ShareSnapshot);
        } else {
          setNotFound(true);
        }
        setLoading(false);
      },
      () => {
        setNotFound(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [token]);

  return (
    <div className="min-h-screen bg-app-gradient flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-brand-text" dir="ltr">
            Learn <span className="text-brand-primary">English</span>
          </h1>
          <p className="text-brand-textMuted text-xs" dir="ltr">with Mohanad Allawi</p>
          <p className="text-brand-textMuted text-sm mt-1">تقرير نتائج الطالب لولي الأمر</p>
        </div>

        {loading && <p className="text-center text-brand-textMuted">جاري التحميل...</p>}

        {!loading && notFound && (
          <GlassCard className="text-center">
            <p className="text-brand-error font-medium">
              هذا الرابط غير صالح أو تم إيقاف المشاركة من قبل المعلم.
            </p>
          </GlassCard>
        )}

        {!loading && data && (
          <div className="flex flex-col gap-4">
            <GlassCard>
              <h2 className="text-lg font-bold text-brand-text mb-1">{data.studentName}</h2>
              <p className="text-brand-textMuted text-sm">
                {data.stageName} · {data.groupName}
              </p>
            </GlassCard>

            <div className="grid grid-cols-2 gap-4">
              <GlassCard className="text-center">
                <p className="text-3xl font-bold text-brand-primary">{data.points}</p>
                <p className="text-brand-textMuted text-xs mt-1">نقطة · {data.levelName}</p>
              </GlassCard>
              <GlassCard className="text-center">
                {data.rank && data.totalInGroup ? (
                  <>
                    <p className="text-3xl font-bold text-brand-primary">#{data.rank}</p>
                    <p className="text-brand-textMuted text-xs mt-1">الترتيب من {data.totalInGroup}</p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-brand-textMuted">—</p>
                    <p className="text-brand-textMuted text-xs mt-1">الترتيب غير متاح</p>
                  </>
                )}
              </GlassCard>
            </div>

            <GlassCard>
              <div className="flex flex-wrap justify-center gap-8">
                <ProgressDonut
                  percentage={data.completionPercentage}
                  label="نسبة إنجاز الدروس"
                  subLabel={`${data.lessonsCompleted}/${data.lessonsTotal} درس`}
                  colorVar="--brand-primary"
                />
                <ProgressDonut
                  percentage={data.quizAveragePercentage ?? 0}
                  label="متوسط نتائج الاختبارات"
                  colorVar="--brand-success"
                />
              </div>
            </GlassCard>

            <GlassCard>
              <h3 className="font-bold text-brand-text mb-3">آخر نتائج الاختبارات</h3>
              {data.quizResults.length === 0 ? (
                <p className="text-brand-textMuted text-sm">لا توجد نتائج بعد.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.quizResults.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-surface/60 rounded-xl px-3 py-2 text-sm"
                    >
                      <span className="text-brand-text">{r.title}</span>
                      <span className="text-brand-primary font-medium">
                        {r.score}/{r.maxScore}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            <p className="text-center text-brand-textMuted text-xs">
              هذا رابط عرض للقراءة فقط، آخر تحديث بواسطة المعلم.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
  return [];
}
