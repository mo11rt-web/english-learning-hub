"use client";



import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { Paperclip, Send, CheckCircle2, Clock3, MessageCircle, X, HelpCircle, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Modal";
import { createDoc, updateDocById } from "@/lib/firestore-helpers";
import { db } from "@/lib/firebase";
import { getTeacherUids, notifyUsers } from "@/lib/notifications";
import { Inquiry, InquiryMessage, InquiryStatus, Lesson, Unit, StudentProfile } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { formatSyrianDate } from "@/lib/dateUtils";

const statusLabels: Record<InquiryStatus, string> = {
  new: "جديد",
  viewed: "تمت المشاهدة",
  answered: "تم الرد",
  resolved: "تم الحل ✓",
};

const statusStyles: Record<InquiryStatus, string> = {
  new: "bg-brand-warning/15 text-brand-warning",
  viewed: "bg-brand-primary/10 text-brand-primary",
  answered: "bg-brand-success/15 text-brand-success",
  resolved: "bg-brand-secondary/15 text-brand-secondary",
};

type InquiryWithId = Inquiry & { id: string };
type MessageWithId = InquiryMessage & { id: string };

function formatDate(timestamp: number) {
  return formatSyrianDate(timestamp, { includeTime: true });
}

export default function StudentInquiriesPage() {
  const { user, profile } = useAuth();
  const student = profile as StudentProfile | null;
  const stageId = student?.stageId;
  const [inquiryIdFromUrl, setInquiryIdFromUrl] = useState<string | null>(null);

  useEffect(() => {
    setInquiryIdFromUrl(new URLSearchParams(window.location.search).get("inquiryId"));
  }, []);

  const [inquiries, setInquiries] = useState<InquiryWithId[]>([]);
  const [units, setUnits] = useState<(Unit & { id: string })[]>([]);
  const [lessons, setLessons] = useState<(Lesson & { id: string })[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageWithId[]>([]);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [unitId, setUnitId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showComposer, setShowComposer] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      query(collection(db, "inquiries"), where("studentId", "==", user.uid)),
      (snapshot) => {
        setInquiries(
          snapshot.docs
            .map((item) => ({ ...(item.data() as Inquiry), id: item.id }))
            .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
        );
      },
      (error) => showToast(`تعذّر تحميل الاستفسارات: ${error.message}`, "error")
    );
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!stageId) return;
    const loadReferences = async () => {
      const [unitSnapshot, lessonSnapshot] = await Promise.all([
        getDocs(query(collection(db, "units"), where("stageId", "==", stageId))),
        getDocs(query(collection(db, "lessons"), where("stageId", "==", stageId))),
      ]);
      setUnits(unitSnapshot.docs.map((item) => ({ ...(item.data() as Unit), id: item.id })));
      setLessons(lessonSnapshot.docs.map((item) => ({ ...(item.data() as Lesson), id: item.id })));
    };
    loadReferences().catch((error) => showToast(`تعذّر تحميل الدروس: ${error.message}`, "error"));
  }, [stageId]);

  useEffect(() => {
    if (inquiryIdFromUrl && inquiries.some((item) => item.id === inquiryIdFromUrl)) setSelectedId(inquiryIdFromUrl);
  }, [inquiryIdFromUrl, inquiries]);

  const selectedInquiry = inquiries.find((item) => item.id === selectedId) ?? null;
  const availableLessons = useMemo(() => {
    if (!unitId) return [];
    return lessons.filter((lesson) => lesson.unitId === unitId);
  }, [lessons, unitId]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    const unsubscribe = onSnapshot(
      collection(db, "inquiries", selectedId, "messages"),
      (snapshot) => {
        setMessages(
          snapshot.docs
            .map((item) => ({ ...(item.data() as InquiryMessage), id: item.id }))
            .sort((a, b) => a.createdAt - b.createdAt)
        );
      },
      (error) => showToast(`تعذّر تحميل المحادثة: ${error.message}`, "error")
    );
    return () => unsubscribe();
  }, [selectedId]);

  const resetComposer = () => {
    setTitle("");
    setDetails("");
    setUnitId("");
    setLessonId("");
  };

  const createInquiry = async () => {
    if (!user || !student || !stageId || sending) return;
    if (!title.trim()) return showToast("اكتب عنوان السؤال أولاً.", "error");
    if (!details.trim()) return showToast("اكتب تفاصيل السؤال أولاً.", "error");
    setSending(true);
    try {
      const now = Date.now();
      const inquiryRef = await createDoc("inquiries", {
        studentId: user.uid,
        studentName: student.fullName,
        stageId,
        groupIds: student.groupIds ?? [],
        title: title.trim(),
        details: details.trim(),
        ...(unitId ? { unitId } : {}),
        ...(lessonId ? { lessonId } : {}),
        status: "new",
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        lastMessageBy: "student",
      });
      await createDoc(`inquiries/${inquiryRef.id}/messages`, {
        senderId: user.uid,
        senderRole: "student",
        senderName: student.fullName,
        body: details.trim(),
        createdAt: now,
      });
      await notifyUsers(await getTeacherUids(), {
        type: "inquiry-new",
        title: `سؤال جديد من الطالب ${student.fullName}`,
        body: title.trim(),
        link: `/inquiries/${inquiryRef.id}`,
      });
      resetComposer();
      setSelectedId(inquiryRef.id);
      setShowComposer(false);
      showToast("تم إرسال السؤال للمعلم ✅");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "تعذّر إرسال السؤال.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell requireRole="student">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">أسئلتي واستفساراتي</h1>
          <p className="text-sm text-brand-textMuted mt-1">أرسل سؤالك للمعلم وتابع الرد داخل المنصة.</p>
        </div>
        <MessageCircle className="text-brand-primary mt-1" size={28} />
      </div>

      {!selectedId && showComposer && (
        <GlassCard className="mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-brand-text">سؤال جديد</h2>
            <button onClick={() => setShowComposer(false)} className="text-brand-textMuted hover:text-brand-error transition-colors"><X size={18} /></button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عنوان السؤال" className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
            <select value={unitId} onChange={(event) => { setUnitId(event.target.value); setLessonId(""); }} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70">
              <option value="">الوحدة المرتبطة (اختياري)</option>
              {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.title}</option>)}
            </select>
            <select 
              value={lessonId} 
              onChange={(event) => setLessonId(event.target.value)} 
              disabled={!unitId}
              className={`px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 ${!unitId ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <option value="">{unitId ? "الدرس المرتبط (اختياري)" : "اختر الوحدة أولاً"}</option>
              {availableLessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
            </select>
            <textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="اكتب تفاصيل سؤالك هنا..." rows={5} className="md:col-span-2 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <Button onClick={createInquiry} disabled={sending} className="w-full">{sending ? "جارٍ الإرسال..." : "إرسال السؤال للمعلم"} <Send size={15} className="mr-2" /></Button>
            <p className="text-[11px] text-brand-textMuted leading-relaxed">
              يمكنك إرسال سؤال واحد للمدرس، وسيتم الرد عليه من خلال هذه النافذة. بعد تحديد السؤال كتم الحل، يمكنك إرسال سؤال جديد فقط.
            </p>
          </div>
        </GlassCard>
      )}

      {!selectedId && !showComposer && (
        <Button onClick={() => setShowComposer(true)} className="w-full mb-6 py-4 rounded-2xl shadow-lg">
          <Plus size={18} className="ml-2" /> طرح سؤال جديد
        </Button>
      )}

      {selectedInquiry ? (
        <GlassCard className="mb-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between gap-3 border-b border-surfaceBorder pb-4 mb-4">
            <div><h2 className="font-bold text-brand-text">{selectedInquiry.title}</h2><p className="text-xs text-brand-textMuted mt-1">أُرسل في {formatDate(selectedInquiry.createdAt)}</p></div>
            <div className="flex items-center gap-2"><span className={`px-2.5 py-1 rounded-lg text-xs ${statusStyles[selectedInquiry.status]}`}>{statusLabels[selectedInquiry.status]}</span><button onClick={() => setSelectedId(null)} aria-label="إغلاق" className="text-brand-textMuted"><X size={18} /></button></div>
          </div>
          <div className="flex flex-col gap-3 max-h-[52vh] overflow-y-auto mb-6">
            {messages.map((message) => (
              <div key={message.id} className={`max-w-[90%] rounded-2xl p-4 ${message.senderRole === "student" ? "self-start bg-brand-primary/5 border border-brand-primary/10" : "self-end bg-surfaceBorder/40 border border-surfaceBorder"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${message.senderRole === "student" ? "bg-brand-primary text-white" : "bg-brand-secondary text-white"}`}>
                    {message.senderRole === "student" ? "س" : "ج"}
                  </div>
                  <p className="text-xs text-brand-text font-bold">{message.senderName}</p>
                </div>
                <p className="text-sm text-brand-text leading-relaxed whitespace-pre-wrap">{message.body}</p>
                {message.attachmentUrl && (
                  <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-primary font-bold hover:underline mt-3 inline-flex items-center gap-1">
                    <Paperclip size={12} /> {message.attachmentName ?? "فتح المرفق"}
                  </a>
                )}
                <p className="text-[10px] text-brand-textMuted mt-3 text-left">{formatDate(message.createdAt)}</p>
              </div>
            ))}
          </div>
          
          {selectedInquiry.status === "resolved" ? (
            <div className="bg-brand-success/5 border border-brand-success/20 rounded-2xl p-4 text-center">
              <p className="text-sm text-brand-success font-bold flex items-center justify-center gap-2 mb-3">
                <CheckCircle2 size={18} /> تم حل هذا السؤال وإغلاقه
              </p>
              <Button onClick={() => { setSelectedId(null); setShowComposer(true); }} className="w-full">
                <Plus size={16} className="ml-2" /> سؤال جديد
              </Button>
            </div>
          ) : selectedInquiry.status === "answered" ? (
            <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-2xl p-4 text-center">
              <p className="text-sm text-brand-primary font-medium mb-3">
                قام المدرس بالرد على سؤالك. سيتم إغلاق السؤال قريباً.
              </p>
              <Button onClick={() => { setSelectedId(null); setShowComposer(true); }} variant="secondary" className="w-full">
                <Plus size={16} className="ml-2" /> سؤال جديد آخر
              </Button>
            </div>
          ) : (
            <div className="bg-brand-warning/5 border border-brand-warning/20 rounded-2xl p-4">
              <p className="text-xs text-brand-warning font-bold text-center mb-1">بانتظار رد المدرس...</p>
              <p className="text-[11px] text-brand-textMuted text-center leading-relaxed">
                يمكنك إرسال سؤال واحد للمدرس، وسيتم الرد عليه هنا. بعد تحديد السؤال كتم الحل، يمكنك إرسال سؤال جديد فقط.
              </p>
            </div>
          )}
        </GlassCard>
      ) : null}

      <div className="flex items-center justify-between mb-3"><h2 className="font-bold text-brand-text">أسئلتي السابقة ({inquiries.length})</h2><Clock3 size={18} className="text-brand-textMuted" /></div>
      <div className="flex flex-col gap-3 pb-24">
        {inquiries.map((inquiry) => (
          <button key={inquiry.id} onClick={() => setSelectedId(inquiry.id)} className="text-right group">
            <GlassCard className={`hover:ring-2 hover:ring-brand-primary/30 transition-all ${selectedId === inquiry.id ? "ring-2 ring-brand-primary" : ""}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="w-10 h-10 rounded-xl bg-surfaceBorder/30 flex items-center justify-center text-brand-textMuted group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-colors shrink-0">
                  <HelpCircle size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-brand-text truncate">{inquiry.title}</p>
                  <p className="text-[11px] text-brand-textMuted mt-1">
                    {inquiry.unitId && units.find(u => u.id === inquiry.unitId)?.title ? `الوحدة: ${units.find(u => u.id === inquiry.unitId)?.title} · ` : ""}
                    {inquiry.lessonId && lessons.find(l => l.id === inquiry.lessonId)?.title ? `الدرس: ${lessons.find(l => l.id === inquiry.lessonId)?.title} · ` : ""}
                    آخر تحديث: {formatDate(inquiry.lastMessageAt)}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold shrink-0 ${statusStyles[inquiry.status]}`}>
                  {statusLabels[inquiry.status]}
                </span>
              </div>
            </GlassCard>
          </button>
        ))}
        {inquiries.length === 0 && (
          <div className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-surfaceBorder/20 flex items-center justify-center mx-auto mb-4 text-brand-textMuted opacity-20">
              <MessageCircle size={32} />
            </div>
            <p className="text-sm text-brand-textMuted">لا توجد أسئلة مرسلة بعد.</p>
          </div>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </AppShell>
  );
}