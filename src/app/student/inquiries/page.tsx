"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Paperclip, Send, CheckCircle2, Clock3, MessageCircle, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Modal";
import { createDoc, updateDocById } from "@/lib/firestore-helpers";
import { db, storage } from "@/lib/firebase";
import { getTeacherUids, notifyUsers } from "@/lib/notifications";
import { Inquiry, InquiryMessage, InquiryStatus, Lesson, Unit, StudentProfile } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

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
  return new Date(timestamp).toLocaleString("ar-SY", { dateStyle: "medium", timeStyle: "short" });
}

export default function StudentInquiriesPage() {
  const { user, profile } = useAuth();
  const { stageId } = useWorkspace();
  const [inquiryIdFromUrl, setInquiryIdFromUrl] = useState<string | null>(null);
  const student = profile as StudentProfile | null;
  const [inquiries, setInquiries] = useState<InquiryWithId[]>([]);
  const [units, setUnits] = useState<(Unit & { id: string })[]>([]);
  const [lessons, setLessons] = useState<(Lesson & { id: string })[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageWithId[]>([]);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [unitId, setUnitId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    setInquiryIdFromUrl(new URLSearchParams(window.location.search).get("inquiryId"));
  }, []);

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
  const availableLessons = useMemo(() => lessons.filter((lesson) => !unitId || lesson.unitId === unitId), [lessons, unitId]);

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
    setAttachment(null);
    setReply("");
  };

  const uploadAttachment = async () => {
    if (!attachment || !user) return null;
    if (attachment.size > 5 * 1024 * 1024) throw new Error("حجم المرفق يجب ألا يتجاوز 5 ميغابايت.");
    const path = `inquiry-files/${user.uid}/${Date.now()}-${attachment.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, attachment);
    return { url: await getDownloadURL(storageRef), name: attachment.name };
  };

  const sendMessage = async () => {
    if (!user || !student || sending || !reply.trim() || !selectedInquiry) return;
    setSending(true);
    try {
      const uploaded = await uploadAttachment();
      await createDoc(`inquiries/${selectedInquiry.id}/messages`, {
        senderId: user.uid,
        senderRole: "student",
        senderName: student.fullName,
        body: reply.trim(),
        ...(uploaded ? { attachmentUrl: uploaded.url, attachmentName: uploaded.name } : {}),
        createdAt: Date.now(),
      });
      await updateDocById("inquiries", selectedInquiry.id, {
        status: "new",
        updatedAt: Date.now(),
        lastMessageAt: Date.now(),
        lastMessageBy: "student",
      });
      await notifyUsers(await getTeacherUids(), {
        type: "inquiry-new",
        title: `سؤال جديد من الطالب ${student.fullName}`,
        body: selectedInquiry.title,
        link: `/student/inquiries?inquiryId=${selectedInquiry.id}`,
      });
      setReply("");
      setAttachment(null);
      showToast("تم إرسال رسالتك للمعلم ✅");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "تعذّر إرسال الرسالة.", "error");
    } finally {
      setSending(false);
    }
  };

  const createInquiry = async () => {
    if (!user || !student || !stageId || sending) return;
    if (!title.trim()) return showToast("اكتب عنوان السؤال أولاً.", "error");
    if (!details.trim()) return showToast("اكتب تفاصيل السؤال أولاً.", "error");
    setSending(true);
    try {
      const uploaded = await uploadAttachment();
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
        ...(uploaded ? { attachmentUrl: uploaded.url, attachmentName: uploaded.name } : {}),
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
        ...(uploaded ? { attachmentUrl: uploaded.url, attachmentName: uploaded.name } : {}),
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

      {!selectedInquiry ? (
        <GlassCard className="mb-6">
          <h2 className="font-bold text-brand-text mb-4">سؤال جديد</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عنوان السؤال" className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
            <select value={unitId} onChange={(event) => { setUnitId(event.target.value); setLessonId(""); }} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70">
              <option value="">الوحدة المرتبطة (اختياري)</option>
              {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.title}</option>)}
            </select>
            <select value={lessonId} onChange={(event) => setLessonId(event.target.value)} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70">
              <option value="">الدرس المرتبط (اختياري)</option>
              {availableLessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
            </select>
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-sm text-brand-textMuted cursor-pointer">
              <Paperclip size={16} />
              <span className="truncate">{attachment?.name ?? "إرفاق صورة أو ملف (5 MB)"}</span>
              <input type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} />
            </label>
            <textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="اكتب تفاصيل سؤالك هنا..." rows={5} className="md:col-span-2 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
          </div>
          <Button onClick={createInquiry} disabled={sending} className="mt-4">{sending ? "جارٍ الإرسال..." : "إرسال للمعلم"} <Send size={15} /></Button>
        </GlassCard>
      ) : (
        <GlassCard className="mb-6">
          <div className="flex items-start justify-between gap-3 border-b border-surfaceBorder pb-4 mb-4">
            <div><h2 className="font-bold text-brand-text">{selectedInquiry.title}</h2><p className="text-xs text-brand-textMuted mt-1">أُرسل في {formatDate(selectedInquiry.createdAt)}</p></div>
            <div className="flex items-center gap-2"><span className={`px-2.5 py-1 rounded-lg text-xs ${statusStyles[selectedInquiry.status]}`}>{statusLabels[selectedInquiry.status]}</span><button onClick={() => setSelectedId(null)} aria-label="إغلاق" className="text-brand-textMuted"><X size={18} /></button></div>
          </div>
          <div className="flex flex-col gap-3 max-h-[52vh] overflow-y-auto mb-4">
            {messages.map((message) => (
              <div key={message.id} className={`max-w-[88%] rounded-2xl p-3 ${message.senderId === user?.uid ? "self-start bg-brand-primary/10" : "self-end bg-surfaceBorder/50"}`}>
                <p className="text-xs text-brand-primary font-bold mb-1">{message.senderName}</p>
                <p className="text-sm text-brand-text whitespace-pre-wrap">{message.body}</p>
                {message.attachmentUrl && <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-primary underline mt-2 inline-block">📎 {message.attachmentName ?? "فتح المرفق"}</a>}
                <p className="text-[10px] text-brand-textMuted mt-2">{formatDate(message.createdAt)}</p>
              </div>
            ))}
          </div>
          {selectedInquiry.status !== "resolved" && <div className="flex flex-col gap-2"><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="أضف توضيحاً أو رسالة للمعلم..." rows={3} className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" /><div className="flex items-center justify-between gap-2"><label className="text-xs text-brand-textMuted flex items-center gap-1 cursor-pointer"><Paperclip size={15} />{attachment?.name ?? "إرفاق"}<input type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} /></label><Button onClick={sendMessage} disabled={sending || !reply.trim()}>{sending ? "جارٍ الإرسال..." : "إرسال"} <Send size={15} /></Button></div></div>}
          {selectedInquiry.status === "resolved" && <p className="text-sm text-brand-success flex items-center gap-2"><CheckCircle2 size={16} /> تم إغلاق هذا الاستفسار. يمكنك إنشاء سؤال جديد عند الحاجة.</p>}
        </GlassCard>
      )}

      <div className="flex items-center justify-between mb-3"><h2 className="font-bold text-brand-text">أسئلتي السابقة ({inquiries.length})</h2><Clock3 size={18} className="text-brand-textMuted" /></div>
      <div className="flex flex-col gap-3 pb-24">
        {inquiries.map((inquiry) => <button key={inquiry.id} onClick={() => setSelectedId(inquiry.id)} className="text-right"><GlassCard className="hover:ring-2 hover:ring-brand-primary/30 transition-all"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="font-medium text-brand-text truncate">{inquiry.title}</p><p className="text-xs text-brand-textMuted mt-1">آخر تحديث: {formatDate(inquiry.lastMessageAt)}</p></div><span className={`px-2.5 py-1 rounded-lg text-xs shrink-0 ${statusStyles[inquiry.status]}`}>{statusLabels[inquiry.status]}</span></div></GlassCard></button>)}
        {inquiries.length === 0 && <p className="text-sm text-brand-textMuted">لا توجد أسئلة بعد.</p>}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </AppShell>
  );
}
