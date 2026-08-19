type Tone = "success" | "warning" | "error" | "danger" | "muted" | "primary" | "gold";

const STYLES: Record<Tone, string> = {
  success: "bg-brand-success/15 text-brand-success",
  warning: "bg-brand-warning/15 text-brand-warning",
  error: "bg-brand-error/15 text-brand-error",
  danger: "bg-brand-error/15 text-brand-error",
  muted: "bg-surfaceBorder/60 text-brand-textMuted",
  primary: "bg-brand-primary/15 text-brand-primary",
  gold: "bg-brand-gold/15 text-brand-gold",
};

const DOT_STYLES: Record<Tone, string> = {
  success: "bg-brand-success",
  warning: "bg-brand-warning",
  error: "bg-brand-error",
  danger: "bg-brand-error",
  muted: "bg-brand-textMuted",
  primary: "bg-brand-primary",
  gold: "bg-brand-gold",
};

export function StatusBadge({ label, tone = "muted" }: { label: string; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STYLES[tone]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${DOT_STYLES[tone]}`} />
      {label}
    </span>
  );
}
