import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}

export function Button({ variant = "primary", className, ...props }: Props) {
  return (
    <button
      {...props}
      className={clsx(
        "px-4 py-2.5 rounded-2xl font-arabic text-sm font-medium transition-all",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" &&
          "bg-brand-primary text-white hover:bg-brand-secondary shadow-md",
        variant === "secondary" &&
          "bg-surface text-brand-text border border-brand-primary/30 hover:bg-brand-primary/10",
        variant === "ghost" && "text-brand-text hover:bg-surfaceBorder/40",
        variant === "danger" &&
          "bg-brand-error text-white hover:opacity-90",
        className
      )}
    />
  );
}
