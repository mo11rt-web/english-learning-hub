"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import {
  DEFAULT_POINTS_SETTINGS,
  PointsSettings,
  getPointsSettings,
  savePointsSettings,
  LEVELS,
} from "@/lib/gamification";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getLeaderboardSettings, refreshPublicLeaderboard } from "@/lib/leaderboard";
import { LeaderboardPeriod } from "@/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<PointsSettings>(DEFAULT_POINTS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [leaderboard, setLeaderboard] = useState({ enabled: true, limit: 5, period: "month" as LeaderboardPeriod });
  const [leaderboardSaved, setLeaderboardSaved] = useState(false);
  const { user } = useAuth();
  const { stageId, stageName } = useWorkspace();

  useEffect(() => {
    getPointsSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!stageId) return;
    getLeaderboardSettings(stageId).then((value) => setLeaderboard({ enabled: value.enabled, limit: value.limit, period: value.period })).catch(() => {});
  }, [stageId]);

  const field = (key: keyof PointsSettings, label: string, hint?: string) => (
    <div>
      <label className="text-sm text-brand-text block mb-1.5">{label}</label>
      <input
        type="number"
        value={settings[key]}
        onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })}
        className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
      />
      {hint && <p className="text-xs text-brand-textMuted mt-1">{hint}</p>}
    </div>
  );

  const handleSave = async () => {
    setSaving(true);
    await savePointsSettings(settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleLeaderboardSave = async () => {
    if (!stageId || !user) return;
    setSaving(true);
    await refreshPublicLeaderboard(stageId, leaderboard, user.uid);
    setSaving(false);
    setLeaderboardSaved(true);
    setTimeout(() => setLeaderboardSaved(false), 2500);
  };

  if (loading) {
    return (
      <AppShell requireRole="teacher">
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary/25 border-t-brand-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell requireRole="teacher">
      <PageHeader icon="⚙️" title="إعدادات النقاط والمستويات" />

      <GlassCard className="mb-6">
        <h2 className="font-bold text-brand-text mb-4">قيم النقاط الممنوحة</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {field("lessonComplete", "إكمال درس", "نقاط تُمنح للطالب عند إنهاء أي درس")}
          {field("quizComplete", "إكمال اختبار قصير / تمرين", "نقاط أساسية عند تسليم اختبار قصير")}
          {field("examComplete", "إكمال امتحان", "نقاط أساسية عند تسليم امتحان")}
          {field("highScoreBonus", "مكافأة الدرجة العالية", "نقاط إضافية عند تجاوز نسبة النجاح المحددة تحت")}
          {field("highScoreThreshold", "نسبة الدرجة العالية (%)", "مثلاً 90 تعني: من حقق 90% فأكثر يأخذ المكافأة")}
        </div>
        <Button onClick={handleSave} disabled={saving} className="mt-4">
          {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
        </Button>
        {saved && <p className="text-brand-success text-sm mt-2">✅ تم الحفظ</p>}
      </GlassCard>

      <GlassCard className="mb-6">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-brand-text mb-1">🏆 لوحة الطلاب الأوائل</h2><p className="text-xs text-brand-textMuted">القسم الحالي: {stageName ?? "—"}. يتم ترتيب الطلاب تلقائياً حسب نقاطهم الحالية.</p></div><span className="text-2xl">⭐</span></div>
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          <label className="flex items-center gap-2 text-sm text-brand-text"><input type="checkbox" checked={leaderboard.enabled} onChange={(event) => setLeaderboard({ ...leaderboard, enabled: event.target.checked })} /> إظهار اللوحة للطلاب والزوار</label>
          <label className="text-sm text-brand-text">عدد الطلاب<select value={leaderboard.limit} onChange={(event) => setLeaderboard({ ...leaderboard, limit: Number(event.target.value) })} className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"><option value={3}>3 طلاب</option><option value={5}>5 طلاب</option><option value={10}>10 طلاب</option></select></label>
          <label className="text-sm text-brand-text">الفترة<select value={leaderboard.period} onChange={(event) => setLeaderboard({ ...leaderboard, period: event.target.value as LeaderboardPeriod })} className="w-full mt-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"><option value="week">هذا الأسبوع</option><option value="month">هذا الشهر</option><option value="term">الفصل الحالي</option><option value="all">الترتيب العام</option></select></label>
        </div>
        <Button onClick={handleLeaderboardSave} disabled={saving || !stageId} className="mt-4">{saving ? "جارٍ التحديث..." : "حفظ وتحديث اللوحة"}</Button>
        {leaderboardSaved && <p className="text-brand-success text-sm mt-2">✅ تم تحديث لوحة المتفوقين</p>}
      </GlassCard>

      <GlassCard>
        <h2 className="font-bold text-brand-text mb-4">مستويات الطلاب</h2>
        <p className="text-brand-textMuted text-sm mb-3">
          المستوى يُحسب تلقائيًا حسب مجموع نقاط الطالب:
        </p>
        <div className="flex flex-col gap-2">
          {LEVELS.map((lvl) => (
            <div
              key={lvl.name}
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-surface/60 text-sm"
            >
              <span className="text-brand-text font-medium">{lvl.name}</span>
              <span className="text-brand-textMuted" dir="ltr">
                {lvl.minPoints}+ نقطة
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    </AppShell>
  );
}
