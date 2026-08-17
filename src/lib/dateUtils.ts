const SYRIAN_MONTHS = [
  "كانون الثاني",
  "شباط",
  "آذار",
  "نيسان",
  "أيار",
  "حزيران",
  "تموز",
  "آب",
  "أيلول",
  "تشرين الأول",
  "تشرين الثاني",
  "كانون الأول",
] as const;

type DateInput = number | string | Date | { toDate?: () => Date } | null | undefined;

type FormatOptions = {
  includeTime?: boolean;
  includeSeconds?: boolean;
  month?: "short" | "long";
};

function toDate(value: DateInput): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number" || typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function toArabicDigits(value: number) {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

export function formatSyrianDate(value: DateInput, options: FormatOptions = {}) {
  const date = toDate(value);
  if (!date) return "—";

  const day = toArabicDigits(date.getDate());
  const month = SYRIAN_MONTHS[date.getMonth()];
  const year = toArabicDigits(date.getFullYear());
  const dateText = `${day} ${month} ${year}`;

  if (!options.includeTime) return dateText;

  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const period = hours >= 12 ? "م" : "ص";
  const hour12 = hours % 12 || 12;
  const timeText = `${toArabicDigits(hour12)}:${toArabicDigits(Number(minutes))} ${period}`;
  return `${dateText}، ${timeText}`;
}

export function formatSyrianShortDate(value: DateInput) {
  const date = toDate(value);
  if (!date) return "—";
  return `${toArabicDigits(date.getDate())} ${SYRIAN_MONTHS[date.getMonth()]}`;
}

export function getSyrianMonthName(monthIndex: number) {
  return SYRIAN_MONTHS[monthIndex] ?? "";
}
