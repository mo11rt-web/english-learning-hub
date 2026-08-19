"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { CheckCircle2, Clock3, MessageCircle, Paperclip, Search, Send, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Modal";
import { CompactListRow } from "@/components/ui/CompactListRow";
import { FilterChipsBar } from "@/components/ui/FilterChipsBar";
import ActionsDropdown from "@/components/ui/ActionsDropdown";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createDoc, updateDocById } from "@/lib/firestore-helpers";
import { db } from "@/lib/firebase";
import { notifyUsers } from "@/lib/notifications";
import { Group, Inquiry, InquiryMessage, InquiryStatus, Lesson, Profile, StudentProfile, Unit } from "@/lib/types";
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

export default function TeacherInquiriesPage() {
  const { user, profile } = useAuth();
  const { stageId, stageName } = useWorkspace();
  const [inquiryIdFromUrl, setInquiryIdFromUrl] = useState<string | null>(null);
  const teacher = profile as Profile | null;
  const [inquiries, setInquiries] = useState<InquiryWithId[]>([]);
  const [profiles, setProfiles] = useState<Record<string, StudentProfile>>({});
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [units, setUnits] = useState<Record<string, Unit>>({});
  const [lessons, setLessons] = useState<Record<string, Lesson>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageWithId[]>([]);
  const [filter, setFilter] = useState<InquiryStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
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
    const unsubscribe = onSnapshot(
      collection(db, "inquiries"),
      (snapshot) => setInquiries(snapshot.docs.map((item) => ({ ...(item.data() as Inquiry), id: item.id })).sort((a, b) => b.lastMessageAt - a.lastMessageAt)),
      (error) => showToast(`تعذّر تحميل أسئلة الطلاب: ${error.message}`, "error")
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "profiles"), (snapshot) => {
        const next: Record<string, StudentProfile> = {};
        snapshot.docs.filter((item) => item.data().role === "student").forEach((item) => { next[item.id] = { ...(item.data() as StudentProfile), uid: item.id }; });
        setProfiles(next);
      }),
      onSnapshot(collection(db, "groups"), (snapshot) => {
        const next: Record<string, Group> = {};
        snapshot.docs.forEach((item) => { next[item.id] = { ...(item.data() as Group), id: item.id }; });
        setGroups(next);
      }),
      onSnapshot(collection(db, "units"), (snapshot) => {
        const next: Record<string, Unit> = {};
        snapshot.docs.forEach((item) => { next[item.id] = { ...(item.data() as Unit), id: item.id }; });
        setUnits(next);
      }),
      onSnapshot(collection(db, "lessons"), (snapshot) => {
        const next: Record<string, Lesson> = {};
        snapshot.docs.forEach((item) => { next[item.id] = { ...(item.data() as Lesson), id: item.id }; });
        setLessons(next);
      }),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, []);

  const visibleInquiries = useMemo(() => inquiries.filter((inquiry) => {
    const student = profiles[inquiry.studentId];
    const matchesStage = !stageId || inquiry.stageId === stageId;
    const matchesFilter = filter === "all" || inquiry.status === filter;
    const needle = search.trim().toLowerCase();
    const haystack = `${inquiry.title} ${inquiry.studentName} ${student?.fullName ?? ""}`.toLowerCase();
    return matchesStage && matchesFilter && (!needle || haystack.includes(needle));
  }), [inquiries, profiles, stageId, filter, search]);

  const groupNamesFor = (inquiry: InquiryWithId) => {
    const studentGroupIds = profiles[inquiry.studentId]?.groupIds ?? inquiry.groupIds ?? [];
    return studentGroupIds.map((id) => groups[id]?.name).filter(Boolean).join("، ") || "دون مجموعة";
  };

  useEffect(() => {
    if (inquiryIdFromUrl && inquiries.some((item) => item.id === inquiryIdFromUrl)) setSelectedId(inquiryIdFromUrl);
  }, [inquiryIdFromUrl, inquiries]);

  const selectedInquiry = inquiries.find((item) => item.id === selectedId) ?? null;
  const unreadCount = inquiries.filter((item) => item.status === "new" && (!stageId || item.stageId === stageId)).length;

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    const selected = inquiries.find((item) => item.id === selectedId);
    if (selected?.status === "new") {
      updateDocById("inquiries", selected.id, { status: "viewed", updatedAt: Date.now() }).catch(() => {});
    }
    const unsubscribe = onSnapshot(
      collection(db, "inquiries", selectedId, "messages"),
      (snapshot) => setMessages(snapshot.docs.map((item) => ({ ...(item.data() as InquiryMessage), id: item.id })).sort((a, b) => a.createdAt - b.createdAt)),
      (error) => showToast(`تعذّر تحميل سجل المحادثة: ${error.message}`, "error")
    );
    return () => unsubscribe();
  }, [selectedId, inquiries]);

  const getAttachmentLink = async () => {
    return attachmentUrl.trim() ? { url: attachmentUrl.trim(), name: "رابط مرفق" } : null;
  };

  const sendReply = async () => {
    if (!selectedInquiry || !user || !teacher || sending || !reply.trim()) return;
    setSending(true);
    try {
      const uploaded = await getAttachmentLink();
      const now = Date.now();
      await createDoc(`inquiries/${selectedInquiry.id}/messages`, {
        senderId: user.uid,
        senderRole: teacher.role === "admin" ? "admin" : "teacher",
        senderName: teacher.fullName,
        body: reply.trim(),
        ...(uploaded ? { attachmentUrl: uploaded.url, attachmentName: uploaded.name } : {}),
        createdAt: now,
      });
      await updateDocById("inquiries", selectedInquiry.id, { status: "answered", updatedAt: now, lastMessageAt: now, lastMessageBy: teacher.role === "admin" ? "admin" : "teacher" });
      await notifyUsers([selectedInquiry.studentId], { type: "inquiry-reply", title: `تم الرد على سؤالك: ${selectedInquiry.title}`, body: reply.trim(), link: `/student/inquiries?inquiryId=${selectedInquiry.id}` });
      setReply("");
      setAttachmentUrl("");
      showToast("تم إرسال الرد للطالب ✅");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "تعذّر إرسال الرد.", "error");
    } finally {
      setSending(false);
    }
  };

  const resolveInquiry = async () => {
    if (!selectedInquiry || sending) return;
    setSending(true);
    try {
      await updateDocById("inquiries", selectedInquiry.id, { status: "resolved", updatedAt: Date.now(), lastMessageAt: Date.now(), lastMessageBy: "teacher" });
      await notifyUsers([selectedInquiry.studentId], { type: "inquiry-resolved", title: `تم حل سؤالك: ${selectedInquiry.title}`, body: "يمكنك فتح السؤال للاطلاع على المحادثة.", link: `/student/inquiries?inquiryId=${selectedInquiry.id}` });
      showToast("تم تحديد الاستفسار كمحلول ✅");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "تعذّر تحديث الحالة.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell requireRole="teacher">
      <div className="flex items-start justify-between gap-3 mb-6"><div><h1 className="text-2xl font-bold text-brand-text">أسئلة الطلاب <span className="text-sm align-middle px-2 py-1 rounded-full bg-brand-warning/15 text-brand-warning">{unreadCount} جديد</span></h1><p className="text-sm text-brand-textMuted mt-1">القسم الحالي: {stageName ?? "—"}</p></div><MessageCircle size={28} className="text-brand-primary" /></div>
      <GlassCard className="mb-5 p-4">
        <div className="relative mb-4">
          <Search size={16} className="absolute right-3 top-3 text-brand-textMuted" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث باسم الطالب أو عنوان السؤال" className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-brand-primary/25 bg-surface/70 text-sm" />
        </div>
        <FilterChipsBar
          active={filter}
          onChange={(f) => setFilter(f as any)}
          options={[
            { value: "all", label: "الكل", count: inquiries.filter(i => !stageId || i.stageId === stageId).length },
            { value: "new", label: "جديد", count: inquiries.filter(i => i.status === "new" && (!stageId || i.stageId === stageId)).length },
            { value: "answered", label: "تم الرد", count: inquiries.filter(i => i.status === "answered" && (!stageId || i.stageId === stageId)).length },
            { value: "resolved", label: "تم الحل", count: inquiries.filter(i => i.status === "resolved" && (!stageId || i.stageId === stageId)).length },
          ]}
        />
      </GlassCard>

      {!selectedInquiry ? (
        <GlassCard className="!p-0 overflow-hidden mb-36">
          <div className="flex flex-col">
            {visibleInquiries.map((inquiry) => {
              const lesson = inquiry.lessonId ? lessons[inquiry.lessonId] : null;
              const unit = lesson?.unitId ? units[lesson.unitId] : null;
              
              return (
                <CompactListRow
                  key={inquiry.id}
                  avatarLabel={inquiry.studentName?.[0] ?? "?"}
                  title={inquiry.studentName}
                  subtitle={`${inquiry.title} · ${unit ? unit.title + " - " : ""}${lesson ? lesson.title : "منصة عامة"}`}
                  onClick={() => setSelectedId(inquiry.id)}
                  badge={
                    <StatusBadge
                      label={statusLabels[inquiry.status]}
                      tone={inquiry.status === "new" ? "warning" : inquiry.status === "answered" ? "success" : inquiry.status === "resolved" ? "muted" : "primary"}
                    />
                  }
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] text-brand-textMuted">{formatDate(inquiry.lastMessageAt)}</span>
                      <ActionsDropdown
                        actions={[
                          { label: "فتح المحادثة", icon: <MessageCircle className="w-4 h-4" />, onClick: () => setSelectedId(inquiry.id) },
                          inquiry.status !== "resolved" ? { label: "تحديد كمحلول", icon: <CheckCircle2 className="w-4 h-4 text-brand-success" />, onClick: () => { setSelectedId(inquiry.id); resolveInquiry(); } } : null,
                        ].filter(Boolean) as any}
                      />
                    </div>
                  }
                />
              );
            })}
            {visibleInquiries.length === 0 && (
              <p className="text-center text-brand-textMuted py-12 text-sm">لا توجد استفسارات مطابقة.</p>
            )}
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="mb-6"><div className="flex items-start justify-between gap-3 border-b border-surfaceBorder pb-4 mb-4"><div><h2 className="font-bold text-brand-text">{selectedInquiry.title}</h2><p className="text-xs text-brand-textMuted mt-1">الطالب: {selectedInquiry.studentName} · {selectedInquiry.lessonId && lessons[selectedInquiry.lessonId] ? `الدرس: ${lessons[selectedInquiry.lessonId].title}` : "دون درس محدد"}</p></div><div className="flex items-center gap-2"><span className={`px-2.5 py-1 rounded-lg text-xs ${statusStyles[selectedInquiry.status]}`}>{statusLabels[selectedInquiry.status]}</span><button onClick={() => setSelectedId(null)} aria-label="إغلاق" className="text-brand-textMuted"><X size={18} /></button></div></div><div className="flex flex-col gap-3 max-h-[52vh] overflow-y-auto mb-4">{messages.map((message) => <div key={message.id} className={`max-w-[88%] rounded-2xl p-3 ${message.senderRole === "student" ? "self-start bg-brand-primary/10" : "self-end bg-surfaceBorder/50"}`}><p className="text-xs text-brand-primary font-bold mb-1">{message.senderName}</p><p className="text-sm text-brand-text whitespace-pre-wrap">{message.body}</p>{message.attachmentUrl && <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-primary underline mt-2 inline-block">📎 {message.attachmentName ?? "فتح المرفق"}</a>}<p className="text-[10px] text-brand-textMuted mt-2">{formatDate(message.createdAt)}</p></div>)}</div>{selectedInquiry.status !== "resolved" ? (
            <div className="flex flex-col gap-3 bg-surfaceBorder/20 p-4 rounded-2xl">
              <textarea 
                value={reply} 
                onChange={(event) => setReply(event.target.value)} 
                placeholder="اكتب ردك الواضح والنهائي للطالب..." 
                rows={3} 
                className="w-full px-4 py-3 rounded-xl border border-brand-primary/20 bg-surface/80 focus:bg-surface outline-none transition-all" 
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="text-xs text-brand-textMuted flex items-center gap-2 flex-1 min-w-[150px]">
                  <Paperclip size={14} />
                  <input dir="ltr" value={attachmentUrl} onChange={(event) => setAttachmentUrl(event.target.value)} placeholder="رابط مرفق اختياري" className="w-full bg-transparent border-b border-brand-primary/20 outline-none text-[11px]" />
                </label>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <Button onClick={sendReply} disabled={sending || !reply.trim()} className="flex-1 md:flex-none">
                    <Send size={15} className="ml-2" /> إرسال الرد
                  </Button>
                  <button 
                    onClick={resolveInquiry} 
                    disabled={sending} 
                    className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-brand-success text-white text-sm font-bold flex items-center justify-center gap-1 hover:bg-brand-success/90 transition-colors shadow-sm"
                  >
                    <CheckCircle2 size={15} /> تم الحل وإغلاق السؤال
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-brand-secondary/5 border border-brand-secondary/20 rounded-2xl p-4 text-center">
              <p className="text-sm text-brand-secondary font-bold flex items-center justify-center gap-2">
                <CheckCircle2 size={18} /> تم حل هذا السؤال وإغلاقه
              </p>
            </div>
          )}</GlassCard>
      )}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </AppShell>
  );
}
