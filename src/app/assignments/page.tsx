"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  listenCollection, createDoc, orderBy,
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

export default function AssignmentsPage() {
  const { user } = useAuth();
  const { stageId: workspaceStageId, stageName: workspaceStageName } = useWorkspace();
  const [questions, setQuestions] = useState<(Question & { id: string })[]>([]);
  const [assignments, setAssignments] = useState<(Assignment & { id: string })[]>([]);
  const [groups, setGroups] = useState<(Group & { id: string })[]>([]);

  const [qForm, setQForm] = useState({
    text: "", type: "mcq" as QuestionType,
    options: "", correctAnswer: "", points: 1,
  });

  const [aForm, setAForm] = useState({
    title: "", type: "homework" as Assignment["type"],
    targetGroupId: "", selectedQ: new Set<string>(),
  });
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

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

  const addQuestion = async () => {
    if (!qForm.text.trim() || !user || !workspaceStageId) return;
    await createDoc("question_bank", {
      text: qForm.text,
      type: qForm.type,
      options: qForm.type === "mcq" ? qForm.options.split("،").map((s) => s.trim()).filter(Boolean) : [],
      correctAnswer: qForm.correctAnswer,
      points: qForm.points,
      difficulty: "medium",
      stageId: workspaceStageId,
      autoGrade: qForm.type !== "essay" && qForm.type !== "short-answer",
      createdBy: user.uid,
      createdAt: Date.now(),
    });
    setQForm({ text: "", type: "mcq", options: "", correctAnswer: "", points: 1 });
  };

  const toggleQ = (id: string) => {
    const s = new Set(aForm.selectedQ);
    s.has(id) ? s.delete(id) : s.add(id);
    setAForm({ ...aForm, selectedQ: s });
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
        targetGroupIds: targetGroups,
        lessonIds: [],
        questionIds: selectedQuestionIds,
        maxAttempts: 1,
        passingScore: 60,
        showScoreImmediately: true,
        showCorrectAnswers: false,
        shuffleQuestions: true,
        status: "published",
        createdBy: user.uid,
        createdAt: Date.now(),
      });

      // نفرغ النموذج فور نجاح إنشاء المستند، قبل إرسال الإشعارات؛ لأن فشل
      // الإشعار سابقًا كان يترك البيانات القديمة في النموذج ويؤدي إلى إنشاء
      // نفس الواجب مرة ثانية عند الضغط مجددًا.
      setAForm({ title: "", type: "homework", targetGroupId: "", selectedQ: new Set() });
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
          <h2 className="font-bold text-brand-text mb-4">بنك الأسئلة — إضافة سؤال</h2>
          <div className="flex flex-col gap-3">
            <textarea placeholder="نص السؤال" value={qForm.text}
              onChange={(e) => setQForm({ ...qForm, text: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" rows={2} />
            <select value={qForm.type}
              onChange={(e) => setQForm({ ...qForm, type: e.target.value as QuestionType })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70">
              {(Object.keys(qTypeLabels) as QuestionType[]).map((t) => (
                <option key={t} value={t}>{qTypeLabels[t]}</option>
              ))}
            </select>
            {qForm.type === "mcq" && (
              <input placeholder="الخيارات مفصولة بفاصلة عربية (،)" value={qForm.options}
                onChange={(e) => setQForm({ ...qForm, options: e.target.value })}
                className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
            )}
            {qForm.type === "true-false" ? (
              <select value={qForm.correctAnswer || "true"}
                onChange={(e) => setQForm({ ...qForm, correctAnswer: e.target.value })}
                className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70">
                <option value="true">صح</option>
                <option value="false">خطأ</option>
              </select>
            ) : (
              <input placeholder="الإجابة الصحيحة" value={qForm.correctAnswer}
                onChange={(e) => setQForm({ ...qForm, correctAnswer: e.target.value })}
                className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
            )}
            <input type="number" min={1} placeholder="الدرجة" value={qForm.points}
              onChange={(e) => setQForm({ ...qForm, points: Number(e.target.value) })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
            <Button onClick={addQuestion}>إضافة السؤال للبنك</Button>
          </div>
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
          <Button onClick={createAssignment} disabled={creatingAssignment}>
            {creatingAssignment ? "جارٍ النشر..." : "نشر الواجب"}
          </Button>
        </GlassCard>
      </div>

      <h2 className="font-bold text-brand-text mb-4">واجبات "{workspaceStageName ?? "—"}"</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignmentsInWorkspace.map((a) => (
          <GlassCard key={a.id}>
            <h3 className="font-bold text-brand-text mb-1">{a.title}</h3>
            <p className="text-xs text-brand-textMuted mb-3">
              {a.questionIds.length} سؤال
            </p>
            <Link href={`/assignments/${a.id}/grade`} className="text-brand-primary text-sm">
              مراجعة الإجابات والتصحيح ↗
            </Link>
          </GlassCard>
        ))}
        {assignmentsInWorkspace.length === 0 && <p className="text-brand-textMuted">لا توجد واجبات بهذا القسم بعد.</p>}
      </div>
    </AppShell>
  );
}
