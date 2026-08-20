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
import { CompactListRow } from "@/components/ui/CompactListRow";
import { FilterChipsBar } from "@/components/ui/FilterChipsBar";
import {
  listenCollection,
  updateDocById,
  orderBy,
} from "@/lib/firestore-helpers";
import { User, Key, FileText, Trash2, RotateCcw, ShieldAlert } from "lucide-react";
import { StudentProfile, Stage, Group } from "@/lib/types";
import { phoneToEmail, normalizePhone } from "@/lib/phone";
import { computeLevel } from "@/lib/gamification";
import { publishResultsShare, setShareEnabled, computeStudentReportSnapshot, StudentReportSnapshot } from "@/lib/shareResults";
import { exportHtmlToPdf, downloadOrShareFile } from "@/lib/pdfExport";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { formatSyrianDate } from "@/lib/dateUtils";

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
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled" | "deleted">("all");
  // تم إزالة مشاركة الروابط نهائياً بناءً على طلب المستخدم
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
      setShowAddModal(false);
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
        const error = data?.error ?? "تعذّر الحذف النهائي";
        if (error.includes("إعدادات Firebase Admin")) {
          showToast("يجب إضافة ملف Service Account في Vercel لتفعيل الحذف النهائي", "error");
        } else {
          showToast(error, "error");
        }
        return;
      }
      showToast(`تم حذف الطالب "${permanentDeleteTarget.fullName}" نهائيًا`);
      setPermanentDeleteTarget(null);
      setStatusFilter("deleted");
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

  // تمت إزالة دالة مشاركة الروابط نهائياً

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
    const savedPhone = typeof window !== "undefined" ? localStorage.getItem("english_hub_teacher_phone") ?? "" : "";
    setPdfTeacherPhone(savedPhone);
  };

  const generatePdfReport = async () => {
    const student = pdfNotesTarget;
    if (!student || exportingPdfId || !user) return;
    const teacherPhone = normalizePhone(pdfTeacherPhone);
    if (!teacherPhone) {
      showToast("أدخل رقم التواصل الخاص بالأستاذ مهند علاوي", "error");
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("english_hub_teacher_phone", teacherPhone);
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

  // 1) تنزيل مباشر — بدون أي محاولة مشاركة أو واتساب إطلاقًا
  const downloadGeneratedPdf = async () => {
    if (!pdfReady) return;
    await downloadOrShareFile(pdfReady.file);
    showToast("تم تنزيل التقرير ✅");
  };

  // 2) مشاركة عبر نافذة المشاركة الأصلية لنظام التشغيل (OS Share Sheet) —
  // الطالب/المعلم يختار هو الوجهة (واتساب، تيليجرام، إيميل، إلخ)، بدون أي
  // فرض مسبق. قبل هذا التعديل، لو الجهاز/المتصفح ما بيدعم navigator.share
  // بالملفات، كانت الدالة تسقط تلقائيًا لتنزيل + فتح واتساب بالإجبار —
  // هلق إذا مش مدعومة، منقول للمستخدم بوضوح ونقترح زر "تنزيل" بدلها.
  const shareGeneratedPdf = async () => {
    if (!pdfReady) return;
    if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [pdfReady.file] })) {
      try {
        await navigator.share({
          files: [pdfReady.file],
          title: `تقرير الطالب ${pdfReady.student.fullName}`,
          text: `مرحباً، مرفق لكم تقرير نتائج الطالب ${pdfReady.student.fullName} من منصة English Hub.`,
        });
        showToast("تمت مشاركة الملف بنجاح ✅");
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.error("Share error:", err);
          showToast("تعذّرت المشاركة، جرّب زر التنزيل بدلاً منها.");
        }
      }
      return;
    }
    showToast("المشاركة المباشرة غير مدعومة على هذا الجهاز — استخدم زر التنزيل.");
  };

  // 3) فتح واتساب — خيار صريح ومنفصل يختاره المستخدم بنفسه (مش fallback
  // إجباري جوّا زر تاني). ينزّل الملف أولاً (لازم يكون بالجهاز حتى يقدر
  // المستخدم يرفقه يدويًا بواتساب، لأن واتساب ويب ما بيقبل إرفاق ملف عبر
  // رابط مباشر) وبعدين يفتح محادثة واتساب بنص جاهز.
  const openWhatsappForPdf = async () => {
    if (!pdfReady) return;
    await downloadOrShareFile(pdfReady.file);
    const phone = normalizePhone(pdfReady.student.guardianPhone ?? "");
    const message = `مرحباً، أرفقت لكم تقرير نتائج الطالب ${pdfReady.student.fullName}. يرجى مراجعة التقرير المرفق.`;
    const url = phone ? `https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    showToast("تم تنزيل التقرير وفتح واتساب. قم بإرفاق ملف PDF المحمّل يدويًا.");
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
      (statusFilter === "all" ? s.status !== "deleted" : s.status === statusFilter)
  );
  const filtered = visibleStudents.filter(
    (s) =>
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.username?.includes(search) ||
      s.phone?.includes(search) ||
      s.studentNumber?.includes(search)
  );

  const stageStudents = students.filter((s) => s.stageId === workspaceStageId && s.status !== "deleted");
  const activeCount = stageStudents.filter((s) => s.status === "active").length;

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
            <p className="text-2xl font-bold text-brand-goldLight">{stageStudents.length}</p>
          </div>
        </div>
      </div>

      {/* تم إزالة شريط مشاركة الرابط نهائياً */}

      <div className="grid gap-6">
        <GlassCard>
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
          </div>

          <Button className="w-full mb-3" onClick={() => setShowAddModal(true)}>إضافة طالب جديد</Button>

          <FilterChipsBar
            active={statusFilter}
            onChange={(val) => setStatusFilter(val as any)}
            options={[
              { value: "all", label: "الكل", count: students.filter(s => s.stageId === workspaceStageId && s.status !== "deleted").length },
              { value: "active", label: "نشط", count: students.filter(s => s.stageId === workspaceStageId && s.status === "active").length },
              { value: "disabled", label: "معطّل", count: students.filter(s => s.stageId === workspaceStageId && s.status === "disabled").length },
              { value: "deleted", label: "محذوف", count: students.filter(s => s.stageId === workspaceStageId && s.status === "deleted").length },
            ]}
          />

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

          <div className="flex flex-col mb-36">
            {filtered.map((s) => {
              const stageName = stages.find((st) => st.id === s.stageId)?.name ?? "—";
              const groupName = groups.find((g) => s.groupIds?.includes(g.id))?.name ?? "بدون مجموعة";
              
              return (
                <CompactListRow
                  key={s.id}
                  avatarLabel={s.fullName?.[0] ?? "?"}
                  title={s.fullName}
                  subtitle={<span dir="rtl">المجموعة: <bdi>{groupName}</bdi> · <bdi dir="ltr">{s.phone ?? s.username ?? "—"}</bdi> · <bdi>{s.points ?? 0} نقطة</bdi></span>}
                  badge={
                    <StatusBadge
                      label={s.status === "active" ? "نشط" : s.status === "deleted" ? "محذوف" : "معطّل"}
                      tone={s.status === "active" ? "success" : s.status === "deleted" ? "muted" : "error"}
                    />
                  }
                  trailing={
                    <ActionsDropdown
                      actions={[
                        { label: "تعديل بيانات الطالب", icon: <User className="w-4 h-4" />, onClick: () => openEdit(s) },
                        {
                          label: s.status === "active" ? "تعطيل الحساب" : "تفعيل الحساب",
                          icon: s.status === "active" ? <ShieldAlert className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4 text-brand-success" />,
                          onClick: () =>
                            updateDocById("profiles", s.id, {
                              status: s.status === "active" ? "disabled" : "active",
                            }),
                        },
                        {
                          label: "تغيير كلمة المرور",
                          icon: <Key className="w-4 h-4" />,
                          onClick: () => setPasswordInfoTarget(s),
                        },
                        {
                          label: exportingPdfId === s.id ? "جارٍ التصدير..." : "تصدير تقرير PDF",
                          icon: <FileText className="w-4 h-4" />,
                          onClick: () => handleExportPdf(s),
                        },
                        s.status === "deleted" ? {
                          label: "استرجاع الطالب",
                          icon: <RotateCcw className="w-4 h-4 text-brand-success" />,
                          onClick: () => handleRestore(s),
                        } : {
                          label: "حذف الطالب",
                          icon: <Trash2 className="w-4 h-4" />,
                          onClick: () => setDeleteTarget(s),
                          variant: "danger",
                        },
                        s.status === "deleted" ? {
                          label: "حذف نهائي",
                          icon: <Trash2 className="w-4 h-4" />,
                          onClick: () => setPermanentDeleteTarget(s),
                          variant: "danger",
                        } : null,
                      ].filter(Boolean) as any}
                    />
                  }
                />
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-brand-textMuted py-12 text-sm">
                لا يوجد طلاب يطابقون هذا البحث أو الفلتر.
              </p>
            )}
          </div>
        </GlassCard>
      </div>

      <Modal
        open={showAddModal}
        onClose={() => !creating && setShowAddModal(false)}
        title="إضافة طالب جديد"
      >
        <div
          className="flex flex-col gap-3"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !(e.target as HTMLElement).closest("select")) {
              e.preventDefault();
              handleCreate();
            }
          }}
        >
          <input placeholder="الاسم الكامل" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
          <input placeholder="رقم هاتف الطالب" dir="ltr" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
          <input placeholder="العنوان (اختياري)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
          <div className="px-3 py-2 rounded-xl bg-brand-primary/10 text-brand-primary text-sm">القسم: {workspaceStageName ?? "—"}</div>
          <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70">
            <option value="">بدون مجموعة (اختياري)</option>
            {groups.filter((g) => g.stageId === workspaceStageId).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <div>
            <label className="text-xs text-brand-textMuted block mb-1">كلمة المرور</label>
            <div className="flex gap-2">
              <input type={showPassword ? "text" : "password"} dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="flex-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="px-2 text-xs text-brand-textMuted shrink-0">{showPassword ? "إخفاء" : "إظهار"}</button>
              <button type="button" onClick={() => setForm({ ...form, password: randomPassword() })} className="px-2 text-xs text-brand-primary shrink-0" title="توليد كلمة مرور عشوائية">🎲</button>
            </div>
            <p className="text-xs text-brand-textMuted mt-1">يمكنك كتابة كلمة مرور خاصة بك أو استخدام المولّدة تلقائيًا.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" type="button" onClick={() => setShowAddModal(false)} disabled={creating}>إلغاء</Button>
            <Button size="sm" onClick={handleCreate} disabled={creating}>{creating ? "جاري الإنشاء..." : "إنشاء حساب الطالب"}</Button>
          </div>
        </div>
      </Modal>

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
            <div className="flex flex-wrap justify-end gap-3">
              <Button size="sm" variant="secondary" type="button" onClick={() => setPdfNotesTarget(null)} disabled={!!exportingPdfId}>إلغاء</Button>
              <Button size="sm" type="button" onClick={generatePdfReport} disabled={!!exportingPdfId}>{exportingPdfId ? "جارٍ تجهيز التقرير..." : "إنشاء تقرير PDF"}</Button>
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
            <p className="text-sm text-brand-text">تم إنشاء تقرير <strong>{pdfReady.student.fullName}</strong>. اختر طريقة الحفظ أو المشاركة المناسبة.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" type="button" onClick={downloadGeneratedPdf}>تنزيل الملف</Button>
              <Button size="sm" variant="secondary" type="button" onClick={shareGeneratedPdf}>مشاركة (اختر التطبيق)</Button>
              <Button size="sm" variant="success" type="button" onClick={openWhatsappForPdf}>فتح واتساب</Button>
              <Button size="sm" variant="secondary" type="button" onClick={() => setPdfReady(null)}>إغلاق</Button>
            </div>
            <p className="text-xs text-brand-textMuted">"تنزيل" يحفظ الملف على جهازك مباشرة. "مشاركة" تفتح قائمة تطبيقاتك لاختيار الوجهة بنفسك. "فتح واتساب" اختصار مباشر لواتساب فقط إذا هو وجهتك المقصودة.</p>
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
          <div className="flex flex-wrap justify-end gap-3">
            <Button size="sm" variant="secondary" onClick={() => setRestorePreview(null)} disabled={restoring}>إلغاء</Button>
            <Button size="sm" onClick={handleRestoreStudents} disabled={restoring}>
              {restoring ? "جارٍ الاستعادة..." : "تأكيد الاستعادة"}
            </Button>
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
              <Button
                size="sm"
                onClick={() => downloadJson(`english-hub-restored-credentials-${new Date().toISOString().slice(0, 10)}.json`, { createdAt: new Date().toISOString(), credentials: restoreResult?.credentials ?? [] })}
              >
                تنزيل كلمات المرور كملف JSON
              </Button>
            </>
          )}
          {(restoreResult?.errors.length ?? 0) > 0 && <p className="text-sm text-brand-error">عدد السجلات التي لم تستعد: {restoreResult?.errors.length}</p>}
          <Button size="sm" variant="secondary" onClick={() => setRestoreResult(null)} className="self-end">إغلاق</Button>
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
          <div id="student-pdf-template" style={{ position: "relative", width: "794px", minHeight: "1123px", boxSizing: "border-box", padding: "45px 50px 35px", overflow: "hidden", background: "#ffffff", fontFamily: "var(--font-arabic), Cairo, Tahoma, sans-serif", direction: "rtl", color: "#111827", wordSpacing: "normal", letterSpacing: "normal", fontKerning: "normal", border: "2px solid #556B4F", borderRadius: "12px" }}>
            {/* العلامة المائية: هادئة، مائلة، وبشفافية خفيفة (تم رفعها قليلاً لتكون ظاهرة) */}
            <div style={{ position: "absolute", zIndex: 0, pointerEvents: "none", userSelect: "none", color: "#556B4F", opacity: 0.08, fontSize: "46px", fontWeight: 800, transform: "rotate(-28deg)", whiteSpace: "nowrap", right: "-20mm", bottom: "60mm" }}>
              الأستاذ مهند علاوي
            </div>

            <div style={{ position: "relative", zIndex: 2 }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", marginBottom: "35px" }}>
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: "#111827", fontSize: "22px", fontWeight: 900, letterSpacing: "0.5px", margin: 0 }}>ENGLISH HUB</p>
                  <p style={{ color: "#6B7280", fontSize: "11px", margin: "4px 0 0" }}>منصة تعليمية متكاملة لتعلم اللغة الإنجليزية</p>
                  <p style={{ color: "#556B4F", fontSize: "13px", fontWeight: 700, margin: "6px 0 0" }}>الأستاذ مهند علاوي</p>
                  <h1 style={{ color: "#111827", fontSize: "27px", fontWeight: 800, margin: "22px 0 4px" }}>تقرير تقدم الطالب</h1>
                  <p style={{ color: "#6B7280", fontSize: "11px", margin: 0 }}>متابعة تعليمية دقيقة، نتائج واضحة، وتقدم مستمر</p>
                </div>
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ width: "48px", height: "48px", margin: "0 auto 8px", borderRadius: "50%", background: "#556B4F", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <strong style={{ display: "block", color: "#556B4F", fontSize: "38px", fontWeight: 900, lineHeight: 1 }}>{pdfExportTarget.report.completionPercentage}%</strong>
                  <span style={{ display: "block", color: "#6B7280", fontSize: "11px", marginTop: "6px" }}>نسبة التقدم الإجمالية</span>
                </div>
              </div>

              {/* معلومات الطالب */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#556B4F", fontSize: "16px", fontWeight: 800, marginBottom: "12px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span style={{ borderBottom: "3px solid #B33A3A", paddingBottom: "5px", display: "inline-block" }}>معلومات الطالب</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", background: "#FFFDF8", border: "1px solid #DDE4D8", borderRadius: "10px", overflow: "hidden", marginBottom: "30px" }}>
                {[
                  ["اسم الطالب", pdfExportTarget.fullName],
                  ["المجموعة", pdfExportTarget.report.groupName || "—"],
                  ["الصف", pdfExportTarget.report.stageName || "—"],
                ].map(([label, value], idx) => (
                  <div key={label} style={{ padding: "15px 18px", borderLeft: idx < 2 ? "1px solid #DDE4D8" : "none" }}>
                    <p style={{ color: "#6B7280", fontSize: "11px", margin: 0 }}>{label}</p>
                    <p style={{ color: "#111827", fontSize: "15px", fontWeight: 800, margin: "6px 0 0" }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* نسبة التقدم في الدروس */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#556B4F", fontSize: "16px", fontWeight: 800, marginBottom: "12px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                <span style={{ borderBottom: "3px solid #B33A3A", paddingBottom: "5px", display: "inline-block" }}>نسبة التقدم في الدروس</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "35px", padding: "22px", border: "1px solid #DDE4D8", borderRadius: "12px", background: "#ffffff", marginBottom: "30px" }}>
                <div style={{ position: "relative", width: "115px", height: "115px", flexShrink: 0 }}>
                  <svg width="115" height="115" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="50" cy="50" r="42" fill="transparent" stroke="#E9EEE5" strokeWidth="12" />
                    <circle cx="50" cy="50" r="42" fill="transparent" stroke="#556B4F" strokeWidth="12" strokeDasharray="263.89" strokeDashoffset={263.89 - (263.89 * pdfExportTarget.report.completionPercentage) / 100} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                    <strong style={{ color: "#556B4F", fontSize: "15px", lineHeight: 1.1 }}>{pdfExportTarget.report.lessonsCompleted} من {pdfExportTarget.report.lessonsTotal}</strong>
                    <strong style={{ color: "#556B4F", fontSize: "16px", marginTop: "3px" }}>{pdfExportTarget.report.completionPercentage}%</strong>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#556B4F", fontSize: "15px", fontWeight: 800, margin: "0 0 8px" }}>
                    {pdfExportTarget.report.completionPercentage === 100 ? "أنت على المسار الصحيح!" : "استمر في التقدم!"}
                  </p>
                  <p style={{ color: "#374151", fontSize: "13px", margin: "0 0 15px" }}>
                    {pdfExportTarget.report.completionPercentage === 100 ? "لقد أتممت جميع الدروس بنجاح." : `لقد أتممت ${pdfExportTarget.report.lessonsCompleted} من أصل ${pdfExportTarget.report.lessonsTotal} دروس.`}
                  </p>
                  <div style={{ width: "100%", height: "11px", background: "#E9EEE5", borderRadius: "20px", overflow: "hidden", marginBottom: "12px" }}>
                    <div style={{ height: "100%", width: `${pdfExportTarget.report.completionPercentage}%`, background: "#556B4F", borderRadius: "20px" }} />
                  </div>
                  <ul style={{ margin: 0, paddingRight: "18px", color: "#6B7280", fontSize: "11px", lineHeight: 1.7 }}>
                    <li>عدد الدروس المكتملة محسوب بناءً على إجمالي الدروس المتاحة.</li>
                    <li>استمر في التعلم لتحقيق المزيد من التقدم والتميز.</li>
                  </ul>
                </div>
              </div>

              {/* نتائج الاختبارات المفصلة بالتواريخ */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#556B4F", fontSize: "16px", fontWeight: 800, marginBottom: "12px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                <span style={{ borderBottom: "3px solid #B33A3A", paddingBottom: "5px", display: "inline-block" }}>سجل تفاصيل الاختبارات والواجبات</span>
              </div>
              <div style={{ border: "1px solid #DDE4D8", borderRadius: "12px", overflow: "hidden", marginBottom: "30px", background: "#ffffff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "right" }}>
                  <thead>
                    <tr style={{ background: "#556B4F", color: "#ffffff" }}>
                      <th style={{ padding: "10px 14px", fontWeight: 700 }}>اسم الاختبار / الواجب</th>
                      <th style={{ padding: "10px 14px", fontWeight: 700 }}>التاريخ</th>
                      <th style={{ padding: "10px 14px", fontWeight: 700 }}>النتيجة</th>
                      <th style={{ padding: "10px 14px", fontWeight: 700 }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pdfExportTarget.report.quizResults && pdfExportTarget.report.quizResults.length > 0 ? (
                      pdfExportTarget.report.quizResults.map((item, index) => (
                        <tr key={index} style={{ borderBottom: "1px solid #E9EEE5", background: index % 2 === 0 ? "#ffffff" : "#FAFAFA" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: "#111827" }}>{item.title}</td>
                          <td style={{ padding: "10px 14px", color: "#6B7280" }}>{item.date ? formatSyrianDate(item.date) : "—"}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 800, color: "#556B4F" }}>{item.score} / {item.maxScore}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700, background: item.status === "graded" || item.status === "submitted" ? "#E9EEE5" : "#FEF3C7", color: item.status === "graded" || item.status === "submitted" ? "#556B4F" : "#D97706" }}>
                              {item.status === "graded" ? "مصحح" : item.status === "submitted" ? "مسلم" : "بانتظار المراجعة"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ padding: "15px", textAlign: "center", color: "#6B7280" }}>لا توجد اختبارات مسجلة بعد.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* ملاحظات المعلم */}
              {pdfExportTarget.teacherNotes.trim() && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#556B4F", fontSize: "16px", fontWeight: 800, marginBottom: "12px" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B33A3A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    <span style={{ borderBottom: "3px solid #B33A3A", paddingBottom: "5px", display: "inline-block" }}>ملاحظات المعلم</span>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B33A3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "auto" }}><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  </div>
                  <div style={{ padding: "18px 22px", background: "#FCFCFA", borderRight: "4px solid #B33A3A", borderRadius: "12px", marginBottom: "30px" }}>
                    <ul style={{ margin: 0, paddingRight: "20px", color: "#111827", fontSize: "13px", lineHeight: 2 }}>
                      {toReportBullets(pdfExportTarget.teacherNotes, "").map((note, idx) => <li key={idx}>{note}</li>)}
                    </ul>
                  </div>
                </>
              )}

              {/* التواصل مع الأستاذ */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#556B4F", fontSize: "16px", fontWeight: 800, marginBottom: "12px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.79 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.18-2.18a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                <span style={{ borderBottom: "3px solid #B33A3A", paddingBottom: "5px", display: "inline-block" }}>للتواصل مع الأستاذ</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", border: "1px solid #DDE4D8", borderRadius: "12px", background: "#ffffff", marginBottom: "35px" }}>
                <div>
                  <p style={{ color: "#111827", fontSize: "14px", fontWeight: 800, margin: 0 }}>الأستاذ مهند علاوي</p>
                  <p style={{ color: "#B33A3A", fontSize: "12px", fontWeight: 700, margin: "4px 0 0" }}>تواصل عبر واتساب</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#25D366" /><path fill="#ffffff" d="M16.7 13.9c-.2-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.5.1-.1.2-.5.7-.6.8-.1.1-.2.1-.4 0-1.1-.5-1.9-1-2.6-2.1-.2-.4.2-.4.5-1.2.1-.2 0-.3-.1-.4-.1-.1-.5-1.2-.7-1.6-.2-.5-.4-.4-.4-.4-.1 0-.3.1-.4.2-.4.2-.7.6-.7 1.4 0 .8.6 1.6.7 1.7.1.1 1.2 1.9 3 2.6 1.1.5 1.5.5 2.1.4.3 0 .9-.4 1.1-.7.1-.3.2-.6.1-.7-.1-.1-.2-.1-.5-.2z" /></svg>
                  <span dir="ltr" style={{ color: "#111827", fontSize: "20px", fontWeight: 900, display: "flex", alignItems: "center" }}>{pdfExportTarget.reportMeta.teacherPhone}</span>
                </div>
              </div>

              {/* Footer */}
              <div style={{ borderTop: "1px solid #DDE4D8", paddingTop: "15px", textAlign: "center" }}>
                <p style={{ color: "#556B4F", fontSize: "12px", fontWeight: 700, margin: 0 }}>ENGLISH HUB — المنصة الأولى من نوعها في منبج لتعلم اللغة الإنجليزية ✅ 📚 🎓</p>
                <p style={{ color: "#556B4F", fontSize: "11px", margin: "6px 0 0" }}>تعلم <span style={{ color: "#B33A3A" }}>•</span> أتقن <span style={{ color: "#B33A3A" }}>•</span> تميز</p>
                <p style={{ color: "#6B7280", fontSize: "10px", margin: "8px 0 0" }}>تم إصدار التقرير بتاريخ: {formatSyrianDate(pdfExportTarget.reportMeta.issuedAt)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </AppShell>
  );
}
