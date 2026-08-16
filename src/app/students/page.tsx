"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { addDoc, collection, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Modal, ConfirmDialog, Toast } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import ActionsDropdown from "@/components/ui/ActionsDropdown";
import {
  listenCollection,
  updateDocById,
  orderBy,
} from "@/lib/firestore-helpers";
import { StudentProfile, Stage, Group } from "@/lib/types";
import { phoneToEmail, normalizePhone } from "@/lib/phone";
import { computeLevel } from "@/lib/gamification";
import { publishResultsShare, setShareEnabled, computeStudentReportSnapshot, StudentReportSnapshot } from "@/lib/shareResults";
import { exportHtmlToPdf, downloadOrShareFile } from "@/lib/pdfExport";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function randomPassword() {
  return Math.random().toString(36).slice(-8);
}

const PLATFORM_URL =
  typeof window !== "undefined" ? window.location.origin : "";
const REPORT_TEACHER_NAME = "الأستاذ مهند علاوي";

function toReportBullets(value: string, fallback: string) {
  const items = value
    .split(/[\n.!؟؛]+/)
    .map((item) => item.replace(/^[\s•\-–—]+|[\s•\-–—]+$/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return items.length > 0 ? items : [fallback];
}

type StudentBackupRecord = {
  uid?: string;
  fullName: string;
  phone: string;
  username?: string;
  address?: string;
  studentNumber?: string;
  stageId?: string;
  groupIds?: string[];
  status?: "active" | "disabled" | "deleted";
  points?: number;
  mustChangePassword?: boolean;
  level?: string;
  guardianName?: string;
  guardianPhone?: string;
  notes?: string;
  createdAt?: number;
};

type RestorePreview = {
  fileName: string;
  students: StudentBackupRecord[];
  invalidCount: number;
  duplicateCount: number;
};

type RestoreResult = {
  created: number;
  updated: number;
  failed: number;
  credentials: { fullName: string; phone: string; password: string }[];
  errors: { row: number; phone?: string; message: string }[];
};

function downloadJson(fileName: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function StudentsPage() {
  const [students, setStudents] = useState<(StudentProfile & { id: string })[]>([]);
  const [stages, setStages] = useState<(Stage & { id: string })[]>([]);
  const [groups, setGroups] = useState<(Group & { id: string })[]>([]);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    address: "",
    stageId: "",
    groupId: "",
    password: randomPassword(),
  });
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [pdfNotesTarget, setPdfNotesTarget] = useState<(StudentProfile & { id: string }) | null>(null);
  const [pdfTeacherNotes, setPdfTeacherNotes] = useState("");
  const [pdfTeacherPhone, setPdfTeacherPhone] = useState("");
  const [pdfReady, setPdfReady] = useState<{ student: StudentProfile & { id: string }; file: File } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [credentialsModal, setCredentialsModal] = useState<{
    fullName: string;
    phone: string;
    password: string;
  } | null>(null);

  const [editing, setEditing] = useState<(StudentProfile & { id: string }) | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", address: "", stageId: "", groupId: "" });

  const [deleteTarget, setDeleteTarget] = useState<(StudentProfile & { id: string }) | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<(StudentProfile & { id: string }) | null>(null);
  const [passwordInfoTarget, setPasswordInfoTarget] = useState<(StudentProfile & { id: string }) | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [permanentlyDeleting, setPermanentlyDeleting] = useState(false);
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [restoring, setRestoring] = useState(false);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  const { user, profile } = useAuth();
  const { stageId: workspaceStageId, stageName: workspaceStageName } = useWorkspace();

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const u1 = listenCollection<StudentProfile>(
      "profiles",
      [],
      (all) => setStudents(all.filter((p) => p.role === "student") as any)
    );
    const u2 = listenCollection<Stage>("stages", [orderBy("order")], setStages);
    const u3 = listenCollection<Group>("groups", [], setGroups);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  const handleExportStudents = () => {
    if (students.length === 0) {
      showToast("لا يوجد طلاب لتصديرهم", "error");
      return;
    }
    const backup = {
      format: "english-hub-students",
      version: 1,
      exportedAt: new Date().toISOString(),
      note: "هذا الملف لا يحتوي على كلمات المرور. الحسابات الجديدة عند الاستعادة تحصل على كلمات مرور مؤقتة.",
      students: students.map((student) => ({
        uid: student.id,
        fullName: student.fullName,
        phone: student.phone || student.username || "",
        username: student.username,
        address: student.address || "",
        studentNumber: student.studentNumber,
        stageId: student.stageId,
        groupIds: student.groupIds || [],
        status: student.status,
        points: student.points || 0,
        mustChangePassword: student.mustChangePassword !== false,
        level: student.level,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        notes: student.notes,
        createdAt: student.createdAt,
      })),
    };
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`english-hub-students-${date}.json`, backup);
    showToast(`تم تنزيل نسخة احتياطية لـ ${students.length} طالب ✅`);
  };

  const handleRestoreFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const rawStudents = Array.isArray(parsed) ? parsed : parsed?.students;
      if (!Array.isArray(rawStudents)) throw new Error("صيغة الملف غير صحيحة");

      const uniqueByPhone = new Map<string, StudentBackupRecord>();
      let invalidCount = 0;
      let duplicateCount = 0;
      for (const raw of rawStudents) {
        const fullName = typeof raw?.fullName === "string" ? raw.fullName.trim() : "";
        const phone = normalizePhone(typeof raw?.phone === "string" ? raw.phone : typeof raw?.username === "string" ? raw.username : "");
        if (!fullName || !phone) {
          invalidCount += 1;
          continue;
        }
        if (uniqueByPhone.has(phone)) {
          duplicateCount += 1;
          continue;
        }
        uniqueByPhone.set(phone, {
          uid: typeof raw?.uid === "string" ? raw.uid : undefined,
          fullName,
          phone,
          username: phone,
          address: typeof raw?.address === "string" ? raw.address : "",
          studentNumber: typeof raw?.studentNumber === "string" ? raw.studentNumber : undefined,
          stageId: typeof raw?.stageId === "string" ? raw.stageId : undefined,
          groupIds: Array.isArray(raw?.groupIds) ? raw.groupIds.filter((id: unknown): id is string => typeof id === "string") : [],
          status: raw?.status === "disabled" ? "disabled" : raw?.status === "deleted" ? "deleted" : "active",
          points: typeof raw?.points === "number" ? raw.points : 0,
          mustChangePassword: raw?.mustChangePassword !== false,
          level: typeof raw?.level === "string" ? raw.level : undefined,
          guardianName: typeof raw?.guardianName === "string" ? raw.guardianName : undefined,
          guardianPhone: typeof raw?.guardianPhone === "string" ? raw.guardianPhone : undefined,
          notes: typeof raw?.notes === "string" ? raw.notes : undefined,
          createdAt: typeof raw?.createdAt === "number" ? raw.createdAt : undefined,
        });
      }

      const validStudents = Array.from(uniqueByPhone.values());
      if (validStudents.length === 0) throw new Error("لم يتم العثور على سجلات طلاب صالحة");
      setRestorePreview({ fileName: file.name, students: validStudents, invalidCount, duplicateCount });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "تعذر قراءة ملف JSON", "error");
    }
  };

  const handleRestoreStudents = async () => {
    if (!restorePreview || !user || restoring) return;
    setRestoring(true);
    try {
      const token = await user.getIdToken(true);
      const response = await fetch("/api/admin/restore-students", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ students: restorePreview.students }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "تعذر استعادة الطلاب");
      setRestorePreview(null);
      setRestoreResult(data as RestoreResult);
      showToast(`تمت الاستعادة: ${data.created ?? 0} جديد و${data.updated ?? 0} محدث ✅`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "تعذر استعادة الطلاب", "error");
    } finally {
      setRestoring(false);
    }
  };

  const handleCreate = async () => {
    if (!form.fullName.trim() || !form.phone.trim() || !workspaceStageId) {
      showToast("الاسم ورقم الهاتف إلزاميان (وتأكد من اختيار القسم من القائمة الجانبية)", "error");
      return;
    }
    if (form.password.length < 6) {
      showToast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");
      return;
    }
    setCreating(true);
    const password = form.password;
    const phone = normalizePhone(form.phone);
    const email = phoneToEmail(phone, "student");

    const secondaryApp = initializeApp(firebaseConfig, `student-create-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const studentNumber = `STU-${Date.now().toString().slice(-6)}`;
      await setDoc(doc(db, "profiles", cred.user.uid), {
        uid: cred.user.uid,
        fullName: form.fullName,
        role: "student",
        username: phone,
        phone,
        address: form.address || "",
        studentNumber,
        stageId: workspaceStageId,
        groupIds: form.groupId ? [form.groupId] : [],
        status: "active",
        points: 0,
        mustChangePassword: true,
        createdAt: Date.now(),
      } as StudentProfile);
      setCredentialsModal({ fullName: form.fullName, phone, password });
      setForm({ fullName: "", phone: "", address: "", stageId: "", groupId: "", password: randomPassword() });
      showToast("تم إنشاء حساب الطالب بنجاح ✅");
    } catch (e: any) {
      const msg =
        e.code === "auth/email-already-in-use"
          ? "رقم الهاتف هذا مستخدم بالفعل لحساب طالب آخر"
          : e.message ?? "خطأ غير معروف";
      showToast("تعذر إنشاء الحساب: " + msg, "error");
    } finally {
      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);
      setCreating(false);
    }
  };

  const openEdit = (s: StudentProfile & { id: string }) => {
    setEditing(s);
    setEditForm({
      fullName: s.fullName,
      address: s.address ?? "",
      stageId: s.stageId ?? "",
      groupId: s.groupIds?.[0] ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.fullName.trim() || !editForm.stageId) {
      showToast("الاسم والمرحلة حقول إلزامية", "error");
      return;
    }
    await updateDocById("profiles", editing.id, {
      fullName: editForm.fullName,
      address: editForm.address,
      stageId: editForm.stageId,
      groupIds: editForm.groupId ? [editForm.groupId] : [],
    });
    showToast("تم تحديث بيانات الطالب ✅");
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await updateDocById("profiles", deleteTarget.id, { status: "deleted" });
    showToast(`تم نقل الطالب "${deleteTarget.fullName}" إلى سلة المهملات`);
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget || !user) return;
    setPermanentlyDeleting(true);
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch("/api/admin/delete-student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          uid: permanentDeleteTarget.uid || permanentDeleteTarget.id,
          profileId: permanentDeleteTarget.id,
          phone: permanentDeleteTarget.phone || permanentDeleteTarget.username || "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error ?? "تعذّر الحذف النهائي", "error");
        return;
      }
      showToast(`تم حذف الطالب "${permanentDeleteTarget.fullName}" نهائيًا`);
      setPermanentDeleteTarget(null);
      setShowDeleted(true);
    } catch {
      showToast("تعذّر الاتصال بالخادم، حاول مجددًا", "error");
    } finally {
      setPermanentlyDeleting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!passwordInfoTarget || !user) return;
    if (newPasswordValue.trim().length < 6) {
      showToast("كلمة المرور يجب أن تكون 6 أحرف/أرقام على الأقل", "error");
      return;
    }
    setResettingPassword(true);
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          uid: passwordInfoTarget.uid || passwordInfoTarget.id,
          profileId: passwordInfoTarget.id,
          phone: passwordInfoTarget.phone || passwordInfoTarget.username || "",
          newPassword: newPasswordValue.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.error ?? "تعذّر تغيير كلمة المرور", "error");
        return;
      }
      showToast(`تم تغيير كلمة مرور "${passwordInfoTarget.fullName}" ✅`);
      setPasswordInfoTarget(null);
      setNewPasswordValue("");
    } catch {
      showToast("تعذّر الاتصال بالخادم، حاول مجددًا", "error");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleRestore = async (s: StudentProfile & { id: string }) => {
    await updateDocById("profiles", s.id, { status: "active" });
    showToast("تم استرجاع الطالب ✅");
  };

  const handleShare = async (student: StudentProfile & { id: string }) => {
    if (!user) return;
    setSharingId(student.id);
    try {
      const token = await publishResultsShare(student.id, user.uid);
      const link = `${window.location.origin}/share/${token}`;
      setShareLink(link);
      setShareToken(token);
      await navigator.clipboard?.writeText(link).catch(() => {});
      showToast("تم نسخ رابط المشاركة ✅");
    } catch (e: any) {
      showToast("تعذر إنشاء رابط المشاركة: " + (e.message ?? "خطأ غير معروف"), "error");
    } finally {
      setSharingId(null);
    }
  };

  // تصدير كشف نتائج PDF لمشاركته مع الأهل — نفس طريقة علاوي نت بالضبط:
  // بنعبّي قالب مخفي خارج الشاشة ببيانات الطالب، وبعدين نحوّله لصورة عالية
  // الدقة (html2canvas) وندمجها بملف PDF (jsPDF). هاي الطريقة ضرورية هون
  // لأنه jsPDF نفسه ما بيدعم رسم الخط العربي، فلازم نمرّ عبر محرك عرض
  // النصوص تبع المتصفح نفسه حتى يطلع العربي صحيح مش مربعات فاضية.
  const [pdfExportTarget, setPdfExportTarget] = useState<
    (StudentProfile & {
      id: string;
      report: StudentReportSnapshot;
      teacherNotes: string;
      reportMeta: {
        teacherName: string;
        teacherPhone: string;
        creatorName: string;
        creatorPhone: string;
        issuedAt: number;
      };
    }) | null
  >(null);
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null);

  const handleExportPdf = (student: StudentProfile & { id: string }) => {
    setPdfNotesTarget(student);
    setPdfTeacherNotes("");
    setPdfTeacherPhone("");
  };

  const generatePdfReport = async () => {
    const student = pdfNotesTarget;
    if (!student || exportingPdfId || !user) return;
    const teacherPhone = normalizePhone(pdfTeacherPhone);
    if (!teacherPhone) {
      showToast("أدخل رقم التواصل الخاص بالأستاذ مهند علاوي", "error");
      return;
    }
    setExportingPdfId(student.id);
    try {
      const report = await computeStudentReportSnapshot(student.id);
      const creatorName = profile?.fullName || user.displayName || "مستخدم النظام";
      const creatorPhone = profile?.phone || "";
      const reportMeta = {
        teacherName: REPORT_TEACHER_NAME,
        teacherPhone,
        creatorName,
        creatorPhone,
        issuedAt: Date.now(),
      };

      setPdfExportTarget({
        ...student,
        report,
        teacherNotes: pdfTeacherNotes.trim(),
        reportMeta,
      });
      setPdfNotesTarget(null);
      await new Promise((resolve) => setTimeout(resolve, 80));
      const element = document.getElementById("student-pdf-template");
      if (!element) throw new Error("تعذّر تجهيز قالب التقرير");
      const file = await exportHtmlToPdf(element, `تقرير-${student.fullName}.pdf`);
      setPdfReady({ student, file });

      await addDoc(collection(db, "activity_logs"), {
        type: "student_report_generated",
        action: "generate_student_report",
        studentId: student.id,
        studentName: student.fullName,
        stageName: report.stageName,
        groupName: report.groupName,
        createdBy: user.uid,
        createdByName: creatorName,
        createdByPhone: creatorPhone,
        teacherName: REPORT_TEACHER_NAME,
        teacherPhone,
        issuedAt: reportMeta.issuedAt,
        createdAt: reportMeta.issuedAt,
      }).catch(() => {
        // لا نعطل تنزيل التقرير إذا كانت القواعد القديمة لم تُنشر بعد.
      });

      showToast("تم إنشاء تقرير PDF منظم وحفظ بيانات الإصدار ✅");
    } catch (error: any) {
      showToast("تعذر إنشاء PDF: " + (error?.message ?? "خطأ غير معروف"), "error");
    } finally {
      setExportingPdfId(null);
      setPdfExportTarget(null);
    }
  };

  const shareGeneratedPdf = async () => {
    if (!pdfReady) return;
    await downloadOrShareFile(pdfReady.file);
    showToast("اختر واتساب من نافذة المشاركة لإرسال الملف مباشرة ✅");
  };

  const openWhatsappForPdf = () => {
    if (!pdfReady) return;
    const phone = normalizePhone(pdfReady.student.guardianPhone ?? "");
    const message = `مرحباً، أرفقت لكم تقرير نتائج الطالب ${pdfReady.student.fullName}. يرجى مراجعة التقرير المرفق.`;
    const url = phone ? `https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    showToast("تم فتح واتساب. أرفق ملف PDF الذي تم تنزيله.");
  };

  const buildWhatsappMessage = (fullName: string, phone: string, password: string) => {
    const text =
      `مرحباً ${fullName}،\n\n` +
      `تم إنشاء حسابك في المنصة التعليمية.\n\n` +
      `بيانات الدخول:\n` +
      `رقم الهاتف: ${phone}\n` +
      `كلمة المرور: ${password}\n\n` +
      `يمكنك الدخول إلى المنصة باستخدام هذه البيانات.\n\n` +
      `رابط المنصة:\n${PLATFORM_URL}/login`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const copyCredentials = async (fullName: string, phone: string, password: string) => {
    const text = `الاسم: ${fullName}\nرقم الهاتف: ${phone}\nكلمة المرور: ${password}\nرابط المنصة: ${PLATFORM_URL}/login`;
    await navigator.clipboard?.writeText(text).catch(() => {});
    showToast("تم نسخ بيانات الدخول ✅");
  };

  const visibleStudents = students.filter(
    (s) =>
      s.stageId === workspaceStageId &&
      (showDeleted ? s.status === "deleted" : s.status !== "deleted")
  );
  const filtered = visibleStudents.filter(
    (s) =>
      s.fullName.includes(search) ||
      s.username?.includes(search) ||
      s.studentNumber?.includes(search)
  );

  const activeCount = students.filter((s) => s.status === "active").length;

  return (
    <AppShell requireRole="teacher">
      <div className="rounded-glass bg-gradient-to-br from-brand-sidebar via-brand-sidebar to-brand-primary/40 text-white p-6 mb-6 shadow-glass">
        <p className="text-white/60 text-xs mb-1">إدارة الطلاب</p>
        <h1 className="text-2xl font-bold mb-4">{workspaceStageName ?? "—"}</h1>
        <div className="flex items-center gap-6 border-t border-white/10 pt-4">
          <div>
            <p className="text-white/60 text-xs mb-0.5">طلاب نشطون</p>
            <p className="text-2xl font-bold text-brand-goldLight">{activeCount}</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div>
            <p className="text-white/60 text-xs mb-0.5">إجمالي المسجّلين</p>
            <p className="text-2xl font-bold text-brand-goldLight">{students.length}</p>
          </div>
        </div>
      </div>

      {shareLink && (
        <GlassCard className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-brand-text font-medium mb-1">
              ✅ رابط مشاركة النتائج جاهز (تم نسخه تلقائيًا)
            </p>
            <a href={shareLink} target="_blank" rel="noreferrer" dir="ltr"
              className="text-brand-primary text-sm break-all">
              {shareLink}
            </a>
            <p className="text-xs text-brand-textMuted mt-1">
              أرسل هذا الرابط لولي الأمر — يفتحه بدون تسجيل دخول ويشوف بس النتائج (بدون كلمة مرور أو بيانات حساسة).
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <button
              onClick={async () => {
                if (!shareToken) return;
                await setShareEnabled(shareToken, false);
                setShareLink(null);
                setShareToken(null);
              }}
              className="text-brand-error text-xs whitespace-nowrap"
            >
              إيقاف المشاركة
            </button>
            <button onClick={() => setShareLink(null)} className="text-brand-textMuted text-xs">✕ إغلاق</button>
          </div>
        </GlassCard>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-1 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white text-lg shrink-0">
              👤
            </div>
            <h2 className="font-bold text-brand-text">إضافة طالب جديد</h2>
          </div>
          <div
            className="flex flex-col gap-3"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !(e.target as HTMLElement).closest("select")) {
                e.preventDefault();
                handleCreate();
              }
            }}
          >
            <input
              placeholder="الاسم الكامل"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
            />
            <input
              placeholder="رقم هاتف الطالب"
              dir="ltr"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
            />
            <input
              placeholder="العنوان (اختياري)"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
            />
            <div className="px-3 py-2 rounded-xl bg-brand-primary/10 text-brand-primary text-sm">
              القسم: {workspaceStageName ?? "—"}
            </div>
            <select
              value={form.groupId}
              onChange={(e) => setForm({ ...form, groupId: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
            >
              <option value="">بدون مجموعة (اختياري)</option>
              {groups
                .filter((g) => g.stageId === workspaceStageId)
                .map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
            </select>

            <div>
              <label className="text-xs text-brand-textMuted block mb-1">كلمة المرور</label>
              <div className="flex gap-2">
                <input
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="px-2 text-xs text-brand-textMuted shrink-0"
                >
                  {showPassword ? "إخفاء" : "إظهار"}
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, password: randomPassword() })}
                  className="px-2 text-xs text-brand-primary shrink-0"
                  title="توليد كلمة مرور عشوائية"
                >
                  🎲
                </button>
              </div>
              <p className="text-xs text-brand-textMuted mt-1">
                يمكنك كتابة كلمة مرور خاصة بك أو استخدام المولّدة تلقائيًا.
              </p>
            </div>

            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "جاري الإنشاء..." : "إنشاء حساب الطالب"}
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="font-bold text-brand-text">
                قائمة الطلاب ({filtered.length})
              </h2>
              <p className="text-[11px] text-brand-textMuted mt-1">النسخة الاحتياطية تشمل بيانات الطلاب فقط ولا تشمل كلمات المرور.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportStudents}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-brand-primary border border-brand-primary/25 hover:bg-brand-primary/10"
              >
                تنزيل نسخة JSON
              </button>
              <button
                onClick={() => restoreFileInputRef.current?.click()}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-brand-primary hover:bg-brand-secondary"
              >
                استعادة من JSON
              </button>
              <input
                ref={restoreFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleRestoreFileChange}
                className="hidden"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-brand-textMuted">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
              />
              عرض المحذوفين
            </label>
          </div>

          <div className="relative mb-4">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-textMuted text-sm pointer-events-none">
              🔍
            </span>
            <input
              placeholder="بحث بالاسم أو رقم الهاتف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-brand-primary/25 bg-surface/70 text-sm"
            />
          </div>

          <div className="flex flex-col gap-3">
            {filtered.map((s) => {
              const stageName = stages.find((st) => st.id === s.stageId)?.name ?? "—";
              const accent =
                s.status === "active"
                  ? "border-r-4 border-r-brand-success"
                  : s.status === "deleted"
                  ? "border-r-4 border-r-brand-textMuted"
                  : "border-r-4 border-r-brand-error";
              return (
                <div
                  key={s.id}
                  className={`flex flex-col gap-3 rounded-2xl border border-surfaceBorder/60 ${accent} bg-surface/60 p-4 sm:flex-row sm:items-center sm:justify-between hover:shadow-md active:scale-[0.99] transition-all`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary font-extrabold text-white text-lg ring-2 ring-surface shadow-md">
                      {s.fullName?.[0] ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-brand-text">{s.fullName}</p>
                      <p className="truncate text-xs text-brand-textMuted" dir="ltr">
                        {s.phone ?? s.username}
                      </p>
                      <p className="truncate text-xs text-brand-textMuted">
                        {stageName} · {s.points ?? 0} نقطة · {computeLevel(s.points ?? 0).name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0">
                    <StatusBadge
                      label={s.status === "active" ? "نشط" : s.status === "deleted" ? "محذوف" : "معطّل"}
                      tone={s.status === "active" ? "success" : s.status === "deleted" ? "muted" : "error"}
                    />
                    {s.status === "deleted" ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestore(s)}
                          className="text-brand-success text-xs font-semibold px-2"
                        >
                          ↩ استرجاع
                        </button>
                        <button
                          onClick={() => setPermanentDeleteTarget(s)}
                          disabled={permanentlyDeleting}
                          className="text-brand-error text-xs font-semibold px-2 disabled:opacity-50"
                        >
                          🗑 حذف نهائي
                        </button>
                      </div>
                    ) : (
                      <ActionsDropdown
                        actions={[
                          { label: "تعديل بيانات الطالب", icon: <span>✎</span>, onClick: () => openEdit(s) },
                          {
                            label: s.status === "active" ? "تعطيل الحساب" : "تفعيل الحساب",
                            icon: <span>{s.status === "active" ? "⏸" : "▶️"}</span>,
                            onClick: () =>
                              updateDocById("profiles", s.id, {
                                status: s.status === "active" ? "disabled" : "active",
                              }),
                          },
                          {
                            label: "تغيير كلمة المرور",
                            icon: <span>🔑</span>,
                            onClick: () => setPasswordInfoTarget(s),
                          },
                          {
                            label: sharingId === s.id ? "جارٍ إنشاء الرابط..." : "مشاركة النتائج (رابط)",
                            icon: <span>🔗</span>,
                            onClick: () => handleShare(s),
                          },
                          {
                            label: exportingPdfId === s.id ? "جارٍ التصدير..." : "تصدير تقرير PDF",
                            icon: <span>🖨</span>,
                            onClick: () => handleExportPdf(s),
                          },
                          {
                            label: "حذف الطالب",
                            icon: <span>🗑</span>,
                            onClick: () => setDeleteTarget(s),
                            danger: true,
                          },
                        ]}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-brand-textMuted py-6">
                {showDeleted ? "لا يوجد طلاب محذوفون." : "لا يوجد طلاب بعد."}
              </p>
            )}
          </div>
        </GlassCard>
      </div>

      <Modal
        open={!!pdfNotesTarget}
        onClose={() => !exportingPdfId && setPdfNotesTarget(null)}
        title="ملاحظات المعلم قبل إصدار التقرير"
        maxWidth="max-w-lg"
      >
        {pdfNotesTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-brand-text">أدخل رقم تواصل الأستاذ، ثم اكتب ملاحظات مختصرة وواضحة عن الطالب لتظهر في التقرير المرسل إلى الأهل.</p>
            <div>
              <label className="block text-sm text-brand-text mb-1.5">رقم تواصل الأستاذ مهند علاوي</label>
              <input
                autoFocus
                type="tel"
                dir="ltr"
                value={pdfTeacherPhone}
                onChange={(event) => setPdfTeacherPhone(event.target.value)}
                placeholder="مثال: 009639xxxxxxxx"
                className="w-full px-3 py-2.5 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text"
              />
              <p className="text-xs text-brand-textMuted mt-1.5">سيظهر الرقم بجانب زر واتساب داخل التقرير.</p>
            </div>
            <div>
              <label className="block text-sm text-brand-text mb-1.5">ملاحظات المعلم</label>
              <textarea
                value={pdfTeacherNotes}
                onChange={(event) => setPdfTeacherNotes(event.target.value)}
                rows={5}
                placeholder="مثال: الطالب ملتزم بالحضور، ويحتاج إلى مراجعة أزمنة الأفعال."
                className="w-full px-3 py-3 rounded-xl border border-brand-primary/25 bg-surface/70 text-brand-text"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setPdfNotesTarget(null)} disabled={!!exportingPdfId} className="px-4 py-2 rounded-xl text-sm border border-brand-primary/25 text-brand-text">إلغاء</button>
              <button type="button" onClick={generatePdfReport} disabled={!!exportingPdfId} className="px-4 py-2 rounded-xl text-sm text-white bg-brand-primary disabled:opacity-50">{exportingPdfId ? "جارٍ تجهيز التقرير..." : "إنشاء تقرير PDF"}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!pdfReady}
        onClose={() => setPdfReady(null)}
        title="تقرير الطالب جاهز"
        maxWidth="max-w-lg"
      >
        {pdfReady && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-brand-text">تم إنشاء تقرير <strong>{pdfReady.student.fullName}</strong>. يمكنك مشاركته مباشرة من الهاتف أو فتح واتساب ثم إرفاق الملف.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={shareGeneratedPdf} className="px-4 py-2.5 rounded-xl text-sm text-white bg-brand-primary">مشاركة ملف PDF</button>
              <button type="button" onClick={openWhatsappForPdf} className="px-4 py-2.5 rounded-xl text-sm text-white bg-brand-success">فتح واتساب</button>
              <button type="button" onClick={() => setPdfReady(null)} className="px-4 py-2.5 rounded-xl text-sm border border-brand-primary/25 text-brand-text">إغلاق</button>
            </div>
            <p className="text-xs text-brand-textMuted">في الهاتف اختر واتساب من نافذة المشاركة لإرفاق الملف مباشرة. في الكمبيوتر سيُنزل الملف، ثم استخدم زر فتح واتساب لإرفاقه يدوياً.</p>
          </div>
        )}
      </Modal>

      <Modal
        open={!!credentialsModal}
        onClose={() => setCredentialsModal(null)}
        title="مشاركة بيانات الدخول"
      >
        {credentialsModal && (
          <div className="flex flex-col gap-3">
            <p className="text-brand-text text-sm">
              تم إنشاء حساب <strong>{credentialsModal.fullName}</strong> بنجاح. شارك بيانات الدخول التالية معه:
            </p>
            <div className="bg-brand-primary/5 rounded-xl p-4 text-sm flex flex-col gap-1.5" dir="ltr">
              <p className="text-brand-text"><strong>Phone:</strong> {credentialsModal.phone}</p>
              <p className="text-brand-text"><strong>Password:</strong> {credentialsModal.password}</p>
            </div>
            <p className="text-xs text-brand-textMuted">
              دوّن كلمة المرور الآن — لن تظهر مجددًا بهذا الوضوح لاحقًا.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() =>
                  copyCredentials(
                    credentialsModal.fullName,
                    credentialsModal.phone,
                    credentialsModal.password
                  )
                }
              >
                📋 نسخ بيانات الدخول
              </Button>
              <a
                href={buildWhatsappMessage(
                  credentialsModal.fullName,
                  credentialsModal.phone,
                  credentialsModal.password
                )}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-2xl text-sm font-medium bg-brand-success text-white hover:opacity-90 inline-flex items-center"
              >
                📱 مشاركة عبر واتساب
              </a>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="تعديل بيانات الطالب">
        <div
          className="flex flex-col gap-3"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !(e.target as HTMLElement).closest("select")) {
              e.preventDefault();
              saveEdit();
            }
          }}
        >
          <input
            placeholder="الاسم الكامل"
            value={editForm.fullName}
            onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
          />
          <input
            placeholder="العنوان"
            value={editForm.address}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
          />
          <select
            value={editForm.stageId}
            onChange={(e) => setEditForm({ ...editForm, stageId: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
          >
            <option value="">اختر المرحلة</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={editForm.groupId}
            onChange={(e) => setEditForm({ ...editForm, groupId: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
          >
            <option value="">بدون مجموعة</option>
            {groups
              .filter((g) => g.stageId === editForm.stageId)
              .map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
          </select>
          <p className="text-xs text-brand-textMuted">
            رقم الهاتف (اسم الدخول) وكلمة المرور لا يمكن تعديلهما من هنا — استخدم زر "🔑 كلمة المرور" بجدول الطلاب.
          </p>
          <Button onClick={saveEdit}>حفظ التعديلات</Button>
        </div>
      </Modal>

      <Modal
        open={!!passwordInfoTarget}
        onClose={() => {
          setPasswordInfoTarget(null);
          setNewPasswordValue("");
        }}
        title="تغيير كلمة المرور"
      >
        {passwordInfoTarget && (
          <div className="flex flex-col gap-4 text-sm text-brand-text">
            <p>
              كلمة مرور جديدة للطالب <span className="font-medium">&quot;{passwordInfoTarget.fullName}&quot;</span>.
              بيقدر يسجّل دخول فورًا بالكلمة الجديدة.
            </p>
            <div>
              <label className="text-sm text-brand-text block mb-1.5">كلمة المرور الجديدة</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  autoFocus
                  minLength={6}
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-primary/25 bg-surface/70 focus:bg-surface outline-none pl-12"
                  placeholder="6 أحرف/أرقام على الأقل"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-textMuted text-xs"
                  tabIndex={-1}
                >
                  {showPassword ? "إخفاء" : "إظهار"}
                </button>
              </div>
            </div>
            <Button onClick={handleResetPassword} disabled={resettingPassword} className="w-full">
              {resettingPassword ? "جاري الحفظ..." : "حفظ كلمة المرور الجديدة"}
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        open={!!restorePreview}
        onClose={() => !restoring && setRestorePreview(null)}
        title="تأكيد استعادة الطلاب"
        maxWidth="max-w-lg"
      >
        <div className="flex flex-col gap-4">
          <p className="text-brand-text">
            الملف <strong>{restorePreview?.fileName}</strong> جاهز للاستعادة.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-brand-primary/10 p-3"><strong className="block text-lg text-brand-primary">{restorePreview?.students.length ?? 0}</strong>سجل صالح</div>
            <div className="rounded-xl bg-brand-warning/10 p-3"><strong className="block text-lg text-brand-warning">{restorePreview?.duplicateCount ?? 0}</strong>مكرر</div>
            <div className="rounded-xl bg-brand-error/10 p-3"><strong className="block text-lg text-brand-error">{restorePreview?.invalidCount ?? 0}</strong>غير صالح</div>
          </div>
          <p className="text-sm text-brand-textMuted">
            سيتم تحديث الحسابات الموجودة بنفس رقم الهاتف، وإنشاء الحسابات المفقودة. الحسابات الجديدة ستظهر كلمات مرور مؤقتة بعد انتهاء الاستعادة.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setRestorePreview(null)} disabled={restoring} className="px-4 py-2 rounded-xl text-sm border border-brand-primary/25 text-brand-text">إلغاء</button>
            <button onClick={handleRestoreStudents} disabled={restoring} className="px-4 py-2 rounded-xl text-sm text-white bg-brand-primary disabled:opacity-50">
              {restoring ? "جارٍ الاستعادة..." : "تأكيد الاستعادة"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!restoreResult}
        onClose={() => setRestoreResult(null)}
        title="نتيجة استعادة الطلاب"
        maxWidth="max-w-lg"
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-brand-success/10 p-3"><strong className="block text-lg text-brand-success">{restoreResult?.created ?? 0}</strong>حساب جديد</div>
            <div className="rounded-xl bg-brand-primary/10 p-3"><strong className="block text-lg text-brand-primary">{restoreResult?.updated ?? 0}</strong>محدث</div>
            <div className="rounded-xl bg-brand-error/10 p-3"><strong className="block text-lg text-brand-error">{restoreResult?.failed ?? 0}</strong>فشل</div>
          </div>
          {(restoreResult?.credentials.length ?? 0) > 0 && (
            <>
              <p className="text-sm text-brand-textMuted">كلمات المرور التالية مؤقتة للحسابات الجديدة فقط. نزّلها واحفظها بأمان؛ لن تظهر مرة أخرى بعد إغلاق هذه النافذة.</p>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-surfaceBorder p-2 text-sm">
                {restoreResult?.credentials.slice(0, 30).map((credential) => (
                  <div key={credential.phone} className="flex items-center justify-between gap-3 px-2 py-1.5 border-b border-surfaceBorder last:border-0">
                    <span className="truncate text-brand-text">{credential.fullName}</span>
                    <span dir="ltr" className="font-mono text-brand-primary shrink-0">{credential.phone} / {credential.password}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => downloadJson(`english-hub-restored-credentials-${new Date().toISOString().slice(0, 10)}.json`, { createdAt: new Date().toISOString(), credentials: restoreResult?.credentials ?? [] })}
                className="px-4 py-2 rounded-xl text-sm text-white bg-brand-primary"
              >
                تنزيل كلمات المرور كملف JSON
              </button>
            </>
          )}
          {(restoreResult?.errors.length ?? 0) > 0 && <p className="text-sm text-brand-error">عدد السجلات التي لم تستعد: {restoreResult?.errors.length}</p>}
          <button onClick={() => setRestoreResult(null)} className="self-end px-4 py-2 rounded-xl text-sm border border-brand-primary/25 text-brand-text">إغلاق</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="نقل الطالب إلى سلة المهملات"
        message={`هل أنت متأكد من نقل الطالب "${deleteTarget?.fullName ?? ""}" إلى سلة المهملات؟ سيتم إخفاؤه وإيقاف دخوله، ويمكن استرجاعه لاحقًا.`}
        confirmLabel="نقل إلى السلة"
      />

      <ConfirmDialog
        open={!!permanentDeleteTarget}
        onClose={() => setPermanentDeleteTarget(null)}
        onConfirm={handlePermanentDelete}
        title="حذف نهائي لا يمكن التراجع عنه"
        message={`سيتم حذف الطالب "${permanentDeleteTarget?.fullName ?? ""}" نهائيًا من Firebase Authentication وFirestore وحذف بياناته التابعة. بعد ذلك يمكن إنشاء حساب جديد بنفس رقم الهاتف. هل تريد المتابعة؟`}
        confirmLabel="حذف نهائي"
      />

      {/* قالب PDF مخفي؛ يُرسم داخل المتصفح حتى تظهر العربية والرسوم بشكل صحيح. */}
      {pdfExportTarget && (
        <div style={{ position: "fixed", left: -99999, top: 0 }}>
          <div id="student-pdf-template" style={{ position: "relative", width: 816, minHeight: 1056, boxSizing: "border-box", padding: "42px 48px", overflow: "hidden", background: "#ffffff", fontFamily: "Cairo, sans-serif", direction: "rtl", color: "#111827" }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 0 }}>
              <div style={{ transform: "rotate(-32deg)", color: "#556B2F", opacity: 0.075, fontSize: 54, fontWeight: 800, whiteSpace: "nowrap", letterSpacing: 1 }}>الأستاذ مهند علاوي</div>
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ height: 8, background: "#556B2F", borderRadius: 8, marginBottom: 22 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
                <div>
                  <p style={{ color: "#111827", fontSize: 22, fontWeight: 800, letterSpacing: 1, margin: 0 }}>ENGLISH HUB</p>
                  <p style={{ color: "#556B2F", fontSize: 13, fontWeight: 700, margin: "5px 0 0" }}>{REPORT_TEACHER_NAME}</p>
                  <h1 style={{ color: "#111827", fontSize: 26, fontWeight: 800, margin: "18px 0 5px" }}>تقرير تقدم الطالب</h1>
                  <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>متابعة تعليمية مختصرة وواضحة</p>
                </div>
                <div style={{ width: 116, height: 116, borderRadius: "50%", background: `conic-gradient(#556B2F ${pdfExportTarget.report.completionPercentage * 3.6}deg, #edf1e8 0deg)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ width: 88, height: 88, borderRadius: "50%", background: "#ffffff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#111827" }}>
                    <strong style={{ color: "#556B2F", fontSize: 25, lineHeight: 1 }}>{pdfExportTarget.report.completionPercentage}%</strong>
                    <span style={{ color: "#6b7280", fontSize: 11, marginTop: 7 }}>نسبة التقدم</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 24 }}>
                {[
                  ["اسم الطالب", pdfExportTarget.fullName],
                  ["المجموعة", pdfExportTarget.report.groupName || "غير محددة"],
                  ["الصف", pdfExportTarget.report.stageName || "غير محدد"],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: "#f7f8f5", border: "1px solid #dfe5d7", borderRadius: 10, padding: "12px 13px", minHeight: 62 }}>
                    <p style={{ color: "#6b7280", fontSize: 10, margin: 0 }}>{label}</p>
                    <p style={{ color: "#111827", fontSize: 14, fontWeight: 800, margin: "6px 0 0", overflowWrap: "anywhere" }}>{value}</p>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 20, padding: 16, borderRadius: 12, border: "1px solid #dfe5d7", background: "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#111827", fontSize: 13, fontWeight: 800 }}>
                  <span>نسبة التقدم في الدروس</span>
                  <span style={{ color: "#556B2F" }}>{pdfExportTarget.report.lessonsCompleted} من {pdfExportTarget.report.lessonsTotal}</span>
                </div>
                <div style={{ height: 16, background: "#edf1e8", borderRadius: 10, marginTop: 12, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pdfExportTarget.report.completionPercentage}%`, background: "#556B2F", borderRadius: 10 }} />
                </div>
                <p style={{ color: "#6b7280", fontSize: 11, margin: "9px 0 0" }}>النسبة محسوبة من الدروس المكتملة مقارنةً بإجمالي دروس الصف.</p>
              </div>

              <div style={{ marginTop: 20 }}>
                <h2 style={{ color: "#556B2F", fontSize: 17, fontWeight: 800, margin: "0 0 9px", borderRight: "4px solid #a63d40", paddingRight: 9 }}>نتائج الاختبارات</h2>
                <ul style={{ margin: 0, paddingRight: 22, color: "#111827", fontSize: 12, lineHeight: 1.8 }}>
                  {pdfExportTarget.report.quizResults.length === 0 ? (
                    <li>لا توجد نتائج اختبارات مسجلة حتى الآن.</li>
                  ) : pdfExportTarget.report.quizResults.slice(0, 6).map((result, index) => {
                    const pending = result.status === "pending-review";
                    const percentage = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;
                    return <li key={`${result.title}-${index}`} style={{ marginBottom: 7 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span style={{ width: 165, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.title}</span>
                        <div style={{ flex: 1, height: 9, background: "#edf1e8", borderRadius: 8, overflow: "hidden" }}><div style={{ height: "100%", width: `${pending ? 0 : percentage}%`, background: pending ? "#a63d40" : "#556B2F", borderRadius: 8 }} /></div>
                        <strong style={{ minWidth: 44, color: pending ? "#a63d40" : "#556B2F", textAlign: "left" }}>{pending ? "مراجعة" : `${percentage}%`}</strong>
                      </div>
                    </li>;
                  })}
                </ul>
              </div>

              <div style={{ marginTop: 20, padding: 15, borderRadius: 12, background: "#f7f8f5", borderRight: "5px solid #a63d40" }}>
                <h2 style={{ color: "#111827", fontSize: 16, fontWeight: 800, margin: "0 0 8px" }}>ملاحظات المعلم</h2>
                <ul style={{ margin: 0, paddingRight: 21, color: "#111827", fontSize: 12, lineHeight: 1.9 }}>
                  {toReportBullets(pdfExportTarget.teacherNotes, "لا توجد ملاحظات مضافة لهذا التقرير.").map((note, index) => <li key={`${note}-${index}`}>{note}</li>)}
                </ul>
              </div>

              <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "#ffffff", border: "1px solid #dfe5d7" }}>
                <h2 style={{ color: "#556B2F", fontSize: 15, fontWeight: 800, margin: "0 0 8px" }}>للتواصل مع الأستاذ</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#111827", fontSize: 13 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#25D366" /><path fill="#ffffff" d="M16.7 13.9c-.2-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.5.1-.1.2-.5.7-.6.8-.1.1-.2.1-.4 0-1.1-.5-1.9-1-2.6-2.1-.2-.4.2-.4.5-1.2.1-.2 0-.3-.1-.4-.1-.1-.5-1.2-.7-1.6-.2-.5-.4-.4-.4-.4-.1 0-.3.1-.4.2-.4.2-.7.6-.7 1.4 0 .8.6 1.6.7 1.7.1.1 1.2 1.9 3 2.6 1.1.5 1.5.5 2.1.4.3 0 .9-.4 1.1-.7.1-.3.2-.6.1-.7-.1-.1-.2-.1-.5-.2z" /></svg>
                  <span>واتساب الأستاذ مهند علاوي:</span>
                  <a dir="ltr" href={`https://wa.me/${pdfExportTarget.reportMeta.teacherPhone.replace(/[^0-9]/g, "")}`} style={{ color: "#a63d40", fontWeight: 800, textDecoration: "none" }}>{pdfExportTarget.reportMeta.teacherPhone}</a>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #dfe5d7", marginTop: 22, paddingTop: 12, textAlign: "center" }}>
                <p style={{ color: "#556B2F", fontSize: 11, margin: 0 }}>ENGLISH HUB — متابعة واضحة تساعد الطالب على التطور والنجاح.</p>
                <p style={{ color: "#6b7280", fontSize: 10, margin: "6px 0 0" }}>تم إصدار التقرير بتاريخ: {new Date(pdfExportTarget.reportMeta.issuedAt).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </AppShell>
  );
}
