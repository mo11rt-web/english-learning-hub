// نمط "استهداف المجموعات" لأي محتوى ممكن يكون موجّه لمجموعة طلاب محدّدة
// أو للجميع (دروس حاليًا، ويصلح لاحقًا لأي كوليكشن مشابه).
//
// ليش هذا الملف موجود أصلًا؟ لأن Firestore ما بيقدر يتحقق من قاعدة أمان
// (security rule) فيها شرط غير موجود بنفس شكل الاستعلام (where) بالضبط.
// قبل هذا التعديل كان الدرس المفتوح للجميع يُخزَّن بمصفوفة فارغة
// targetGroupIds: []، وقاعدة الأمان كانت تسمح بالقراءة إذا كانت المصفوفة
// فاضية أو فيها مجموعة الطالب — لكن استعلام صفحة الطالب كان يجيب فقط
// stageId + status، بدون أي شرط على targetGroupIds. Firestore ما بيقدر
// يثبت مسبقًا أن كل نتيجة محتملة للاستعلام رح تحقق شرط القاعدة (لأنه ما
// إله علاقة بـ targetGroupIds أصلًا)، فكان يرفض الاستعلام بالكامل
// بخطأ "missing or insufficient permissions" — وهذا بالضبط سبب ظهور
// شاشة "لا توجد صلاحية كافية" و"لا توجد دروس منشورة بعد" مع أنه فعليًا
// ممكن يكون فيه دروس منشورة.
//
// الحل: بدل مصفوفة فاضية = "للجميع"، نخزّن قيمة مميزة (ALL_GROUPS_SENTINEL)
// داخل نفس المصفوفة، وبعدين نستعلم بـ array-contains-any تتضمن هذه القيمة
// + مجموعات الطالب. هيك الاستعلام نفسه يطابق شرط القاعدة تمامًا،
// و Firestore يقدر يتحقق منه بأمان وقت التنفيذ.
export const ALL_GROUPS_SENTINEL = "__all__";

/** يحوّل قائمة المجموعات المختارة بواجهة المعلم إلى الشكل المخزَّن فعليًا. */
export function toStoredTargetGroupIds(selectedGroupIds: string[]): string[] {
  return selectedGroupIds.length > 0 ? selectedGroupIds : [ALL_GROUPS_SENTINEL];
}

/**
 * القيمة اللي تُمرَّر لِـ where(..., "array-contains-any", ...) عند
 * استعلام الطالب — تشمل القيمة المميزة (الدروس المفتوحة للجميع) بالإضافة
 * لمجموعات الطالب نفسه. Firestore يسمح بحد أقصى 10 عناصر لهذا النوع من
 * الاستعلام، فنكتفي بأول 9 مجموعات + القيمة المميزة احتياطًا.
 */
export function queryTargetGroupIds(studentGroupIds: string[] = []): string[] {
  return [ALL_GROUPS_SENTINEL, ...studentGroupIds.slice(0, 9)];
}

/**
 * فحص إضافي من جهة العميل (دفاع مضاعف فوق الاستعلام نفسه) — يتعامل أيضًا
 * مع بيانات قديمة محتملة كانت تُخزَّن كمصفوفة فاضية قبل هذا التعديل.
 */
export function matchesStudentGroups(
  targetGroupIds: string[] | undefined,
  studentGroupIds: string[] = []
): boolean {
  const ids = targetGroupIds ?? [];
  if (ids.length === 0 || ids.includes(ALL_GROUPS_SENTINEL)) return true;
  return ids.some((g) => studentGroupIds.includes(g));
}
