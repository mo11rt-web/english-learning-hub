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
        "px-4 py-2.5 rounded-xl font-arabic text-sm font-bold transition-all duration-150 active:scale-[0.98]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" &&
          "bg-gradient-to-l from-brand-primary to-brand-secondary text-white hover:brightness-105 shadow-md shadow-brand-primary/15",
        variant === "secondary" &&
          "bg-surface text-brand-text border border-brand-gold/65 hover:bg-brand-goldLight/45",
        variant === "ghost" && "text-brand-text hover:bg-surfaceBorder/40",
        variant === "danger" &&
          "bg-brand-error text-white hover:opacity-90",
        className
      )}
    />
  );
}
