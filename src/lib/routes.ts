/**
 * src/lib/routes.ts
 * ------------------------------------------------------------------
 * بسبب output:"export" (Capacitor)، لا يقدر Next.js يولّد صفحة HTML/RSC
 * لكل lessonId/unitId/... حقيقي موجود بقاعدة البيانات (المحتوى ديناميكي
 * وبينزاد باستمرار من المعلمين). الحل: كل route ديناميكي بينبني بصفحة
 * ثابتة وحيدة باسم "static" وقت البناء (generateStaticParams -> dummy id)،
 * والـ id الحقيقي بينمرّر عبر query string (?id=...) وليس عبر الـ path —
 * لأن query string ما بيحتاج توليد ثابت مسبق، بعكس الـ path segments.
 *
 * كل مكان بالتطبيق كان يبني رابط زي `/lessons/${id}` لازم يستخدم الدوال
 * هون بدلاً من بناء الـ string يدوياً، حتى يبقى التنقل شغّال جوّا التطبيق.
 * ------------------------------------------------------------------
 */
import { getBaseUrl } from "@/lib/runtimeConfig";

export function lessonHref(lessonId: string): string {
  return `/lessons/static?id=${encodeURIComponent(lessonId)}`;
}

export function studentLessonHref(lessonId: string): string {
  return `/student/lessons/static?id=${encodeURIComponent(lessonId)}`;
}

export function unitHref(unitId: string): string {
  return `/units/static?id=${encodeURIComponent(unitId)}`;
}

export function assignmentGradeHref(assignmentId: string): string {
  return `/assignments/static/grade?id=${encodeURIComponent(assignmentId)}`;
}

export function studentAssignmentHref(assignmentId: string): string {
  return `/student/assignments/static?id=${encodeURIComponent(assignmentId)}`;
}

/**
 * رابط مشاركة النتائج (share/[token]) مقصود للعرض من خارج التطبيق
 * (إرساله بواتساب لشخص ما عنده التطبيق أصلاً) — لذلك دائماً رابط الويب
 * الحقيقي (Vercel) وليس مسار محلي جوّا الـ APK.
 */
export function shareResultUrl(token: string): string {
  const base = getBaseUrl();
  return `${base}/share/${encodeURIComponent(token)}`;
}

/** نفس فكرة shareResultUrl لكن كمسار محلي (لو حداً بدو يفتحها من جوّا التطبيق نفسه) */
export function shareHref(token: string): string {
  return `/share/static?id=${encodeURIComponent(token)}`;
}

type LinkPattern = [RegExp, (id: string) => string];

// هاي الأنماط بتغطي كل صيغ الروابط اللي ممكن تنكتب بحقل notification.link
// (اللي ينكتب أحياناً من المشروع الرئيسي بالويب بصيغته العادية القديمة زي
// `/lessons/abc123`)، وبتحوّلها لصيغة static?id= المفهومة جوّا تطبيق أندرويد.
const LINK_PATTERNS: LinkPattern[] = [
  [/^\/student\/lessons\/([^/?]+)\/?$/, studentLessonHref],
  [/^\/lessons\/([^/?]+)\/?$/, lessonHref],
  [/^\/student\/assignments\/([^/?]+)\/?$/, studentAssignmentHref],
  [/^\/assignments\/([^/?]+)\/grade\/?$/, assignmentGradeHref],
  [/^\/units\/([^/?]+)\/?$/, unitHref],
  [/^\/share\/([^/?]+)\/?$/, shareHref],
];

/**
 * يحوّل أي مسار خام مخزّن بـ Firestore (notification.link مثلاً) لصيغة
 * static?id= الصحيحة جوّا تطبيق أندرويد. أي مسار ثابت أصلاً (غير ديناميكي،
 * متل /dashboard أو /student/inquiries?...) يرجع كما هو بدون تغيير.
 */
export function resolveInternalLink(rawPath: string): string {
  if (!rawPath) return rawPath;
  for (const [pattern, build] of LINK_PATTERNS) {
    const match = rawPath.match(pattern);
    if (match) return build(match[1]);
  }
  return rawPath;
}
