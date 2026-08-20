/**
 * src/components/LoginBackdrop.tsx
 * ------------------------------------------------------------------
 * خلفية زخرفية كثيفة (كلمات إنجليزية/عربية متعلقة بتعلم اللغة + رموز
 * كتب/دفاتر/أقلام) بشفافية خفيفة، بتغطي كامل شاشة تسجيل الدخول — نمط
 * شبيه بخلفيات محادثة واتساب. عناصر زخرفية بحتة (aria-hidden) وما
 * بتتفاعل مع أي حدث (pointer-events: none) حتى ما تعيق الفورم فوقها.
 * ------------------------------------------------------------------
 */
const ITEMS: { type: "word" | "icon"; content: string; top: string; side: "right" | "left"; offset: string; size: string; color: string; rotate: number; dir?: "ltr" }[] = [
  { type: "icon", content: "📖", top: "1%", side: "right", offset: "10px", size: "26px", color: "", rotate: -10 },
  { type: "word", content: "Hello", top: "2%", side: "left", offset: "16px", size: "13px", color: "text-brand-sidebar", rotate: 7, dir: "ltr" },
  { type: "icon", content: "✏️", top: "3%", side: "left", offset: "100px", size: "18px", color: "", rotate: 25 },
  { type: "word", content: "Grammar", top: "5%", side: "right", offset: "70px", size: "12px", color: "text-brand-gold", rotate: -6, dir: "ltr" },
  { type: "word", content: "قواعد", top: "10%", side: "left", offset: "10px", size: "17px", color: "text-brand-primary", rotate: -8 },
  { type: "icon", content: "📓", top: "9%", side: "right", offset: "20px", size: "22px", color: "", rotate: 8 },
  { type: "icon", content: "🖋️", top: "8%", side: "left", offset: "150px", size: "17px", color: "", rotate: -20 },
  { type: "word", content: "Practice", top: "13%", side: "right", offset: "130px", size: "11px", color: "text-brand-sidebar", rotate: 9, dir: "ltr" },
  { type: "word", content: "تدرّب", top: "16%", side: "left", offset: "44px", size: "15px", color: "text-brand-sidebar", rotate: 5 },
  { type: "icon", content: "📕", top: "15%", side: "right", offset: "60px", size: "20px", color: "", rotate: -14 },
  { type: "word", content: "Read", top: "20%", side: "right", offset: "180px", size: "12px", color: "text-brand-primary", rotate: -5, dir: "ltr" },
  { type: "icon", content: "💡", top: "21%", side: "right", offset: "20px", size: "18px", color: "", rotate: 10 },
  { type: "icon", content: "📄", top: "24%", side: "left", offset: "14px", size: "19px", color: "", rotate: 10 },
  { type: "word", content: "اقرأ", top: "25%", side: "right", offset: "14px", size: "14px", color: "text-brand-gold", rotate: 6 },
  { type: "icon", content: "✏️", top: "27%", side: "right", offset: "90px", size: "15px", color: "", rotate: -30 },
  { type: "word", content: "Write", top: "28%", side: "left", offset: "110px", size: "12px", color: "text-brand-sidebar", rotate: 8, dir: "ltr" },
  { type: "icon", content: "📗", top: "31%", side: "left", offset: "40px", size: "22px", color: "", rotate: 11 },
  { type: "word", content: "اكتب", top: "32%", side: "right", offset: "100px", size: "14px", color: "text-brand-primary", rotate: -7 },
  { type: "icon", content: "📓", top: "30%", side: "right", offset: "30px", size: "18px", color: "", rotate: -9 },
  { type: "word", content: "Verb", top: "35%", side: "left", offset: "120px", size: "16px", color: "text-brand-sidebar", rotate: -6, dir: "ltr" },
  { type: "icon", content: "🈯", top: "34%", side: "left", offset: "10px", size: "19px", color: "", rotate: 8 },
  { type: "word", content: "فعل", top: "36%", side: "right", offset: "150px", size: "12px", color: "text-brand-gold", rotate: 5 },
  { type: "icon", content: "🖋️", top: "38%", side: "right", offset: "16px", size: "17px", color: "", rotate: -16 },
  { type: "word", content: "Vocabulary", top: "56%", side: "left", offset: "16px", size: "17px", color: "text-brand-sidebar", rotate: -6, dir: "ltr" },
  { type: "icon", content: "📚", top: "56%", side: "right", offset: "20px", size: "22px", color: "", rotate: 12 },
  { type: "word", content: "مفردات", top: "60%", side: "right", offset: "110px", size: "13px", color: "text-brand-gold", rotate: 5 },
  { type: "icon", content: "📓", top: "61%", side: "left", offset: "120px", size: "19px", color: "", rotate: -9 },
  { type: "icon", content: "✏️", top: "58%", side: "left", offset: "60px", size: "16px", color: "", rotate: 22 },
  { type: "word", content: "Speak", top: "64%", side: "left", offset: "40px", size: "18px", color: "text-brand-primary", rotate: -4, dir: "ltr" },
  { type: "word", content: "تحدّث", top: "65%", side: "right", offset: "80px", size: "12px", color: "text-brand-sidebar", rotate: 8 },
  { type: "icon", content: "🖋️", top: "67%", side: "right", offset: "14px", size: "17px", color: "", rotate: -18 },
  { type: "icon", content: "📖", top: "68%", side: "left", offset: "150px", size: "18px", color: "", rotate: 9 },
  { type: "word", content: "Success", top: "70%", side: "right", offset: "-4px", size: "14px", color: "text-brand-primary", rotate: -9, dir: "ltr" },
  { type: "word", content: "نجاح", top: "73%", side: "left", offset: "-4px", size: "13px", color: "text-brand-gold", rotate: 6 },
  { type: "icon", content: "🏆", top: "71%", side: "left", offset: "110px", size: "19px", color: "", rotate: -6 },
  { type: "word", content: "Learn", top: "72%", side: "right", offset: "110px", size: "12px", color: "text-brand-sidebar", rotate: 6, dir: "ltr" },
  { type: "icon", content: "📘", top: "78%", side: "left", offset: "20px", size: "20px", color: "", rotate: 6 },
  { type: "word", content: "تعلّم", top: "79%", side: "left", offset: "100px", size: "13px", color: "text-brand-primary", rotate: -5 },
  { type: "icon", content: "📓", top: "78%", side: "right", offset: "26px", size: "19px", color: "", rotate: 10 },
  { type: "word", content: "Exam", top: "81%", side: "right", offset: "130px", size: "12px", color: "text-brand-sidebar", rotate: 7, dir: "ltr" },
  { type: "icon", content: "✏️", top: "83%", side: "left", offset: "180px", size: "15px", color: "", rotate: -24 },
  { type: "word", content: "امتحان", top: "84%", side: "left", offset: "30px", size: "13px", color: "text-brand-gold", rotate: 4 },
];

export function LoginBackdrop() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      {ITEMS.map((item, i) => (
        <span
          key={i}
          className={`absolute font-bold opacity-[0.16] ${item.color}`}
          style={{
            top: item.top,
            [item.side]: item.offset,
            fontSize: item.size,
            transform: `rotate(${item.rotate}deg)`,
          }}
          dir={item.dir}
        >
          {item.content}
        </span>
      ))}
    </div>
  );
}
