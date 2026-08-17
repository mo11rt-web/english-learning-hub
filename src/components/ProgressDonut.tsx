"use client";

// دائرة تقدّم (Donut) بسيطة بـ SVG خالص — بتستخدم نفس متغيرات ألوان
// التطبيق (--brand-primary...) حتى تبقى متناسقة مع باقي التصميم بكل الأوضاع
// (فاتح/داكن) بدون ما نحتاج مكتبة رسوم بيانية خارجية لشي بهالبساطة.

const SIZE = 120;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProgressDonut({
  percentage,
  label,
  subLabel,
  colorVar = "--brand-primary",
  trackVar = "--brand-primary",
}: {
  percentage: number;
  label: string;
  subLabel?: string;
  /** اسم متغير CSS لون الدائرة الممتلئة، مثلاً "--brand-primary" أو "--brand-success" */
  colorVar?: string;
  /** اسم متغير CSS لون خلفية المسار (بشفافية منخفضة) */
  trackVar?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={`rgb(var(${trackVar}) / 0.15)`}
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={`rgb(var(${colorVar}))`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(90 ${SIZE / 2} ${SIZE / 2})`}
          className="fill-brand-text font-bold"
          style={{ fontSize: 22 }}
        >
          {clamped}%
        </text>
      </svg>
      <p className="text-sm font-bold text-brand-text text-center">{label}</p>
      {subLabel && <p className="text-xs text-brand-textMuted text-center">{subLabel}</p>}
    </div>
  );
}
