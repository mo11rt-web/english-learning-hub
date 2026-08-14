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

export default function SettingsPage() {
  const [settings, setSettings] = useState<PointsSettings>(DEFAULT_POINTS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getPointsSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

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
