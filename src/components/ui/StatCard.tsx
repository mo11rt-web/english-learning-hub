import { GlassCard } from "./GlassCard";

const GRADIENTS = [
  "from-brand-primary to-brand-secondary",
  "from-brand-gold to-brand-goldLight",
  "from-brand-success to-brand-secondary",
  "from-brand-warning to-brand-gold",
];

export function StatCard({
  label,
  value,
  icon,
  tone = 0,
  onClick,
  active = false,
}: {
  label: string;
  value: string | number;
  icon?: string;
  /** يدور بين 4 تدرجات لون جاهزة حسب ترتيب البطاقة */
  tone?: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const gradient = GRADIENTS[tone % GRADIENTS.length];
  const content = (
    <GlassCard className={`flex items-center gap-4 animate-fade-up transition-all ${active ? "ring-2 ring-brand-primary shadow-lg -translate-y-0.5" : ""}`}>
      {icon && (
        <div
          className={`w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl text-white shadow-md`}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-brand-textMuted text-sm truncate">{label}</p>
        <p className="text-brand-text text-2xl font-bold">{value}</p>
        {onClick && <span className="text-[11px] text-brand-primary mt-1 inline-block">عرض التفاصيل ↓</span>}
      </div>
    </GlassCard>
  );

  if (!onClick) return content;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="w-full text-right rounded-2xl cursor-pointer hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
    >
      {content}
    </button>
  );
}
