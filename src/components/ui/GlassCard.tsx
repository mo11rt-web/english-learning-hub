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
        "bg-surface/[0.68] backdrop-blur-[18px] border border-surfaceBorder/60",
        "rounded-glass shadow-glass p-6",
        className
      )}
    >
      {children}
    </div>
  );
}
