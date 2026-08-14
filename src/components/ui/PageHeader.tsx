import { ReactNode } from "react";

export function PageHeader({
  icon,
  title,
  meta,
}: {
  icon: string;
  title: string;
  /** عنصر اختياري على يمين العنوان — عداد، شارة حالة، أو زر إجراء سريع */
  meta?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white text-xl shadow-md">
          {icon}
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-brand-text truncate">{title}</h1>
      </div>
      {meta && <div className="shrink-0">{meta}</div>}
    </div>
  );
}
