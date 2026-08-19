import { ReactNode } from "react";

export function CompactListRow({
  avatarLabel,
  avatarGradient = "from-brand-primary to-brand-secondary",
  title,
  titleMuted = false,
  subtitle,
  badge,
  trailing,
  onClick,
  active = false,
}: {
  avatarLabel: string;
  avatarGradient?: string;
  title: string;
  titleMuted?: boolean;
  subtitle?: ReactNode;
  badge?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`w-full flex items-start gap-2.5 px-2.5 py-2.5 border-b border-surfaceBorder/50 last:border-b-0 ${
        onClick ? "text-right hover:bg-surface/60 active:bg-surface transition-colors" : ""
      } ${active ? "bg-brand-primary/10" : ""}`}
    >
      <div
        className={`w-[42px] h-[42px] shrink-0 rounded-full bg-gradient-to-br ${avatarGradient} text-white text-sm font-bold flex items-center justify-center mt-0.5`}
      >
        {avatarLabel}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[13px] font-bold truncate ${titleMuted ? "text-brand-textMuted" : "text-brand-text"}`}>
            {title}
          </span>
          {badge}
        </div>
        {subtitle && <div className="text-[11px] text-brand-textMuted mt-0.5 truncate">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0 mt-1">{trailing}</div>}
    </Wrapper>
  );
}
