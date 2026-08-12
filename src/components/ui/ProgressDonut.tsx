// حلقة تقدّم دائرية (Donut) — نفس فكرة كرت "Actual Progress" بمنصة علاوي نت
export function ProgressDonut({
  percentage,
  label = "التقدم الفعلي",
  size = 160,
}: {
  percentage: number;
  label?: string;
  size?: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percentage)));
  const stroke = size * 0.12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-black/10 dark:text-white/10"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-brand-primary transition-all duration-700 ease-out"
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-brand-primary">{pct}%</span>
        </div>
      </div>
      <p className="font-bold text-brand-text mt-3">{label}</p>
      <p className="text-brand-textMuted text-sm">المتبقي {100 - pct}%</p>
    </div>
  );
}
