type IdLike = string | { id?: unknown; questionId?: unknown; path?: unknown };

function asId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  const item = value as { questionId?: unknown; id?: unknown; path?: unknown };
  if (typeof item.questionId === "string" && item.questionId.trim()) return item.questionId.trim();
  if (typeof item.id === "string" && item.id.trim()) return item.id.trim();
  if (typeof item.path === "string" && item.path.trim()) return item.path.trim().split("/").filter(Boolean).pop() ?? null;
  return null;
}

/**
 * يقرأ أسماء الحقول المستخدمة في إصدارات English Hub السابقة والجديدة.
 * المصدر المعتمد حاليًا هو questionIds، لكن دعم الصيغ القديمة يمنع ظهور واجب
 * منشور بلا أسئلة بعد تحديث التطبيق.
 */
export function getAssignmentQuestionIds(assignment: Record<string, unknown>): string[] {
  const sources = [
    assignment.questionIds,
    assignment.selectedQuestionIds,
    assignment.questionsIds,
    assignment.questions,
  ];
  const ids: string[] = [];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const value of source) {
      const id = asId(value);
      if (id && !ids.includes(id)) ids.push(id);
    }
    if (ids.length > 0) break;
  }
  return ids;
}
