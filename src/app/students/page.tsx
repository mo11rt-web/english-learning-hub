"use client";

import { useEffect, useState } from "react";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Modal, ConfirmDialog, Toast } from "@/components/ui/Modal";
import {
  listenCollection,
  updateDocById,
  orderBy,
} from "@/lib/firestore-helpers";
import { StudentProfile, Stage, Group } from "@/lib/types";
import { phoneToEmail, normalizePhone } from "@/lib/phone";
import { computeLevel } from "@/lib/gamification";
import { publishResultsShare, setShareEnabled } from "@/lib/shareResults";
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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [credentialsModal, setCredentialsModal] = useState<{
    fullName: string;
    phone: string;
    password: string;
  } | null>(null);

  const [editing, setEditing] = useState<(StudentProfile & { id: string }) | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", address: "", stageId: "", groupId: "" });

  const [deleteTarget, setDeleteTarget] = useState<(StudentProfile & { id: string }) | null>(null);
  const [passwordInfoTarget, setPasswordInfoTarget] = useState<(StudentProfile & { id: string }) | null>(null);

  const { user } = useAuth();
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
    showToast(`تم حذف الطالب "${deleteTarget.fullName}"`);
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

  return (
    <AppShell requireRole="teacher">
      <h1 className="text-2xl font-bold text-brand-text mb-6">إدارة الطلاب</h1>

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
          <h2 className="font-bold text-brand-text mb-4">إضافة طالب جديد</h2>
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
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
            />
            <input
              placeholder="رقم هاتف الطالب"
              dir="ltr"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
            />
            <input
              placeholder="العنوان (اختياري)"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
            />
            <div className="px-3 py-2 rounded-xl bg-brand-primary/10 text-brand-primary text-sm">
              القسم: {workspaceStageName ?? "—"}
            </div>
            <select
              value={form.groupId}
              onChange={(e) => setForm({ ...form, groupId: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
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
                  className="flex-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
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
            <h2 className="font-bold text-brand-text">
              قائمة الطلاب ({filtered.length})
            </h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-brand-textMuted">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                />
                عرض المحذوفين
              </label>
              <input
                placeholder="بحث بالاسم أو الرقم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-brand-primary/25 bg-white/70 text-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-brand-textMuted text-right border-b border-brand-primary/10">
                  <th className="py-2 px-2">الاسم</th>
                  <th className="py-2 px-2">رقم الهاتف</th>
                  <th className="py-2 px-2">النقاط / المستوى</th>
                  <th className="py-2 px-2">المرحلة</th>
                  <th className="py-2 px-2">الحالة</th>
                  <th className="py-2 px-2">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-brand-primary/5">
                    <td className="py-2 px-2 text-brand-text">{s.fullName}</td>
                    <td className="py-2 px-2 text-brand-textMuted" dir="ltr">
                      {s.username}
                    </td>
                    <td className="py-2 px-2 text-brand-textMuted">
                      {s.points ?? 0} · {computeLevel(s.points ?? 0).name}
                    </td>
                    <td className="py-2 px-2 text-brand-textMuted">
                      {stages.find((st) => st.id === s.stageId)?.name ?? "—"}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={
                          s.status === "active"
                            ? "text-brand-success"
                            : s.status === "deleted"
                            ? "text-brand-textMuted"
                            : "text-brand-error"
                        }
                      >
                        {s.status === "active" ? "نشط" : s.status === "deleted" ? "محذوف" : "معطّل"}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      {s.status === "deleted" ? (
                        <button
                          onClick={() => handleRestore(s)}
                          className="text-brand-success text-xs"
                        >
                          ↩ استرجاع
                        </button>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => openEdit(s)} className="text-brand-primary text-xs">
                            ✎ تعديل
                          </button>
                          <button
                            onClick={() =>
                              updateDocById("profiles", s.id, {
                                status: s.status === "active" ? "disabled" : "active",
                              })
                            }
                            className="text-brand-primary text-xs"
                          >
                            {s.status === "active" ? "تعطيل" : "تفعيل"}
                          </button>
                          <button
                            onClick={() => setPasswordInfoTarget(s)}
                            className="text-brand-textMuted text-xs"
                          >
                            🔑 كلمة المرور
                          </button>
                          <button
                            onClick={() => handleShare(s)}
                            disabled={sharingId === s.id}
                            className="text-brand-secondary text-xs"
                          >
                            {sharingId === s.id ? "..." : "🔗 مشاركة النتائج"}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(s)}
                            className="text-brand-error text-xs"
                          >
                            🗑 حذف
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-brand-textMuted">
                      {showDeleted ? "لا يوجد طلاب محذوفون." : "لا يوجد طلاب بعد."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

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
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          />
          <input
            placeholder="العنوان"
            value={editForm.address}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          />
          <select
            value={editForm.stageId}
            onChange={(e) => setEditForm({ ...editForm, stageId: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          >
            <option value="">اختر المرحلة</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={editForm.groupId}
            onChange={(e) => setEditForm({ ...editForm, groupId: e.target.value })}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
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
        onClose={() => setPasswordInfoTarget(null)}
        title="تغيير كلمة المرور"
      >
        {passwordInfoTarget && (
          <div className="flex flex-col gap-3 text-sm text-brand-text">
            <p>
              لأسباب أمان في Firebase، لا يمكن لأي حساب (حتى حساب المدير) تغيير كلمة مرور حساب آخر
              مباشرة من المتصفح — هذا قيد من Firebase نفسه وليس نقصًا بالتصميم.
            </p>
            <p className="font-medium">لتغيير كلمة مرور "{passwordInfoTarget.fullName}" لديك خياران:</p>
            <div className="bg-brand-primary/5 rounded-xl p-3">
              <p className="font-medium mb-1">الخيار الأول (يدوي، متاح الآن):</p>
              <p className="text-brand-textMuted">
                من Firebase Console → Authentication → ابحث عن البريد{" "}
                <span dir="ltr" className="font-mono">{phoneToEmail(passwordInfoTarget.phone ?? "", "student")}</span>{" "}
                → احذف الحساب → أنشئه من جديد بنفس البريد وكلمة مرور جديدة → حدّث الحقل المرتبط
                بالطالب في Firestore (خطوة تحتاج دقة، اطلب مساعدتي عند التنفيذ).
              </p>
            </div>
            <div className="bg-brand-primary/5 rounded-xl p-3">
              <p className="font-medium mb-1">الخيار الثاني (تلقائي بالكامل، يحتاج ترقية بسيطة):</p>
              <p className="text-brand-textMuted">
                ترقية مشروع Firebase إلى خطة Blaze (لا تعني دفع فلوس فعليًا لمنصة صغيرة — فيها حصة مجانية
                سخية تكفي مشروعك) لتفعيل Cloud Function واحدة تسمح لك بتغيير كلمة مرور أي طالب بضغطة زر
                من هذه الصفحة مباشرة. إذا اخترت هذا الخيار، قلي وبجهزلك الكود والخطوات.
              </p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="حذف الطالب"
        message={`هل أنت متأكد من حذف الطالب "${deleteTarget?.fullName ?? ""}"؟ سيتم إخفاء بياناته ووقف وصوله للمنصة فورًا. يمكنك استرجاعه لاحقًا من قائمة "عرض المحذوفين".`}
        confirmLabel="حذف"
      />

      {toast && <Toast message={toast.message} type={toast.type} />}
    </AppShell>
  );
}
