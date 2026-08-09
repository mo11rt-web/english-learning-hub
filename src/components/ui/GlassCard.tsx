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
        "bg-white/[0.68] backdrop-blur-[18px] border border-white/[0.76]",
        "rounded-glass shadow-glass p-6",
        className
      )}
    >
      {children}
    </div>
  );
}
