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
        "bg-surface/[0.86] backdrop-blur-[18px] border border-surfaceBorder/75",
        "rounded-glass shadow-glass p-5 md:p-6 transition-shadow duration-200",
        className
      )}
    >
      {children}
    </div>
  );
}
