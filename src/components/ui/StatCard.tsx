import { GlassCard } from "./GlassCard";

export function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: string;
}) {
  return (
    <GlassCard className="flex items-center gap-4">
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-2xl">
          {icon}
        </div>
      )}
      <div>
        <p className="text-brand-textMuted text-sm">{label}</p>
        <p className="text-brand-text text-2xl font-bold">{value}</p>
      </div>
    </GlassCard>
  );
}
