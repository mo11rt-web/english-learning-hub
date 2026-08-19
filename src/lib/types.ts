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
  // تحكم بظهور طلاب هذه المجموعة تحديدًا بلوحة الصدارة العامة للفرع.
  // اختياري بالنوع فقط لتوافق المجموعات القديمة (تُعامل كـ true = ظاهرة).
  leaderboardEnabled?: boolean;
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

export interface MatchingPair {
  left: string;
  right: string;
}

export interface Question {
  id: string;
  text: string;
  instructions?: string;
  type: QuestionType;
  options?: string[];
  /** الخيارات الخاصة بسؤال إكمال الفراغ فقط. */
  blankOptions?: string[];
  /** عناصر سؤال الترتيب بالترتيب الصحيح. */
  reorderItems?: string[];
  /** أزواج سؤال المطابقة. */
  matchingPairs?: MatchingPair[];
  /** قد تكون الإجابة غائبة في الأسئلة التي يراجعها الأستاذ يدوياً. */
  correctAnswer?: string | string[];
  acceptedAnswers?: string[];
  explanation?: string;
  rubric?: string;
  points: number;
  difficulty: "easy" | "medium" | "hard";
  stageId: string;
  unitId?: string;
  lessonId?: string;
  autoGrade: boolean;
  manualReview?: boolean;
  createdBy: string;
  createdAt: number;
}

export interface Assignment {
  id: string;
  title: string;
  description?: string;
  type: "practice" | "homework" | "quiz" | "exam";
  // مطلوب لكل واجب جديد (لعزل الأقسام سيرفريًا بـ firestore.rules).
  // اختياري بالنوع فقط عشان توافق الواجبات القديمة المُنشأة قبل هذا الحقل.
  stageId?: string;
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
  questionMarks?: Record<string, number>; // علامة مخصصة لكل سؤال
  status: "draft" | "published";
  createdBy: string;
  createdAt: number;
}

export interface AttemptQuestionResult {
  score: number;
  maxScore: number;
  isCorrect?: boolean;
  autoGraded: boolean;
  reviewed?: boolean;
  teacherComment?: string;
}

export interface Attempt {
  id: string;
  assignmentId: string;
  studentId: string;
  answers: Record<string, string | string[]>;
  questionResults?: Record<string, AttemptQuestionResult>;
  autoScore: number;
  maxScore?: number;
  manualScore?: number;
  finalScore?: number;
  pointsAwarded?: boolean;
  needsManualGrading?: boolean;
  status: "in-progress" | "submitted" | "pending-review" | "graded";
  isResultSent?: boolean; // هل أرسل المعلم النتيجة النهائية للطالب
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

export type InquiryStatus = "new" | "viewed" | "answered" | "resolved";

export interface InquiryMessage {
  id: string;
  senderId: string;
  senderRole: "student" | "teacher" | "admin";
  senderName: string;
  body: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt: number;
}

export interface Inquiry {
  id: string;
  studentId: string;
  studentName: string;
  stageId: string;
  groupIds: string[];
  title: string;
  details: string;
  unitId?: string;
  lessonId?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  status: InquiryStatus;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
  lastMessageBy: "student" | "teacher" | "admin";
}

export interface Notification {
  userId: string; // uid المستلم
  title: string;
  body?: string;
  read?: boolean;
  type:
    | "new-lesson"
    | "new-pdf"
    | "new-video"
    | "new-exercise"
    | "new-exam"
    | "announcement"
    | "submission" // للمعلم: طالب سلّم واجب
    | "graded" // للطالب: اكتمل تصحيح الواجب
    | "inquiry-new"
    | "inquiry-reply"
    | "inquiry-resolved"
    | "system";
  link?: string; // رابط داخلي يفتح عند الضغط
  createdAt: number;
}

export type AnnouncementStatus = "draft" | "published" | "expired";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  targetGroupIds: string[]; // فارغ = الجميع
  stageId?: string;
  imageUrl?: string;
  linkUrl?: string;
  startAt?: number;
  endAt?: number;
  featured?: boolean;
  public?: boolean;
  status?: AnnouncementStatus;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
}

export type LeaderboardPeriod = "week" | "month" | "term" | "all";

export interface LeaderboardEntry {
  rank: number;
  studentName: string;
  groupName?: string;
  points: number;
}

export interface LeaderboardSettings {
  id?: string;
  stageId: string;
  enabled: boolean;
  limit: number;
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
  updatedAt: number;
  updatedBy: string;
}
