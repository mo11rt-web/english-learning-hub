import { Question } from "@/lib/types";

const OBJECTIVE_TYPES: Question["type"][] = [
  "mcq",
  "true-false",
  "fill-blank",
  "matching",
  "reorder",
];

export function isAutoGradable(q: Question) {
  return q.autoGrade !== false && OBJECTIVE_TYPES.includes(q.type);
}

function normalize(v: string) {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isAnswerCorrect(
  question: Question,
  answer: string | string[] | undefined
): boolean {
  if (answer === undefined) return false;
  const correct = question.correctAnswer;

  if (Array.isArray(correct)) {
    const given = Array.isArray(answer) ? answer : [answer];
    if (given.length !== correct.length) return false;
    return correct.every((c, i) => normalize(String(c)) === normalize(String(given[i] ?? "")));
  }

  const given = Array.isArray(answer) ? answer[0] ?? "" : answer;
  return normalize(String(correct)) === normalize(String(given));
}

export function computeAutoScore(
  questions: Question[],
  answers: Record<string, string | string[]>
): { autoScore: number; maxScore: number; needsManualGrading: boolean } {
  let autoScore = 0;
  let maxScore = 0;
  let needsManualGrading = false;

  for (const q of questions) {
    maxScore += q.points;
    if (isAutoGradable(q)) {
      if (isAnswerCorrect(q, answers[q.id])) autoScore += q.points;
    } else {
      needsManualGrading = true;
    }
  }

  return { autoScore, maxScore, needsManualGrading };
}
