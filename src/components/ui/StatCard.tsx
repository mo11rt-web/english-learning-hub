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
}: {
  label: string;
  value: string | number;
  icon?: string;
  /** يدور بين 4 تدرجات لون جاهزة حسب ترتيب البطاقة */
  tone?: number;
}) {
  const gradient = GRADIENTS[tone % GRADIENTS.length];
  return (
    <GlassCard className="flex items-center gap-4 animate-fade-up">
      {icon && (
        <div
          className={`w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl text-white shadow-md`}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-brand-textMuted text-sm truncate">{label}</p>
        <p className="text-brand-text text-2xl font-bold">{value}</p>
      </div>
    </GlassCard>
  );
}
