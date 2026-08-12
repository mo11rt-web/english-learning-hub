// طبقة نطق قابلة للاستبدال مستقبلًا بمزود سحابي (Audio Provider Interface)
// النسخة الحالية تستخدم Web Speech API المجاني في المتصفح.

export type Accent = "en-US" | "en-GB";

let currentUtterance: SpeechSynthesisUtterance | null = null;

function pickVoice(accent: Accent): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === accent) ||
    voices.find((v) => v.lang.startsWith(accent.split("-")[0]))
  );
}

export function speak(
  text: string,
  opts: { accent?: Accent; rate?: number } = {}
) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel(); // منع تشغيل عدة أصوات فوق بعضها

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = opts.accent ?? "en-US";
  utterance.rate = opts.rate ?? 1;
  const voice = pickVoice(opts.accent ?? "en-US");
  if (voice) utterance.voice = voice;

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  currentUtterance = null;
}

export function isSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
