"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal, Toast } from "@/components/ui/Modal";
import {
  listenCollection, createDoc, updateDocById, deleteDocById, orderBy,
} from "@/lib/firestore-helpers";
import { Assignment, Question, Group, QuestionType } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { notifyUsers, getStudentUidsForStage } from "@/lib/notifications";
import { matchesStudentGroups } from "@/lib/groupTargeting";

const qTypeLabels: Record<QuestionType, string> = {
  mcq: "اختيار من متعدد", "true-false": "صح أو خطأ", "fill-blank": "إكمال الفراغ",
  matching: "مطابقة", reorder: "ترتيب", "short-answer": "إجابة قصيرة", essay: "مقالي",
};

const assignmentTypeLabels: Record<string, string> = {
  practice: "تمرين غير محسوب",
  homework: "واجب منزلي",
  quiz: "اختبار قصير",
  exam: "امتحان",
};

export default function AssignmentsPage() {
  const { user } = useAuth();
  const { stageId: workspaceStageId, stageName: workspaceStageName } = useWorkspace();
  const [questions, setQuestions] = useState<(Question & { id: string })[]>([]);
  const [assignments, setAssignments] = useState<(Assignment & { id: string })[]>([]);
  const [groups, setGroups] = useState<(Group & { id: string })[]>([]);

  const [aForm, setAForm] = useState({
    title: "", type: "homework" as Assignment["type"],
    targetGroupId: "", durationMinutes: 30, selectedQ: new Set<string>(),
  });
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<(Assignment & { id: string }) | null>(null);
  const [editForm, setEditForm] = useState({ title: "", type: "homework" as Assignment["type"], targetGroupId: "", selectedQ: new Set<string>() });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const u1 = listenCollection<Question>("question_bank", [orderBy("createdAt", "desc")], setQuestions);
    const u2 = listenCollection<Assignment>("assignments", [orderBy("createdAt", "desc")], setAssignments);
    const u3 = listenCollection<Group>("groups", [], setGroups);
    return () => { u1(); u2(); u3(); };
  }, []);

  const groupsInWorkspace = groups.filter((g) => g.stageId === workspaceStageId);
  const groupIdsInWorkspace = new Set(groupsInWorkspace.map((g) => g.id));
  const questionsInWorkspace = questions.filter((q) => q.stageId === workspaceStageId);
  const assignmentsInWorkspace = assignments.filter((a) =>
    matchesStudentGroups(a.targetGroupIds, Array.from(groupIdsInWorkspace))
  );

  const toggleQ = (id: string) => {
    const s = new Set(aForm.selectedQ);
    s.has(id) ? s.delete(id) : s.add(id);
    setAForm({ ...aForm, selectedQ: s });
  };

  const openEditAssignment = (assignment: Assignment & { id: string }) => {
    setEditingAssignment(assignment);
    setEditForm({
      title: assignment.title ?? "",
      type: assignment.type ?? "homework",
      targetGroupId: assignment.targetGroupIds?.[0] ?? "",
      selectedQ: new Set(assignment.questionIds ?? []),
    });
    setAssignmentMessage(null);
  };

  const toggleEditQuestion = (id: string) => {
    setEditForm((previous) => {
      const selectedQ = new Set(previous.selectedQ);
      selectedQ.has(id) ? selectedQ.delete(id) : selectedQ.add(id);
      return { ...previous, selectedQ };
    });
  };

  const saveEditAssignment = async () => {
    if (!editingAssignment || savingEdit) return;
    const title = editForm.title.trim();
    const questionIds = Array.from(editForm.selectedQ);
    if (!title || questionIds.length === 0) {
      setAssignmentMessage({ text: "أدخل عنوان الواجب واختر سؤالًا واحدًا على الأقل.", type: "error" });
      return;
    }
    setSavingEdit(true);
    try {
      await updateDocById("assignments", editingAssignment.id, {
        title,
        type: editForm.type,
        targetGroupIds: editForm.targetGroupId ? [editForm.targetGroupId] : [],
        questionIds,
        updatedAt: Date.now(),
      });
      setEditingAssignment(null);
      setAssignmentMessage({ text: "تم تعديل الواجب بنجاح.", type: "success" });
    } catch (error) {
      console.error("[edit-assignment] error", error);
      setAssignmentMessage({ text: "تعذر تعديل الواجب. تحقق من الاتصال والصلاحيات.", type: "error" });
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteAssignment = async (assignment: Assignment & { id: string }) => {
    if (!window.confirm(`هل تريد حذف الواجب «${assignment.title}»؟ لن يتم حذف الأسئلة من بنك الأسئلة.`)) return;
    try {
      await deleteDocById("assignments", assignment.id);
      if (editingAssignment?.id === assignment.id) setEditingAssignment(null);
      setAssignmentMessage({ text: "تم حذف الواجب بنجاح.", type: "success" });
    } catch (error) {
      console.error("[delete-assignment] error", error);
      setAssignmentMessage({ text: "تعذر حذف الواجب. تحقق من الاتصال والصلاحيات.", type: "error" });
    }
  };

  const openPreviewModal = () => {
    const title = aForm.title.trim();
    const selectedQuestionIds = Array.from(aForm.selectedQ);
    if (!title || selectedQuestionIds.length === 0 || !user || !workspaceStageId) {
      setAssignmentMessage({ text: "أدخل عنوان الواجب واختر سؤالًا واحدًا على الأقل.", type: "error" });
      return;
    }
    setAssignmentMessage(null);
    setShowPreviewModal(true);
  };

  const createAssignment = async () => {
    const title = aForm.title.trim();
    const selectedQuestionIds = Array.from(aForm.selectedQ);
    if (!title || selectedQuestionIds.length === 0 || !user || !workspaceStageId || creatingAssignment) {
      setAssignmentMessage({ text: "أدخل عنوان الواجب واختر سؤالًا واحدًا على الأقل.", type: "error" });
      return;
    }

    const assignmentType = aForm.type;
    const targetGroups = aForm.targetGroupId ? [aForm.targetGroupId] : [];
    setCreatingAssignment(true);
    setAssignmentMessage(null);
    try {
      await createDoc("assignments", {
        title,
        type: assignmentType,
        stageId: workspaceStageId,
        targetGroupIds: targetGroups,
        lessonIds: [],
        questionIds: selectedQuestionIds,
        durationMinutes: aForm.durationMinutes,
        maxAttempts: 1,
        passingScore: 60,
        showScoreImmediately: false,
        showCorrectAnswers: false,
        shuffleQuestions: true,
        status: "published",
        createdBy: user.uid,
        createdAt: Date.now(),
      });

      setShowPreviewModal(false);
      setAForm({ title: "", type: "homework", targetGroupId: "", durationMinutes: 30, selectedQ: new Set() });
      setAssignmentMessage({ text: "تم نشر الواجب بنجاح ويمكنك إضافة واجب آخر الآن.", type: "success" });

      try {
        const studentUids = await getStudentUidsForStage(workspaceStageId, targetGroups);
        await notifyUsers(studentUids, {
          title: assignmentType === "exam" ? "اختبار جديد" : "واجب جديد",
          body: title,
          type: assignmentType === "exam" ? "new-exam" : "new-exercise",
          link: "/student/assignments",
        });
      } catch (notificationError) {
        console.error("[create-assignment] notification error:", notificationError);
      }
    } catch (error) {
      console.error("[create-assignment] error:", error);
      setAssignmentMessage({ text: "تعذر نشر الواجب. تحقق من الاتصال والصلاحيات ثم حاول مجددًا.", type: "error" });
    } finally {
      setCreatingAssignment(false);
    }
  };

  return (
    <AppShell requireRole="teacher">
      <PageHeader icon="📝" title="الواجبات والاختبارات" />

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <GlassCard>
          <h2 className="font-bold text-brand-text mb-2">بنك الأسئلة الاحترافي</h2>
          <p className="text-sm text-brand-textMuted leading-7 mb-4">تم نقل إنشاء الأسئلة إلى صفحة مستقلة فيها شرح لكل نوع: اختيار من متعدد، صح أو خطأ، إكمال الفراغ بأربعة خيارات، ترتيب، مطابقة، وإجابات تحتاج مراجعة الأستاذ.</p>
          <Link href="/questions"><Button>فتح بنك الأسئلة وإضافة سؤال</Button></Link>
          <p className="text-xs text-brand-textMuted mt-3">الأسئلة الجاهزة في هذا القسم: {questionsInWorkspace.length}</p>
        </GlassCard>

        <GlassCard>
          <h2 className="font-bold text-brand-text mb-4">إنشاء واجب / اختبار</h2>
          <div className="flex flex-col gap-3 mb-3">
            <input placeholder="عنوان الواجب" value={aForm.title}
              onChange={(e) => setAForm({ ...aForm, title: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
            <select value={aForm.type}
              onChange={(e) => setAForm({ ...aForm, type: e.target.value as any })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70">
              <option value="practice">تمرين غير محسوب</option>
              <option value="homework">واجب منزلي</option>
              <option value="quiz">اختبار قصير</option>
              <option value="exam">امتحان</option>
            </select>
            <div>
              <label className="text-xs text-brand-textMuted block mb-1">مدة الاختبار (بالدقائق)</label>
              <input type="number" min={5} max={180} value={aForm.durationMinutes}
                onChange={(e) => setAForm({ ...aForm, durationMinutes: Number(e.target.value) || 30 })}
                className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
            </div>
            <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-2xl p-3 text-xs text-brand-textMuted leading-relaxed">
              💡 <strong>آلية الاختبار:</strong> سيتم توزيع العلامات بالتساوي على الأسئلة المختارة (أو يدوياً). يُسمح للطالب بالدخول لمرة واحدة فقط وحفظ إجاباته عند الخروج. لا يرى الطالب الإجابات الصحيحة أثناء الحل، وتتم مراجعة الأسئلة الكتابية قبل اعتماد النتيجة وإرسالها.
            </div>
            <select value={aForm.targetGroupId}
              onChange={(e) => setAForm({ ...aForm, targetGroupId: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70">
              <option value="">كل مجموعات "{workspaceStageName}"</option>
              {groupsInWorkspace.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <p className="text-sm text-brand-textMuted mb-2">اختر الأسئلة ({aForm.selectedQ.size}):</p>
          <div className="max-h-48 overflow-y-auto flex flex-col gap-1 mb-3">
            {questionsInWorkspace.map((q) => (
              <label key={q.id} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg bg-surface/50">
                <input type="checkbox" checked={aForm.selectedQ.has(q.id)} onChange={() => toggleQ(q.id)} />
                <span className="text-brand-text truncate">{q.text}</span>
              </label>
            ))}
            {questionsInWorkspace.length === 0 && <p className="text-xs text-brand-textMuted">أضف أسئلة أولًا.</p>}
          </div>
          {assignmentMessage && (
            <p className={`text-xs mb-2 ${assignmentMessage.type === "success" ? "text-brand-success" : "text-brand-error"}`}>
              {assignmentMessage.text}
            </p>
          )}
          <Button onClick={openPreviewModal} disabled={creatingAssignment}>
            معاينة ونشر الواجب
          </Button>

          <Modal open={showPreviewModal} onClose={() => setShowPreviewModal(false)} title="معاينة الاختبار / الواجب (منظور الطالب)">
            <div className="flex flex-col gap-4 text-brand-text">
              <div className="bg-brand-primary/10 rounded-xl p-4">
                <h3 className="font-bold text-lg mb-1">{aForm.title}</h3>
                <p className="text-xs text-brand-textMuted">النوع: {assignmentTypeLabels[aForm.type] ?? aForm.type} · المدة: {aForm.durationMinutes} دقيقة · عدد الأسئلة: {aForm.selectedQ.size}</p>
              </div>

              <div className="bg-surface/60 rounded-xl p-3 border border-brand-primary/25">
                <h4 className="font-bold text-sm text-brand-primary mb-1">📋 سلم التصحيح والعلامات:</h4>
                <p className="text-xs text-brand-textMuted">توزع الدرجات تلقائياً على الأسئلة المختارة بالتساوي. لا تظهر الإجابات الصحيحة للطالب أثناء الحل.</p>
              </div>

              <div className="max-h-60 overflow-y-auto flex flex-col gap-3">
                {Array.from(aForm.selectedQ).map((qId, index) => {
                  const q = questions.find((item) => item.id === qId);
                  if (!q) return null;
                  return (
                    <div key={qId} className="bg-surface/80 border border-brand-primary/15 rounded-xl p-3">
                      <p className="text-sm font-medium mb-2">{index + 1}. {q.text} <span className="text-xs text-brand-textMuted">({q.points ?? 1} درجة)</span></p>
                      {q.type === "mcq" && (
                        <div className="grid gap-1.5 pl-4">
                          {(q.options ?? []).map((opt, i) => (
                            <div key={i} className="text-xs px-3 py-2 rounded-lg bg-surface border border-brand-primary/10">○ {opt}</div>
                          ))}
                        </div>
                      )}
                      {q.type === "true-false" && (
                        <div className="flex gap-3 text-xs">
                          <span className="px-3 py-1.5 rounded-lg bg-surface border">○ صح</span>
                          <span className="px-3 py-1.5 rounded-lg bg-surface border">○ خطأ</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-brand-primary/15">
                <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>إلغاء وتعديل</Button>
                <Button onClick={createAssignment} disabled={creatingAssignment}>
                  {creatingAssignment ? "جارٍ النشر..." : "تأكيد النشر والإرسال للطلاب"}
                </Button>
              </div>
            </div>
          </Modal>
        </GlassCard>
      </div>

      {editingAssignment && (
        <GlassCard className="mb-8 border-2 border-brand-primary/20">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-bold text-brand-text">تعديل الواجب: {editingAssignment.title}</h2>
            <button type="button" onClick={() => setEditingAssignment(null)} className="text-sm text-brand-textMuted">إلغاء</button>
          </div>
          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="عنوان الواجب" className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text" />
            <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value as Assignment["type"] })} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text">
              <option value="practice">تمرين غير محسوب</option>
              <option value="homework">واجب منزلي</option>
              <option value="quiz">اختبار قصير</option>
              <option value="exam">امتحان</option>
            </select>
            <select value={editForm.targetGroupId} onChange={(e) => setEditForm({ ...editForm, targetGroupId: e.target.value })} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text">
              <option value="">كل مجموعات "{workspaceStageName}"</option>
              {groupsInWorkspace.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </div>
          <p className="text-sm text-brand-textMuted mb-2">الأسئلة المختارة: {editForm.selectedQ.size}</p>
          <div className="max-h-56 overflow-y-auto grid md:grid-cols-2 gap-2 mb-4">
            {questionsInWorkspace.map((question) => (
              <label key={question.id} className="flex items-center gap-2 text-sm px-2 py-2 rounded-lg bg-surface/50 text-brand-text">
                <input type="checkbox" checked={editForm.selectedQ.has(question.id)} onChange={() => toggleEditQuestion(question.id)} />
                <span className="truncate">{question.text}</span>
              </label>
            ))}
          </div>
          <Button onClick={saveEditAssignment} disabled={savingEdit}>{savingEdit ? "جارٍ الحفظ..." : "حفظ تعديلات الواجب"}</Button>
        </GlassCard>
      )}

      <h2 className="font-bold text-brand-text mb-4">واجبات "{workspaceStageName ?? "—"}"</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 pb-36">
        {assignmentsInWorkspace.map((assignment) => (
          <GlassCard key={assignment.id}>
            <h3 className="font-bold text-brand-text mb-1">{assignment.title}</h3>
            <p className="text-xs text-brand-textMuted mb-3">{assignment.questionIds?.length ?? 0} سؤال · {assignment.status === "published" ? "منشور" : "مسودة"}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/assignments/${assignment.id}/grade`} className="text-brand-primary text-sm">مراجعة الإجابات ↗</Link>
              <button type="button" onClick={() => openEditAssignment(assignment)} className="text-brand-textMuted text-sm">تعديل</button>
              <button type="button" onClick={() => deleteAssignment(assignment)} className="text-brand-error text-sm">حذف</button>
            </div>
          </GlassCard>
        ))}
        {assignmentsInWorkspace.length === 0 && <p className="text-brand-textMuted">لا توجد واجبات بهذا القسم بعد.</p>}
      </div>
    </AppShell>
  );
}
