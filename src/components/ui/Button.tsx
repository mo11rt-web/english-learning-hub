import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** حجم الزر — الافتراضي (md) هو نفس الشكل القديم تمامًا، ما في أي تغيير
   * بصري على الأزرار الموجودة يلي ما بتحدد size. */
  size?: "sm" | "md" | "lg";
}

const SIZE_STYLES: Record<NonNullable<Props["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2.5 text-sm rounded-xl",
  lg: "px-5 py-3 text-base rounded-xl",
};

export function Button({ variant = "primary", size = "md", className, ...props }: Props) {
  return (
    <button
      {...props}
      className={clsx(
        "font-arabic font-bold transition-all duration-150 active:scale-[0.98] inline-flex items-center justify-center gap-1.5",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        SIZE_STYLES[size],
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
