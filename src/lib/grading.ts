import type { AttemptQuestionResult, Question } from "@/lib/types";

const OBJECTIVE_TYPES: Question["type"][] = [
  "mcq",
  "true-false",
  "fill-blank",
  "matching",
  "reorder",
];

export function isAutoGradable(q: Question) {
  if (q.manualReview === true || q.autoGrade === false) return false;
  if (OBJECTIVE_TYPES.includes(q.type)) return Boolean(q.correctAnswer !== undefined);
  return q.type === "short-answer" && Boolean(q.acceptedAnswers?.length || q.correctAnswer !== undefined);
}

function normalize(v: string) {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isAnswerCorrect(
  question: Question,
  answer: string | string[] | undefined
): boolean {
  if (answer === undefined) return false;
  const correct = question.acceptedAnswers?.length ? question.acceptedAnswers : question.correctAnswer;
  if (correct === undefined) return false;

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
): {
  autoScore: number;
  maxScore: number;
  needsManualGrading: boolean;
  questionResults: Record<string, AttemptQuestionResult>;
} {
  let autoScore = 0;
  let maxScore = 0;
  let needsManualGrading = false;
  const questionResults: Record<string, AttemptQuestionResult> = {};

  for (const q of questions) {
    const max = Math.max(0, Number(q.points) || 0);
    maxScore += max;
    const autoGraded = isAutoGradable(q);
    if (autoGraded) {
      const isCorrect = isAnswerCorrect(q, answers[q.id]);
      const score = isCorrect ? max : 0;
      autoScore += score;
      questionResults[q.id] = { score, maxScore: max, isCorrect, autoGraded: true };
    } else {
      needsManualGrading = true;
      questionResults[q.id] = { score: 0, maxScore: max, autoGraded: false };
    }
  }

  return { autoScore, maxScore, needsManualGrading, questionResults };
}
