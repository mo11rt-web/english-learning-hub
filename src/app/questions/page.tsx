"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { listenCollection, createDoc, deleteDocById, orderBy } from "@/lib/firestore-helpers";
import { Question, QuestionType, Stage, MatchingPair } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

const typeLabels: Record<QuestionType, string> = {
  mcq: "اختيار من متعدد",
  "true-false": "صح أو خطأ",
  "fill-blank": "إكمال الفراغ",
  matching: "مطابقة",
  reorder: "ترتيب",
  "short-answer": "إجابة قصيرة",
  essay: "سؤال مقالي",
};

const typeHelp: Record<QuestionType, string> = {
  mcq: "اكتب السؤال ثم أربعة خيارات على الأقل، وحدد الخيار الصحيح. سيظهر للطالب بشكل بطاقات اختيار واضحة.",
  "true-false": "اكتب عبارة واحدة واختر هل هي صحيحة أم خاطئة. يصححها النظام تلقائياً.",
  "fill-blank": "ضع _____ داخل نص السؤال مكان الفراغ، ثم أضف أربعة خيارات وحدد الكلمة الصحيحة.",
  matching: "اكتب كل زوج في سطر بالشكل: الكلمة أو العبارة الأولى => معناها أو مطابقتها.",
  reorder: "اكتب العبارات في الأسطر بالترتيب الصحيح؛ سيخلطها النظام للطالب ليعيد ترتيبها.",
  "short-answer": "اترك مفتاح الإجابة فارغاً إذا أردت مراجعة الأستاذ. ويمكن إضافة إجابات مقبولة للتصحيح التلقائي.",
  essay: "سؤال مفتوح بلا إجابة نموذجية؛ يكتب الطالب رده ويظهر للأستاذ في قائمة المراجعة اليدوية.",
};

type BuilderForm = {
  text: string;
  instructions: string;
  type: QuestionType;
  options: string[];
  correctAnswer: string;
  acceptedAnswers: string;
  reorderItems: string;
  matchingPairs: string;
  rubric: string;
  points: number;
  difficulty: Question["difficulty"];
};

function emptyForm(): BuilderForm {
  return {
    text: "",
    instructions: "",
    type: "mcq",
    options: ["", "", "", ""],
    correctAnswer: "",
    acceptedAnswers: "",
    reorderItems: "",
    matchingPairs: "",
    rubric: "",
    points: 1,
    difficulty: "medium",
  };
}

function splitLines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function splitOptions(value: string[]) {
  return value.map((item) => item.trim()).filter(Boolean);
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<(Question & { id: string })[]>([]);
  const [stages, setStages] = useState<(Stage & { id: string })[]>([]);
  const [form, setForm] = useState<BuilderForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const { user } = useAuth();
  const { stageId: workspaceStageId, stageName: workspaceStageName } = useWorkspace();

  useEffect(() => {
    const u1 = listenCollection<Question>("question_bank", [orderBy("createdAt", "desc")], setQuestions);
    const u2 = listenCollection<Stage>("stages", [orderBy("order")], setStages);
    return () => { u1(); u2(); };
  }, []);

  const updateForm = <K extends keyof BuilderForm>(key: K, value: BuilderForm[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const showValidationError = (text: string) => setMessage({ text, type: "error" });

  const addQuestion = async () => {
    if (!form.text.trim() || !workspaceStageId || !user || saving) {
      showValidationError(!form.text.trim() ? "يجب إدخال نص السؤال." : "يجب اختيار القسم الحالي قبل الحفظ.");
      return;
    }

    const options = splitOptions(form.options);
    const reorderItems = splitLines(form.reorderItems);
    const acceptedAnswers = splitLines(form.acceptedAnswers);
    const matchingPairs: MatchingPair[] = splitLines(form.matchingPairs)
      .map((line) => {
        const [left, ...rightParts] = line.split("=>");
        return { left: left?.trim() ?? "", right: rightParts.join("=>").trim() };
      })
      .filter((pair) => pair.left && pair.right);

    if (form.type === "mcq" && (options.length < 2 || !form.correctAnswer.trim())) {
      showValidationError("سؤال الاختيار من متعدد يحتاج خيارين على الأقل وتحديد الإجابة الصحيحة.");
      return;
    }
    if (form.type === "fill-blank" && (options.length !== 4 || !form.correctAnswer.trim())) {
      showValidationError("سؤال إكمال الفراغ يحتاج أربعة خيارات وتحديد الكلمة الصحيحة للفراغ.");
      return;
    }
    if (form.type === "reorder" && reorderItems.length < 2) {
      showValidationError("سؤال الترتيب يحتاج عبارتين على الأقل، كل عبارة في سطر مستقل.");
      return;
    }
    if (form.type === "matching" && matchingPairs.length < 2) {
      showValidationError("سؤال المطابقة يحتاج زوجين على الأقل بصيغة: العبارة الأولى => العبارة الثانية.");
      return;
    }

    const autoGrade = form.type === "mcq" || form.type === "true-false" || form.type === "fill-blank" || form.type === "matching" || form.type === "reorder" || (form.type === "short-answer" && acceptedAnswers.length > 0);
    const payload: Record<string, unknown> = {
      text: form.text.trim(),
      type: form.type,
      options: form.type === "mcq" ? options : [],
      blankOptions: form.type === "fill-blank" ? options : [],
      reorderItems: form.type === "reorder" ? reorderItems : [],
      matchingPairs: form.type === "matching" ? matchingPairs : [],
      points: Math.max(1, Number(form.points) || 1),
      difficulty: form.difficulty,
      stageId: workspaceStageId,
      autoGrade,
      manualReview: !autoGrade,
      createdBy: user.uid,
      createdAt: Date.now(),
    };

    if (form.type === "true-false") payload.correctAnswer = form.correctAnswer || "true";
    if (form.type === "mcq" || form.type === "fill-blank") payload.correctAnswer = form.correctAnswer.trim();
    if (form.type === "reorder") payload.correctAnswer = reorderItems;
    if (form.type === "matching") payload.correctAnswer = matchingPairs.map((pair) => pair.right);
    if (form.type === "short-answer" && acceptedAnswers.length > 0) {
      payload.acceptedAnswers = acceptedAnswers;
      payload.correctAnswer = acceptedAnswers[0];
    }

    if (form.instructions.trim()) payload.instructions = form.instructions.trim();
    if (form.rubric.trim()) payload.rubric = form.rubric.trim();

    setSaving(true);
    setMessage(null);
    try {
      const docRef = await createDoc("question_bank", payload);
      if (!docRef?.id) throw new Error("لم يُرجع Firestore معرّف السؤال بعد الحفظ.");
      setForm(emptyForm());
      setMessage({ text: "تمت إضافة السؤال إلى البنك بنجاح ✅ وسيظهر مباشرة في القائمة.", type: "success" });
    } catch (error) {
      console.error("[question-bank] create error", error);
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
      const reason = code.includes("permission-denied")
        ? "لا تملك صلاحية الكتابة في بنك الأسئلة. تأكد من تسجيل الدخول بحساب معلم ومن نشر firestore.rules المحدثة."
        : code.includes("unavailable") || code.includes("network")
          ? "تعذر الاتصال بـ Firestore حالياً. تحقق من الإنترنت ثم حاول مرة أخرى."
          : error instanceof Error && error.message.includes("undefined")
            ? "يوجد حقل اختياري غير صالح في البيانات. تم إصلاح المعالجة، أعد المحاولة."
            : error instanceof Error
              ? `فشل حفظ السؤال: ${error.message}`
              : "حدث خطأ غير متوقع أثناء حفظ السؤال.";
      setMessage({ text: reason, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const filtered = questions.filter((q) => q.stageId === workspaceStageId);
  const selectedType = form.type;

  return (
    <AppShell requireRole="teacher">
      <PageHeader icon="❓" title="بنك الأسئلة" />

      <GlassCard className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h2 className="font-bold text-brand-text">إنشاء سؤال احترافي</h2>
            <p className="text-xs text-brand-textMuted mt-1">اختر نوع السؤال؛ ستظهر الحقول المناسبة تلقائياً، ويمكنك ترك مفتاح الإجابة فارغاً للأسئلة التي تحتاج مراجعة الأستاذ.</p>
          </div>
          <span className="text-xs rounded-full bg-brand-primary/10 text-brand-primary px-3 py-1">{typeLabels[selectedType]}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <textarea placeholder="نص السؤال أو العبارة — في إكمال الفراغ استخدم _____" value={form.text} onChange={(e) => updateForm("text", e.target.value)} className="md:col-span-2 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text" rows={3} />
          <textarea placeholder="تعليمات للطالب (اختياري)" value={form.instructions} onChange={(e) => updateForm("instructions", e.target.value)} className="md:col-span-2 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text" rows={2} />
          <select value={form.type} onChange={(e) => updateForm("type", e.target.value as QuestionType)} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text">
            {(Object.keys(typeLabels) as QuestionType[]).map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
          </select>
          <div className="rounded-xl bg-brand-primary/5 border border-brand-primary/10 px-3 py-2 text-xs leading-6 text-brand-textMuted">{typeHelp[selectedType]}</div>

          {selectedType === "mcq" && (
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {form.options.map((option, index) => <input key={index} placeholder={`الخيار ${index + 1}`} value={option} onChange={(e) => { const options = form.options.slice(); options[index] = e.target.value; updateForm("options", options); }} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text" />)}
              <select value={form.correctAnswer} onChange={(e) => updateForm("correctAnswer", e.target.value)} className="sm:col-span-2 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text">
                <option value="">اختر الإجابة الصحيحة</option>
                {splitOptions(form.options).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          )}

          {selectedType === "true-false" && <select value={form.correctAnswer || "true"} onChange={(e) => updateForm("correctAnswer", e.target.value)} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text"><option value="true">صح</option><option value="false">خطأ</option></select>}

          {selectedType === "fill-blank" && (
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {form.options.map((option, index) => <input key={index} placeholder={`الخيار ${index + 1}`} value={option} onChange={(e) => { const options = form.options.slice(); options[index] = e.target.value; updateForm("options", options); }} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text" />)}
              <select value={form.correctAnswer} onChange={(e) => updateForm("correctAnswer", e.target.value)} className="sm:col-span-2 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text"><option value="">اختر الكلمة الصحيحة للفراغ</option>{splitOptions(form.options).map((option) => <option key={option} value={option}>{option}</option>)}</select>
            </div>
          )}

          {selectedType === "reorder" && <textarea placeholder="اكتب العبارات بالترتيب الصحيح، عبارة في كل سطر" value={form.reorderItems} onChange={(e) => updateForm("reorderItems", e.target.value)} className="md:col-span-2 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text" rows={5} />}
          {selectedType === "matching" && <textarea placeholder={'زوج في كل سطر، مثال:\ncat => قطة\ndog => كلب'} value={form.matchingPairs} onChange={(e) => updateForm("matchingPairs", e.target.value)} className="md:col-span-2 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text" rows={5} />}
          {selectedType === "short-answer" && <textarea placeholder="إجابات مقبولة للتصحيح التلقائي، إجابة في كل سطر — اتركه فارغاً للمراجعة اليدوية" value={form.acceptedAnswers} onChange={(e) => updateForm("acceptedAnswers", e.target.value)} className="md:col-span-2 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text" rows={3} />}
          {(selectedType === "essay" || selectedType === "short-answer") && <textarea placeholder="معايير التصحيح للأستاذ (اختياري)" value={form.rubric} onChange={(e) => updateForm("rubric", e.target.value)} className="md:col-span-2 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text" rows={2} />}

          <input type="number" min={1} placeholder="الدرجة" value={form.points} onChange={(e) => updateForm("points", Number(e.target.value))} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text" />
          <select value={form.difficulty} onChange={(e) => updateForm("difficulty", e.target.value as Question["difficulty"])} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text"><option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option></select>
        </div>
        {message && <p className={`text-xs mt-3 ${message.type === "success" ? "text-brand-success" : "text-brand-error"}`}>{message.text}</p>}
        <Button onClick={addQuestion} disabled={saving} className="mt-3">{saving ? "جارٍ الحفظ..." : "إضافة السؤال إلى البنك"}</Button>
      </GlassCard>

      <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-brand-text">بنك "{workspaceStageName ?? "—"}" ({filtered.length})</h2></div>
      <div className="flex flex-col gap-3 pb-36">
        {filtered.map((question) => <GlassCard key={question.id} className="flex items-start justify-between gap-3"><div><p className="text-brand-text font-medium">{question.text}</p><p className="text-xs text-brand-textMuted mt-1">{typeLabels[question.type]} · {question.points} درجة · {stages.find((stage) => stage.id === question.stageId)?.name ?? "—"} · {question.autoGrade ? "تصحيح تلقائي" : "مراجعة يدوية"}</p></div><button onClick={() => deleteDocById("question_bank", question.id)} className="text-brand-error text-xs shrink-0">حذف</button></GlassCard>)}
        {filtered.length === 0 && <p className="text-brand-textMuted">لا توجد أسئلة بعد.</p>}
      </div>
    </AppShell>
  );
}
