export type UserRole = "admin" | "teacher" | "student";

export interface Profile {
  uid: string;
  fullName: string;
  role: UserRole;
  username?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  status: "active" | "disabled" | "deleted";
  points?: number;
  createdAt: number;
}

export interface StudentProfile extends Profile {
  role: "student";
  studentNumber: string;
  stageId: string;
  gradeId: string;
  sectionId?: string;
  groupIds: string[];
  address?: string;
  level?: "beginner" | "pre-intermediate" | "intermediate" | "upper-intermediate" | "advanced";
  guardianName?: string;
  guardianPhone?: string;
  mustChangePassword?: boolean;
  notes?: string;
  shareToken?: string;
}

export interface Stage {
  id: string;
  name: string;
  order: number;
}

export interface Group {
  id: string;
  name: string;
  stageId: string;
  teacherIds: string[];
  createdAt: number;
}

export interface Unit {
  id: string;
  title: string;
  titleEn?: string;
  description?: string;
  stageId: string;
  order: number;
  status: "draft" | "published";
  createdAt: number;
}

export type LessonBlockType =
  | "heading"
  | "subheading"
  | "paragraph-ar"
  | "paragraph-en"
  | "bilingual"
  | "note"
  | "alert"
  | "example"
  | "rule"
  | "image"
  | "pdf"
  | "audio"
  | "youtube"
  | "google-drive"
  | "book-page"
  | "vocabulary-word"
  | "vocabulary-list"
  | "quiz-question";

export interface LessonBlock {
  id: string;
  type: LessonBlockType;
  content: string; // نص أو JSON بحسب النوع
  order: number;
}

export interface LessonQuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  order: number;
}

export interface Lesson {
  id: string;
  title: string;
  titleEn?: string;
  description?: string;
  stageId: string;
  unitId: string;
  status: "draft" | "review" | "scheduled" | "published" | "archived";
  coverImageUrl?: string;
  estimatedMinutes?: number;
  order: number;
  targetGroupIds: string[]; // فارغ = كل المجموعات ضمن المرحلة
  blocks: LessonBlock[];
  quizQuestions?: LessonQuizQuestion[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
}

export type WordType =
  | "noun" | "verb" | "adjective" | "adverb" | "preposition"
  | "pronoun" | "conjunction" | "phrase" | "phrasal-verb" | "idiom";

export interface VocabularyItem {
  id: string;
  word: string;
  translation: string;
  wordType: WordType;
  ipa?: string;
  example?: string;
  exampleTranslation?: string;
  synonyms?: string[];
  antonyms?: string[];
  difficulty: "easy" | "medium" | "hard";
  stageId: string;
  unitId?: string;
  lessonId?: string;
  imageUrl?: string;
  teacherNotes?: string;
  tags?: string[];
  createdAt: number;
}

export interface FileAsset {
  id: string;
  name: string;
  description?: string;
  type: "pdf" | "image" | "audio" | "video" | "other";
  storagePath: string;
  sizeBytes: number;
  stageId?: string;
  unitId?: string;
  lessonId?: string;
  allowDownload: boolean;
  uploadedBy: string;
  uploadedAt: number;
}

export type QuestionType =
  | "mcq" | "true-false" | "fill-blank" | "matching" | "reorder"
  | "short-answer" | "essay";

export interface Question {
  id: string;
  text: string;
  instructions?: string;
  type: QuestionType;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  points: number;
  difficulty: "easy" | "medium" | "hard";
  stageId: string;
  unitId?: string;
  lessonId?: string;
  autoGrade: boolean;
  createdBy: string;
  createdAt: number;
}

export interface Assignment {
  id: string;
  title: string;
  description?: string;
  type: "practice" | "homework" | "quiz" | "exam";
  targetGroupIds: string[];
  lessonIds: string[];
  questionIds: string[];
  startAt?: number;
  dueAt?: number;
  durationMinutes?: number;
  maxAttempts: number;
  passingScore: number;
  showScoreImmediately: boolean;
  showCorrectAnswers: boolean;
  shuffleQuestions: boolean;
  status: "draft" | "published";
  createdBy: string;
  createdAt: number;
}

export interface Attempt {
  id: string;
  assignmentId: string;
  studentId: string;
  answers: Record<string, string | string[]>;
  autoScore: number;
  maxScore?: number;
  manualScore?: number;
  finalScore?: number;
  pointsAwarded?: boolean;
  status: "in-progress" | "submitted" | "graded";
  teacherFeedback?: string;
  startedAt: number;
  submittedAt?: number;
  gradedAt?: number;
}

export interface PastExamQuestion {
  id: string;
  year: number;
  subject: string;
  stageId: string;
  round: string; // الدورة: مثلاً "الدورة الأولى" أو "دورة 2025"
  questionText: string;
  imageUrl?: string;
  answerText: string;
  marks?: number;
  createdBy: string;
  createdAt: number;
}

export interface ShareSnapshot {
  id: string; // = token
  studentId: string;
  studentName: string;
  stageName: string;
  groupName: string;
  points: number;
  levelName: string;
  lessonsCompleted: number;
  lessonsTotal: number;
  completionPercentage: number;
  quizAveragePercentage?: number;
  rank?: number | null;
  totalInGroup?: number | null;
  quizResults: { title: string; score: number; maxScore: number; date: number }[];
  lastActivityAt?: number;
  enabled: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface IrregularVerb {
  id: string;
  base: string;
  pastSimple: string;
  pastParticiple: string;
  meaningAr: string;
  example?: string;
  stageId: string;
  level: "easy" | "medium" | "hard";
  active: boolean;
  createdBy: string;
  createdAt: number;
}

export interface Notification {
  id: string;
  userId: string; // uid المستلم
  title: string;
  body?: string;
  type:
    | "new-lesson"
    | "new-pdf"
    | "new-video"
    | "new-exercise"
    | "new-exam"
    | "announcement"
    | "submission" // للمعلم: طالب سلّم واجب
    | "alert" // للمعلم: تنبيه متابعة (مثلاً طالب رسب 3 مرات متتالية)
    | "system";
  link?: string; // رابط داخلي يفتح عند الضغط
  createdAt: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  targetGroupIds: string[]; // فارغ = الجميع
  createdBy: string;
  createdAt: number;
}
