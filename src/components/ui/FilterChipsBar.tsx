export function FilterChipsBar<T extends string>({
  options,
  active,
  onChange,
}: {
  options: { value: T; label: string; count: number }[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors whitespace-nowrap ${
            active === opt.value
              ? "bg-brand-primary text-white"
              : "bg-surfaceBorder/50 text-brand-textMuted hover:bg-surfaceBorder"
          }`}
        >
          {opt.label}
          <span
            className={`px-1.5 rounded-full ${
              active === opt.value ? "bg-white/20" : "bg-surface/80"
            }`}
          >
            {opt.count}
          </span>
        </button>
      ))}
    </div>
  );
}
