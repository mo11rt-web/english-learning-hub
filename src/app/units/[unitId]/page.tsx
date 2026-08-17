"use client";
import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Rocket, Pause, Target, Trash2, Search, SlidersHorizontal } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { deleteDoc, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal, Toast } from "@/components/ui/Modal";
import { toStoredTargetGroupIds, isTargetedAtAll, ALL_GROUPS_SENTINEL } from "@/lib/groupTargeting";
import { LessonBlockView } from "@/components/LessonBlockView";
import { LessonContentBuilder } from "@/components/LessonContentBuilder";
import {
  listenCollection,
  createDoc,
  updateDocById,
  where,
} from "@/lib/firestore-helpers";
import { Lesson, Unit, LessonBlock, LessonQuizQuestion, Group } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

// ===== حالة سؤال الكويز أثناء التحرير بالنموذج (قبل الحفظ) =====
interface DraftQuestion {
  draftId: string; // معرّف مؤقت للتحرير بالواجهة فقط، مش محفوظ بقاعدة البيانات
  text: string;
  options: [string, string, string, string]; // A, B, C, D دائمًا 4 خيارات ثابتة
  correctIndex: number | null; // null = لسا ما تحدّدت إجابة صحيحة
}

function emptyDraftQuestion(): DraftQuestion {
  return {
    draftId: crypto.randomUUID(),
    text: "",
    options: ["", "", "", ""],
    correctIndex: null,
  };
}

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

// ملاحظة مهمة: هاد المكوّن معرّف على مستوى الملف (مش جوا دالة الصفحة
// الأساسية) عن قصد — تعريف مكوّنات فرعية داخل جسم مكوّن تاني هو بالضبط
// السبب يلي كان يسبب مشكلة "فقدان التركيز" بالنماذج (React بيعيد إنشاء
// نوع المكوّن بالكامل بكل مرة، فبيفقد أي حالة/تركيز داخلي).
function LessonCard({
  lesson,
  groupsInUnit,
  onPreview,
  onTogglePublish,
  onUpdateGroups,
  onDelete,
}: {
  lesson: Lesson & { id: string };
  groupsInUnit: (Group & { id: string })[];
  onPreview: () => void;
  onTogglePublish: () => void;
  onUpdateGroups: (groupIds: string[]) => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [editingGroups, setEditingGroups] = useState(false);
  const [draftGroupIds, setDraftGroupIds] = useState<Set<string>>(
    new Set(lesson.targetGroupIds.filter((id) => id !== ALL_GROUPS_SENTINEL))
  );

  const targetNames = isTargetedAtAll(lesson.targetGroupIds)
    ? "كل المجموعات"
    : groupsInUnit
        .filter((g) => lesson.targetGroupIds.includes(g.id))
        .map((g) => g.name)
        .join("، ") || "مجموعات محدّدة";

  return (
    <GlassCard className="hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-brand-text">{lesson.title}</h3>
        <StatusBadge
          label={lesson.status === "published" ? "منشور" : "مسودة"}
          tone={lesson.status === "published" ? "success" : "warning"}
        />
      </div>
      <p className="text-brand-textMuted text-sm mt-1">
        {lesson.blocks?.length ?? 0} كتلة محتوى
        {lesson.quizQuestions?.length ? ` · ${lesson.quizQuestions.length} سؤال كويز` : ""}
      </p>
      <p className="text-brand-textMuted text-xs mt-1 flex items-center gap-1">
        <Target size={12} className="shrink-0" /> {targetNames}
      </p>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Button
          onClick={onTogglePublish}
          variant={lesson.status === "published" ? "secondary" : "primary"}
          className="!py-2 !px-3.5 text-xs flex items-center gap-1.5"
        >
          {lesson.status === "published" ? <Pause size={14} /> : <Rocket size={14} />}
          {lesson.status === "published" ? "إلغاء النشر" : "نشر الدرس"}
        </Button>
        <Button
          onClick={() => router.push(`/lessons/${lesson.id}`)}
          variant="secondary"
          className="!py-2 !px-3.5 text-xs flex items-center gap-1.5"
        >
          <Pencil size={14} />
          تعديل الدرس
        </Button>
        <Button
          onClick={onPreview}
          variant="secondary"
          className="!py-2 !px-3.5 text-xs flex items-center gap-1.5"
        >
          <Eye size={14} />
          معاينة كطالب
        </Button>
        <Button
          onClick={() => {
            setDraftGroupIds(new Set(lesson.targetGroupIds));
            setEditingGroups((v) => !v);
          }}
          variant="secondary"
          className="!py-2 !px-3.5 text-xs flex items-center gap-1.5"
        >
          <Target size={14} />
          تحديد المجموعات
        </Button>
        <Button
          onClick={onDelete}
          variant="danger"
          className="!py-2 !px-3.5 text-xs flex items-center gap-1.5"
        >
          <Trash2 size={14} />
          حذف الدرس
        </Button>
      </div>

      {editingGroups && (
        <div className="mt-3 pt-3 border-t border-surfaceBorder/60 flex flex-col gap-2">
          <p className="text-xs text-brand-textMuted">
            بدون تحديد أي مجموعة = يفتح الدرس لكل طلاب القسم. حدد مجموعات معيّنة إذا بدك الدرس يفتح لهم بس.
          </p>
          <div className="flex flex-wrap gap-2">
            {groupsInUnit.map((g) => (
              <label
                key={g.id}
                className={`px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                  draftGroupIds.has(g.id)
                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                    : "border-surfaceBorder text-brand-textMuted"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={draftGroupIds.has(g.id)}
                  onChange={() => {
                    setDraftGroupIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(g.id)) next.delete(g.id);
                      else next.add(g.id);
                      return next;
                    });
                  }}
                />
                {g.name}
              </label>
            ))}
            {groupsInUnit.length === 0 && (
              <p className="text-brand-textMuted text-xs">لا توجد مجموعات بهذا القسم بعد.</p>
            )}
          </div>
          <div className="flex gap-2 mt-1">
            <Button
              onClick={() => {
                onUpdateGroups(Array.from(draftGroupIds));
                setEditingGroups(false);
              }}
              className="!py-1.5 !px-3 text-xs"
            >
              حفظ
            </Button>
            <button
              onClick={() => setEditingGroups(false)}
              className="text-xs text-brand-textMuted px-3"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

// نموذج إضافة/تعديل سؤال كويز واحد — مكوّن منفصل على مستوى الملف (نفس
// السبب: تجنّب أي إعادة إنشاء لنوع المكوّن أثناء الكتابة).
function QuizQuestionForm({
  initial,
  onSave,
  onCancel,
  error,
}: {
  initial: DraftQuestion;
  onSave: (q: DraftQuestion) => void;
  onCancel: () => void;
  error: string;
}) {
  const [draft, setDraft] = useState<DraftQuestion>(initial);

  return (
    <div className="border-t border-surfaceBorder pt-4 mt-2">
      <p className="text-sm font-medium text-brand-text mb-2">
        {initial.text ? "تعديل السؤال" : "+ إضافة سؤال"}
      </p>
      <textarea
        placeholder="نص السؤال"
        value={draft.text}
        onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        rows={2}
        className="w-full px-3 py-2 rounded-xl border border-brand-primary/20 bg-surface/70 outline-none mb-2"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        {draft.options.map((opt, i) => (
          <label
            key={i}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
              draft.correctIndex === i
                ? "border-brand-success bg-brand-success/5"
                : "border-brand-primary/20 bg-surface/70"
            }`}
          >
            <input
              type="radio"
              name={`correct-${draft.draftId}`}
              checked={draft.correctIndex === i}
              onChange={() => setDraft({ ...draft, correctIndex: i })}
            />
            <span className="text-brand-textMuted font-bold text-xs shrink-0">
              {OPTION_LABELS[i]}.
            </span>
            <input
              placeholder={`الإجابة ${OPTION_LABELS[i]}`}
              value={opt}
              onChange={(e) => {
                const options = [...draft.options] as DraftQuestion["options"];
                options[i] = e.target.value;
                setDraft({ ...draft, options });
              }}
              className="flex-1 bg-transparent outline-none min-w-0"
            />
          </label>
        ))}
      </div>
      <p className="text-xs text-brand-textMuted mb-2">
        حدد الدائرة بجانب الإجابة الصحيحة. لازم تعبّي الخيارات الأربعة وتحدد إجابة واحدة صحيحة.
      </p>
      {error && <p className="text-brand-error text-xs mb-2">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={() => onSave(draft)} className="!py-1.5 !px-4 text-sm">
          حفظ السؤال
        </Button>
        <button onClick={onCancel} className="text-xs text-brand-textMuted px-3">
          إلغاء
        </button>
      </div>
    </div>
  );
}

// معاينة تفاعلية حقيقية للكويز — نفس منطق التصحيح اللوني يلي بيشوفه
// الطالب فعليًا (أخضر للصحيح، أحمر للي اختاره المعلم غلط)، بدون ما نكتب
// أي شي بقاعدة البيانات (معاينة فقط). key={lesson.id} بالأسفل عند
// الاستخدام بيضمن إعادة تصفير الحالة تلقائيًا كل ما تنفتح معاينة درس
// مختلف، بدون الحاجة لأي إعادة-Focus يدوية.
function PreviewQuiz({ questions }: { questions: LessonQuizQuestion[] }) {
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const q = questions[qIndex];

  const selectAnswer = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    if (i === q.correctIndex) setCorrectCount((c) => c + 1);
  };

  const next = () => {
    if (qIndex + 1 < questions.length) {
      setQIndex((i) => i + 1);
      setSelected(null);
    } else {
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="text-center py-4">
        <p className="font-bold text-brand-text mb-1">انتهت المعاينة 🎉</p>
        <p className="text-2xl font-bold text-brand-primary">
          {correctCount} / {questions.length}
        </p>
        <button
          onClick={() => {
            setQIndex(0);
            setSelected(null);
            setCorrectCount(0);
            setDone(false);
          }}
          className="text-brand-primary text-sm font-medium mt-3"
        >
          🔁 إعادة تجربة الكويز
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-brand-textMuted text-xs mb-2">
        سؤال {qIndex + 1} من {questions.length}
      </p>
      <p className="font-bold text-brand-text mb-3">{q.text}</p>
      <div className="flex flex-col gap-2">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correctIndex;
          const isSelected = i === selected;
          let cls = "border-brand-primary/20 bg-surface/70";
          if (selected !== null) {
            if (isCorrect) cls = "border-brand-success bg-brand-success/10";
            else if (isSelected) cls = "border-brand-error bg-brand-error/10";
          }
          return (
            <button
              key={i}
              onClick={() => selectAnswer(i)}
              disabled={selected !== null}
              className={`text-right px-3 py-2.5 rounded-xl border-2 transition-colors text-brand-text text-sm ${cls}`}
            >
              <span className="text-brand-textMuted font-bold text-xs ml-1">{OPTION_LABELS[i]}.</span> {opt}
              {selected !== null && isCorrect && <span className="mr-2">✓</span>}
              {selected !== null && isSelected && !isCorrect && <span className="mr-2">✕</span>}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <Button onClick={next} className="mt-3 !py-1.5 !px-4 text-sm">
          {qIndex + 1 < questions.length ? "التالي" : "عرض النتيجة"}
        </Button>
      )}
    </div>
  );
}

export default function UnitLessonsPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const [lessons, setLessons] = useState<(Lesson & { id: string })[]>([]);
  const [unit, setUnit] = useState<(Unit & { id: string }) | null>(null);
  const [groups, setGroups] = useState<(Group & { id: string })[]>([]);
  const { user } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });
  const [draftBlocks, setDraftBlocks] = useState<LessonBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [previewLesson, setPreviewLesson] = useState<(Lesson & { id: string }) | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [lessonSearch, setLessonSearch] = useState("");
  const [lessonStatus, setLessonStatus] = useState<"all" | "published" | "draft">("all");
  const [lessonSort, setLessonSort] = useState<"order" | "name" | "newest" | "oldest">("order");

  // مسودة أسئلة الكويز السريع (Quick Quiz) أثناء إنشاء الدرس نفسه
  const [quizDrafts, setQuizDrafts] = useState<DraftQuestion[]>([]);
  const [quizError, setQuizError] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [justCreatedLesson, setJustCreatedLesson] = useState<(Lesson & { id: string }) | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    const u = listenCollection<Lesson>(
      "lessons",
      [where("unitId", "==", unitId)],
      // الترتيب صار محليًا بالجافاسكربت بدل orderBy بالاستعلام، حتى ما
      // نحتاج نطلب من Firebase إنشاء فهرس مركّب (composite index) يدويًا —
      // هاد بالضبط كان سبب اختفاء الدروس رغم ظهور "تم الحفظ بنجاح": كان
      // Firestore يرفض الاستعلام بصمت لأنه الفهرس المطلوب ما كان موجود.
      (items) => {
        setLessons(items.slice().sort((a, b) => a.order - b.order));
        // ترقيع تلقائي لمرة وحدة: أي درس قديم اتسجّل قبل هذا التحديث
        // بمصفوفة targetGroupIds فاضية (تعني "كل المجموعات" بالنسخة
        // القديمة) ما بيقدر يوصل للطالب بعد اليوم، لأنه استعلام الطالب
        // صار يبحث عن قيمة محدّدة (__all__) مش عن مصفوفة فاضية —
        // Firestore ما بيقدر يطابق "array-contains-any" مع مصفوفة فاضية
        // إطلاقًا. هذا الترقيع يحوّل أي درس قديم متل هيك تلقائيًا أول ما
        // المعلم يفتح صفحة الوحدة، بدون أي إجراء يدوي مطلوب منه.
        items
          .filter((l) => l.targetGroupIds.length === 0)
          .forEach((l) => {
            updateDocById("lessons", l.id, {
              targetGroupIds: toStoredTargetGroupIds([]),
            }).catch(() => {});
          });
      },
      (err) => showToast(`تعذّر تحميل قائمة الدروس: ${err.message}`, "error")
    );
    const g = listenCollection<Group>("groups", [], setGroups);
    getDoc(doc(db, "units", unitId)).then((snap) => {
      if (snap.exists()) setUnit({ ...(snap.data() as Unit), id: snap.id });
    });
    return () => {
      u();
      g();
    };
  }, [unitId]);

  const groupsInUnit = groups.filter((g) => g.stageId === unit?.stageId);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`english-hub:unit-lessons:${unitId}`);
      if (!saved) return;
      const state = JSON.parse(saved) as { search?: string; status?: "all" | "published" | "draft"; sort?: "order" | "name" | "newest" | "oldest" };
      setLessonSearch(state.search ?? "");
      setLessonStatus(state.status ?? "all");
      setLessonSort(state.sort ?? "order");
    } catch { /* تجاهل حالة قديمة أو غير صالحة */ }
  }, [unitId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`english-hub:unit-lessons:${unitId}`, JSON.stringify({ search: lessonSearch, status: lessonStatus, sort: lessonSort }));
    } catch { /* sessionStorage قد يكون محجوباً في بعض البيئات */ }
  }, [unitId, lessonSearch, lessonStatus, lessonSort]);

  const visibleLessons = useMemo(() => {
    const query = lessonSearch.trim().toLocaleLowerCase("ar");
    return lessons
      .filter((lesson) => !query || lesson.title.toLocaleLowerCase("ar").includes(query))
      .filter((lesson) => lessonStatus === "all" || lesson.status === lessonStatus)
      .slice()
      .sort((a, b) => {
        if (lessonSort === "name") return a.title.localeCompare(b.title, "ar");
        if (lessonSort === "newest") return (b.createdAt ?? 0) - (a.createdAt ?? 0);
        if (lessonSort === "oldest") return (a.createdAt ?? 0) - (b.createdAt ?? 0);
        return a.order - b.order;
      });
  }, [lessons, lessonSearch, lessonStatus, lessonSort]);

  const resetForm = () => {
    setForm({ title: "", description: "" });
    setDraftBlocks([]);
    setSelectedGroupIds(new Set());
    setQuizDrafts([]);
    setQuizError("");
    setEditingQuestionId(null);
    setJustCreatedLesson(null);
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // ===== إدارة أسئلة الـ Quick Quiz أثناء إنشاء الدرس =====
  const addOrUpdateQuestionDraft = (q: DraftQuestion) => {
    setQuizError("");
    const filledOptions = q.options.filter((o) => o.trim());
    if (!q.text.trim()) {
      setQuizError("لازم تكتب نص السؤال.");
      return false;
    }
    if (filledOptions.length < 4) {
      setQuizError("لازم تعبّي الخيارات الأربعة (A/B/C/D) كلهم.");
      return false;
    }
    if (q.correctIndex === null) {
      setQuizError("لازم تحدد الإجابة الصحيحة قبل ما تضيف السؤال.");
      return false;
    }
    setQuizDrafts((prev) => {
      const exists = prev.some((d) => d.draftId === q.draftId);
      if (exists) return prev.map((d) => (d.draftId === q.draftId ? q : d));
      return [...prev, q];
    });
    setEditingQuestionId(null);
    return true;
  };

  const removeQuestionDraft = (draftId: string) => {
    setQuizDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
    if (editingQuestionId === draftId) setEditingQuestionId(null);
  };

  const moveQuestionDraft = (index: number, dir: -1 | 1) => {
    setQuizDrafts((prev) => {
      const arr = [...prev];
      const target = index + dir;
      if (target < 0 || target >= arr.length) return prev;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  };

  const addLesson = async () => {
    setQuizError("");
    if (!form.title.trim()) {
      showToast("عنوان الدرس إلزامي.", "error");
      return;
    }
    if (!user) return;
    if (!unit) {
      showToast("لسا بيانات الوحدة ما تحمّلت، انتظر ثانية وجرب مجددًا", "error");
      return;
    }
    // ما بنسمح نحفظ إذا في سؤال مفتوح للتحرير بعد وما انضاف/انحفظ بالقائمة —
    // حتى ما يضيع بصمت
    if (editingQuestionId) {
      showToast("لسا في سؤال كويز مفتوح للتحرير — احفظه أو احذفه قبل إنشاء الدرس.", "error");
      return;
    }

    setSaving(true);
    try {
      const blocks: LessonBlock[] = draftBlocks
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((block, index) => ({ ...block, order: index }));

      const quizQuestions: LessonQuizQuestion[] = quizDrafts.map((d, i) => ({
        id: crypto.randomUUID(),
        text: d.text.trim(),
        options: d.options.map((o) => o.trim()),
        correctIndex: d.correctIndex as number,
        order: i,
      }));

      const newLessonData = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        unitId,
        stageId: unit.stageId,
        status: "draft" as const,
        order: lessons.length,
        targetGroupIds: toStoredTargetGroupIds(Array.from(selectedGroupIds)),
        blocks,
        quizQuestions,
        createdBy: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // بنتحقق فعليًا إنه الحفظ نجح قبل ما نعتبر العملية ناجحة: createDoc
      // بيرجع مرجع المستند الجديد (docRef) فقط لو الكتابة نجحت فعلاً
      // بقاعدة البيانات؛ أي فشل بيرمي استثناء وبينتقل مباشرة لـ catch تحت.
      const docRef = await createDoc("lessons", newLessonData);

      showToast("تم إنشاء الدرس بنجاح ✅");
      setJustCreatedLesson({ ...newLessonData, id: docRef.id } as Lesson & { id: string });
      resetFormKeepSuccessModal();
    } catch (err) {
      // قبل هيك ما كان في أي رسالة للمعلم لما يفشل الحفظ — كان الدرس
      // "بيختفي" بصمت بدون أي تفسير. هلق بنعرض السبب الحقيقي مباشرة، وما
      // بنسكر النموذج ولا بنمسح أي بيانات كتبها المستخدم، حتى يقدر يصحح
      // ويعيد المحاولة بدون ما يعيد كتابة كل شي من الصفر.
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`تعذّر حفظ الدرس: ${msg}`, "error");
    } finally {
      setSaving(false);
    }
  };

  // بعد نجاح الحفظ منسكر نموذج الإدخال (ما في داعي نعيد تعبيته) بس منحافظ
  // على lesson المُنشأ حديثًا حتى نقدر نعرض "معاينة كطالب" فورًا
  const resetFormKeepSuccessModal = () => {
    setForm({ title: "", description: "" });
    setDraftBlocks([]);
    setSelectedGroupIds(new Set());
    setQuizDrafts([]);
    setQuizError("");
    setEditingQuestionId(null);
    setModalOpen(false);
  };

  return (
    <AppShell requireRole="teacher">
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">دروس الوحدة {unit ? `— ${unit.title}` : ""}</h1>
          <p className="text-xs text-brand-textMuted mt-1">{visibleLessons.length} من {lessons.length} درس</p>
        </div>
        <Button onClick={() => { resetForm(); setJustCreatedLesson(null); setModalOpen(true); }}>+ إضافة درس</Button>
      </div>

      <GlassCard className="mb-5 !p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <label className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl border border-brand-primary/20 bg-surface/70"><Search size={17} className="text-brand-primary" /><input value={lessonSearch} onChange={(event) => setLessonSearch(event.target.value)} placeholder="ابحث باسم الدرس..." className="min-w-0 flex-1 bg-transparent outline-none text-sm" /></label>
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-brand-primary/20 bg-surface/70 text-sm"><SlidersHorizontal size={16} className="text-brand-primary" /><select value={lessonStatus} onChange={(event) => setLessonStatus(event.target.value as typeof lessonStatus)} className="bg-transparent outline-none"><option value="all">جميع الدروس</option><option value="published">منشور</option><option value="draft">مسودة</option></select></label>
          <select value={lessonSort} onChange={(event) => setLessonSort(event.target.value as typeof lessonSort)} className="px-3 py-2 rounded-xl border border-brand-primary/20 bg-surface/70 text-sm"><option value="order">الترتيب الأصلي</option><option value="name">حسب الاسم</option><option value="newest">الأحدث</option><option value="oldest">الأقدم</option></select>
        </div>
      </GlassCard>

      <div className="grid md:grid-cols-2 gap-4">
        {visibleLessons.map((l) => (
          <LessonCard
            key={l.id}
            lesson={l}
            groupsInUnit={groupsInUnit}
            onPreview={() => setPreviewLesson(l)}
            onTogglePublish={async () => {
              try {
                await updateDocById("lessons", l.id, {
                  status: l.status === "published" ? "draft" : "published",
                  publishedAt: l.status === "published" ? l.publishedAt : Date.now(),
                });
                showToast(l.status === "published" ? "تم إلغاء نشر الدرس" : "تم نشر الدرس ✅");
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                showToast(`تعذّر تحديث حالة النشر: ${msg}`, "error");
              }
            }}
            onUpdateGroups={async (groupIds) => {
              try {
                await updateDocById("lessons", l.id, {
                  targetGroupIds: toStoredTargetGroupIds(groupIds),
                });
                showToast("تم تحديث المجموعات المستهدفة ✅");
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                showToast(`تعذّر تحديث المجموعات: ${msg}`, "error");
              }
            }}
            onDelete={async () => {
              const confirmed = window.confirm(`هل أنت متأكد من حذف الدرس "${l.title}"؟ لا يمكن التراجع عن هذا الإجراء.`);
              if (!confirmed) return;
              try {
                await deleteDoc(doc(db, "lessons", l.id));
                showToast("تم حذف الدرس بنجاح ✅");
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                showToast(`تعذّر حذف الدرس: ${msg}`, "error");
              }
            }}
          />
        ))}
        {visibleLessons.length === 0 && <p className="text-brand-textMuted">{lessons.length === 0 ? "لا توجد دروس بعد." : "لا توجد دروس تطابق البحث أو الفلتر الحالي."}</p>}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={justCreatedLesson ? "تم إنشاء الدرس" : "إضافة درس جديد"}
        maxWidth="max-w-4xl"
      >
        {justCreatedLesson ? (
          <div className="flex flex-col gap-4 items-center text-center py-2">
            <div className="w-14 h-14 rounded-full bg-brand-success/15 text-brand-success flex items-center justify-center text-2xl">
              ✅
            </div>
            <div>
              <p className="font-bold text-brand-text">تم إنشاء الدرس بنجاح</p>
              <p className="text-brand-textMuted text-sm mt-1">
                &quot;{justCreatedLesson.title}&quot; بحالة مسودة حاليًا — اضغط &quot;نشر الدرس&quot; من القائمة لما يصير جاهز للطلاب.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-2">
              <Button
                onClick={() => {
                  setPreviewLesson(justCreatedLesson);
                  setModalOpen(false);
                  resetForm();
                }}
                className="w-full"
              >
                👁️ معاينة كطالب
              </Button>
              <button
                onClick={() => {
                  setJustCreatedLesson(null);
                }}
                className="text-sm text-brand-primary font-medium py-2"
              >
                + إضافة درس آخر
              </button>
              <button
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="text-sm text-brand-textMuted py-1"
              >
                إغلاق
              </button>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col gap-4"
            onKeyDown={(e) => {
              const target = e.target as HTMLElement;
              if (e.key === "Enter" && target.tagName !== "TEXTAREA") {
                e.preventDefault();
              }
            }}
          >
            <div>
              <label className="text-sm text-brand-text block mb-1.5">عنوان الدرس *</label>
              <input
                placeholder="مثال: Present Simple"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
              />
            </div>

            <div>
              <label className="text-sm text-brand-text block mb-1.5">وصف الدرس (اختياري)</label>
              <textarea
                placeholder="وصف مختصر عن محتوى الدرس..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
              />
            </div>

            <LessonContentBuilder
              blocks={draftBlocks}
              onChange={setDraftBlocks}
              saving={saving}
            />

            <div>
              <label className="text-sm text-brand-text block mb-1.5">
                يفتح لمين؟ (اختياري — بدون تحديد = كل الطلاب)
              </label>
              <div className="flex flex-wrap gap-2">
                {groupsInUnit.map((g) => (
                  <label
                    key={g.id}
                    className={`px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      selectedGroupIds.has(g.id)
                        ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                        : "border-surfaceBorder text-brand-textMuted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedGroupIds.has(g.id)}
                      onChange={() => toggleGroup(g.id)}
                    />
                    {g.name}
                  </label>
                ))}
                {groupsInUnit.length === 0 && (
                  <p className="text-brand-textMuted text-xs">لا توجد مجموعات بهذا القسم بعد — الدرس رح يفتح لكل الطلاب.</p>
                )}
              </div>
            </div>

            {/* ===== Quick Quiz ===== */}
            <div className="border-t border-surfaceBorder pt-4">
              <p className="text-sm font-bold text-brand-text mb-1">🧠 Quick Quiz (اختياري)</p>
              <p className="text-xs text-brand-textMuted mb-3">
                أسئلة اختيار من متعدد بتظهر للطالب بعد ما يخلص محتوى الدرس، مع تصحيح فوري.
              </p>

              {quizDrafts.length > 0 && (
                <div className="flex flex-col gap-2 mb-2">
                  {quizDrafts.map((q, idx) =>
                    editingQuestionId === q.draftId ? (
                      <QuizQuestionForm
                        key={q.draftId}
                        initial={q}
                        error={quizError}
                        onSave={(updated) => addOrUpdateQuestionDraft(updated)}
                        onCancel={() => setEditingQuestionId(null)}
                      />
                    ) : (
                      <div key={q.draftId} className="bg-surface/60 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <span className="text-sm text-brand-text font-medium">
                            {idx + 1}. {q.text}
                          </span>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => moveQuestionDraft(idx, -1)} className="text-xs px-1">▲</button>
                            <button onClick={() => moveQuestionDraft(idx, 1)} className="text-xs px-1">▼</button>
                            <button
                              onClick={() => setEditingQuestionId(q.draftId)}
                              className="text-xs px-1 text-brand-primary"
                            >
                              تعديل
                            </button>
                            <button
                              onClick={() => removeQuestionDraft(q.draftId)}
                              className="text-xs px-1 text-brand-error"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {q.options.map((opt, i) => (
                            <span
                              key={i}
                              className={`text-xs px-2 py-1 rounded-lg ${
                                i === q.correctIndex
                                  ? "bg-brand-success/15 text-brand-success"
                                  : "bg-surfaceBorder/40 text-brand-textMuted"
                              }`}
                            >
                              {OPTION_LABELS[i]}. {opt} {i === q.correctIndex && "✓"}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              {editingQuestionId === "new" ? (
                <QuizQuestionForm
                  initial={emptyDraftQuestion()}
                  error={quizError}
                  onSave={(q) => {
                    if (addOrUpdateQuestionDraft(q)) setEditingQuestionId(null);
                  }}
                  onCancel={() => setEditingQuestionId(null)}
                />
              ) : (
                <button
                  onClick={() => setEditingQuestionId("new")}
                  className="text-sm text-brand-primary font-medium"
                >
                  + إضافة سؤال
                </button>
              )}
            </div>

            <Button onClick={addLesson} disabled={saving || !form.title.trim() || !unit}>
              {saving ? "جارٍ الحفظ..." : !unit ? "جارٍ تحميل بيانات الوحدة..." : "إنشاء الدرس"}
            </Button>
          </div>
        )}
      </Modal>

      {/* معاينة الدرس بالضبط متل ما رح يشوفه الطالب — بنفس المكوّن يلي
          الطالب نفسه يشوفه (LessonBlockView)، جوا نافذة منبثقة داخل
          التطبيق نفسه، بدون ما نضطر نفتح حساب طالب تجريبي أو صفحة منفصلة. */}
      <Modal
        open={!!previewLesson}
        onClose={() => setPreviewLesson(null)}
        title={previewLesson ? `معاينة كطالب — ${previewLesson.title}` : "معاينة"}
        maxWidth="max-w-2xl"
      >
        {previewLesson && (
          <div className="flex flex-col gap-5">
            <p className="text-xs text-brand-textMuted bg-brand-primary/5 rounded-xl p-2.5">
              هيك بالضبط رح يشوف الطالب هالدرس — نفس الترتيب ونفس المحتوى. هاي معاينة فقط، ما بتأثر على شي.
            </p>
            {previewLesson.description && (
              <p className="text-brand-text text-sm">{previewLesson.description}</p>
            )}
            {(previewLesson.blocks ?? [])
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((block) => (
                <LessonBlockView key={block.id} block={block} />
              ))}
            {(!previewLesson.blocks || previewLesson.blocks.length === 0) && (
              <p className="text-brand-textMuted text-sm">هذا الدرس ما فيه محتوى مضاف بعد.</p>
            )}
            {previewLesson.quizQuestions && previewLesson.quizQuestions.length > 0 && (
              <div className="border-t border-brand-primary/10 pt-4">
                <p className="text-sm font-medium text-brand-text mb-3">
                  🧠 كويز الدرس ({previewLesson.quizQuestions.length} سؤال) — جرّبه هلق متل ما رح يشوفه الطالب بالضبط
                </p>
                <PreviewQuiz key={previewLesson.id} questions={previewLesson.quizQuestions} />
              </div>
            )}
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </AppShell>
  );
}

export function generateStaticParams() { return []; }