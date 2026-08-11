import { ReactNode } from "react";
import clsx from "clsx";

export function GlassCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "bg-white/[0.68] dark:bg-brand-surface/70 backdrop-blur-[18px] border border-white/[0.76] dark:border-white/10",
        "rounded-glass shadow-glass p-6",
        className
      )}
    >
      {children}
    </div>
  );
}
