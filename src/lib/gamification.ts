import { doc, getDoc, increment, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface PointsSettings {
  lessonComplete: number;
  quizComplete: number;
  examComplete: number;
  highScoreBonus: number; // يُمنح إذا كانت النسبة ≥ highScoreThreshold
  highScoreThreshold: number; // نسبة مئوية 0-100
}

export const DEFAULT_POINTS_SETTINGS: PointsSettings = {
  lessonComplete: 10,
  quizComplete: 20,
  examComplete: 30,
  highScoreBonus: 10,
  highScoreThreshold: 90,
};

let cachedSettings: PointsSettings | null = null;

// تُقرأ الإعدادات مرة واحدة وتُخزَّن مؤقتًا بالذاكرة لتقليل قراءات Firestore
export async function getPointsSettings(): Promise<PointsSettings> {
  if (cachedSettings) return cachedSettings;
  try {
    const snap = await getDoc(doc(db, "app_settings", "points"));
    cachedSettings = snap.exists()
      ? { ...DEFAULT_POINTS_SETTINGS, ...(snap.data() as Partial<PointsSettings>) }
      : DEFAULT_POINTS_SETTINGS;
  } catch {
    cachedSettings = DEFAULT_POINTS_SETTINGS;
  }
  return cachedSettings;
}

export async function savePointsSettings(settings: PointsSettings) {
  await setDoc(doc(db, "app_settings", "points"), settings, { merge: true });
  cachedSettings = settings;
}

// مستويات بسيطة مبنية على مجموع النقاط
export const LEVELS = [
  { name: "مبتدئ", minPoints: 0 },
  { name: "جيد", minPoints: 100 },
  { name: "جيد جدًا", minPoints: 300 },
  { name: "ممتاز", minPoints: 600 },
  { name: "متفوق", minPoints: 1000 },
];

export function computeLevel(points: number) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (points >= lvl.minPoints) current = lvl;
  }
  const currentIndex = LEVELS.indexOf(current);
  const next = LEVELS[currentIndex + 1] ?? null;
  const progressToNext = next
    ? Math.min(100, Math.round(((points - current.minPoints) / (next.minPoints - current.minPoints)) * 100))
    : 100;
  return { name: current.name, next: next?.name ?? null, nextAt: next?.minPoints ?? null, progressToNext };
}

// إضافة نقاط لملف الطالب بأمان (زيادة تراكمية عبر Firestore increment)
export async function awardPoints(studentUid: string, amount: number) {
  if (!amount) return;
  await updateDoc(doc(db, "profiles", studentUid), {
    points: increment(amount),
  });
}
