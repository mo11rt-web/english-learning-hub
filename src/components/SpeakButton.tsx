"use client";

import { useState } from "react";
import { speak, isSpeechSupported, Accent } from "@/lib/speech";
import clsx from "clsx";

export function SpeakButton({
  text,
  size = "md",
}: {
  text: string;
  size?: "sm" | "md" | "lg";
}) {
  const [accent, setAccent] = useState<Accent>("en-US");
  const [playing, setPlaying] = useState(false);

  const handleSpeak = (rate = 1) => {
    if (!isSpeechSupported()) return;
    setPlaying(true);
    speak(text, { accent, rate });
    // تقدير بسيط لإنهاء حالة "التشغيل" (Web Speech لا يوفر onend موثوق دائمًا عبر كل المتصفحات)
    setTimeout(() => setPlaying(false), Math.max(1200, text.length * 90));
  };

  const sizes = { sm: "w-8 h-8 text-sm", md: "w-11 h-11 text-lg", lg: "w-14 h-14 text-xl" };

  return (
    <div className="flex items-center gap-2" dir="ltr">
      <button
        type="button"
        onClick={() => handleSpeak(1)}
        aria-label="استماع"
        className={clsx(
          sizes[size],
          "rounded-full bg-brand-primary text-white flex items-center justify-center",
          "hover:bg-brand-secondary transition-all shadow-md active:scale-95",
          playing && "animate-pulse"
        )}
      >
        🔊
      </button>
      <button
        type="button"
        onClick={() => handleSpeak(0.6)}
        aria-label="استماع ببطء"
        className="w-8 h-8 rounded-full bg-brand-primary/15 text-brand-primary text-xs flex items-center justify-center hover:bg-brand-primary/25"
        title="نطق بطيء"
      >
        🐢
      </button>
      <select
        value={accent}
        onChange={(e) => setAccent(e.target.value as Accent)}
        className="text-xs bg-transparent border border-brand-primary/30 rounded-lg px-1.5 py-1 text-brand-text"
      >
        <option value="en-US">🇺🇸 US</option>
        <option value="en-GB">🇬🇧 UK</option>
      </select>
    </div>
  );
}
