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
import { ActionMenu } from "@/components/ui/ActionMenu";
import {
  listenCollection,
  updateDocById,
  orderBy,
} from "@/lib/firestore-helpers";
import { StudentProfile, Stage, Group } from "@/lib/types";
import { phoneToEmail, normalizePhone } from "@/lib/phone";
import { computeLevel } from "@/lib/gamification";
import { publishResultsShare, setShareEnabled } from "@/lib/shareResults";
import { adminResetStudentPassword, syncStudentLoginEmail } from "@/lib/adminActions";
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

const PLATFORM_URL = typeof window !== "undefined" ? window.location.origin : "";

const AVATAR_COLORS = [
  "bg-brand-primary", "bg-brand-secondary", "bg-brand-success", "bg-brand-warning", "bg-brand-error",
];
function avatarColor(seed: string) {
  const i = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
}

type StatusFilter = "active" | "disabled" | "deleted" | "all";

export default function StudentsPage() {
  const [students, setStudents] = useState<(StudentProfile & { id: string })[]>([]);
  const [stages, setStages] = useState<(Stage & { id: string })[]>([]);
  const [groups, setGroups] = useState<(Group & { id: string })[]>([]);
  const [form, setForm] = useState({
    fullName: "", phone: "", address: "", stageId: "", groupId: "", password: randomPassword(),
  });
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [groupFilter, setGroupFilter] = useState("");
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [credentialsModal, setCredentialsModal] = useState<{ fullName: string; phone: string; password: string } | null>(null);

  const [profileTarget, setProfileTarget] = useState<(StudentProfile & { id: string }) | null>(null);
  const [profileForm, setProfileForm] = useState({ fullName: "", phone: "", address: "", stageId: "", groupId: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<(StudentProfile & { id: string }) | null>(null);

  const [passwordTarget, setPasswordTarget] = useState<(StudentProfile & { id: string }) | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  const { user } = useAuth();
  const { stageId: workspaceStageId, stageName: workspaceStageName } = useWorkspace();

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const u1 = listenCollection<StudentProfile>("profiles", [], (all) =>
      setStudents(all.filter((p) => p.role === "student") as any)
    );
    const u2 = listenCollection<Stage>("stages", [orderBy("order")], setStages);
    const u3 = listenCollection<Group>("groups", [], setGroups);
    return () => { u1(); u2(); u3(); };
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
      const msg = e.code === "auth/email-already-in-use"
        ? "رقم الهاتف هذا مستخدم بالفعل لحساب طالب آخر"
        : e.message ?? "خطأ غير معروف";
      showToast("تعذر إنشاء الحساب: " + msg, "error");
    } finally {
      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);
      setCreating(false);
    }
  };

  const openProfile = (s: StudentProfile & { id: string }) => {
    setProfileTarget(s);
    setProfileForm({
      fullName: s.fullName,
      phone: s.phone ?? s.username ?? "",
      address: s.address ?? "",
      stageId: s.stageId ?? "",
      groupId: s.groupIds?.[0] ?? "",
    });
  };

  const saveProfile = async () => {
    if (!profileTarget) return;
    if (!profileForm.fullName.trim() || !profileForm.stageId || !profileForm.phone.trim()) {
      showToast("الاسم ورقم الهاتف والمرحلة حقول إلزامية", "error");
      return;
    }
    setSavingProfile(true);
    try {
      const newPhone = normalizePhone(profileForm.phone);
      const phoneChanged = newPhone !== normalizePhone(profileTarget.phone ?? profileTarget.username ?? "");

      // لازم نزامن بريد الدخول بـ Firebase Auth الأول لو الرقم تغيّر، قبل
      // ما نحدّث Firestore — حتى ما نوصل لحالة الرقم اتغيّر بالواجهة بس
      // تسجيل الدخول القديم بضل شغّال والجديد لأ
      if (phoneChanged) {
        await syncStudentLoginEmail(profileTarget.id, newPhone);
      }

      await updateDocById("profiles", profileTarget.id, {
        fullName: profileForm.fullName,
        phone: newPhone,
        username: newPhone,
        address: profileForm.address,
        stageId: profileForm.stageId,
        groupIds: profileForm.groupId ? [profileForm.groupId] : [],
      });
      showToast("تم تحديث بيانات الطالب ✅");
      setProfileTarget(null);
    } catch (e: any) {
      showToast("تعذر الحفظ: " + (e.message ?? "خطأ غير معروف"), "error");
    } finally {
      setSavingProfile(false);
    }
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

  const openPasswordModal = (s: StudentProfile & { id: string }) => {
    setPasswordTarget(s);
    setNewPassword(randomPassword());
  };

  const submitPasswordReset = async () => {
    if (!passwordTarget) return;
    if (newPassword.length < 6) {
      showToast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error");
      return;
    }
    setResettingPassword(true);
    try {
      await adminResetStudentPassword(passwordTarget.id, newPassword);
      showToast(`تم تغيير كلمة مرور "${passwordTarget.fullName}" بنجاح ✅`);
      setPasswordTarget(null);
    } catch (e: any) {
      showToast("تعذر تغيير كلمة المرور: " + (e.message ?? "خطأ غير معروف"), "error");
    } finally {
      setResettingPassword(false);
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

  const visibleStudents = students.filter((s) => s.stageId === workspaceStageId);
  const filtered = visibleStudents.filter((s) => {
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const matchesGroup = !groupFilter || s.groupIds?.includes(groupFilter);
    const matchesSearch =
      !search.trim() ||
      s.fullName.includes(search) || s.username?.includes(search) || s.studentNumber?.includes(search);
    return matchesStatus && matchesGroup && matchesSearch;
  });

  const statusBadge = (status: StudentProfile["status"]) => {
    const map: Record<string, { label: string; cls: string }> = {
      active: { label: "نشط", cls: "bg-brand-success/15 text-brand-success" },
      disabled: { label: "معطّل", cls: "bg-brand-error/15 text-brand-error" },
      deleted: { label: "محذوف", cls: "bg-black/10 dark:bg-white/10 text-brand-textMuted" },
    };
    const v = map[status] ?? map.active;
    return <span className={`text-xs px-2 py-0.5 rounded-full ${v.cls}`}>{v.label}</span>;
  };

  return (
    <AppShell requireRole="teacher">
      <h1 className="text-2xl font-bold text-brand-text mb-6">إدارة الطلاب</h1>

      {shareLink && (
        <GlassCard className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-brand-text font-medium mb-1">✅ رابط مشاركة النتائج جاهز (تم نسخه تلقائيًا)</p>
            <a href={shareLink} target="_blank" rel="noreferrer" dir="ltr" className="text-brand-primary text-sm break-all">
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
            <input placeholder="الاسم الكامل" value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70" />
            <input placeholder="رقم هاتف الطالب" dir="ltr" type="tel" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70" />
            <input placeholder="العنوان (اختياري)" value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70" />
            <div className="px-3 py-2 rounded-xl bg-brand-primary/10 text-brand-primary text-sm">
              القسم: {workspaceStageName ?? "—"}
            </div>
            <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70">
              <option value="">بدون مجموعة (اختياري)</option>
              {groups.filter((g) => g.stageId === workspaceStageId).map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>

            <div>
              <label className="text-xs text-brand-textMuted block mb-1">كلمة المرور</label>
              <div className="flex gap-2">
                <input type={showPassword ? "text" : "password"} dir="ltr" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70" />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="px-2 text-xs text-brand-textMuted shrink-0">
                  {showPassword ? "إخفاء" : "إظهار"}
                </button>
                <button type="button" onClick={() => setForm({ ...form, password: randomPassword() })}
                  className="px-2 text-xs text-brand-primary shrink-0" title="توليد كلمة مرور عشوائية">
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

        <div className="lg:col-span-2 flex flex-col gap-4">
          <GlassCard>
            <div className="flex flex-wrap items-center gap-3">
              <input
                placeholder="🔍 بحث بالاسم أو رقم الهاتف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70 text-sm"
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70 text-sm">
                <option value="active">نشط</option>
                <option value="disabled">معطّل</option>
                <option value="deleted">محذوف</option>
                <option value="all">الكل</option>
              </select>
              <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70 text-sm">
                <option value="">كل المجموعات</option>
                {groups.filter((g) => g.stageId === workspaceStageId).map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-brand-textMuted mt-3">{filtered.length} طالب</p>
          </GlassCard>

          <div className="grid sm:grid-cols-2 gap-3">
            {filtered.map((s) => {
              const level = computeLevel(s.points ?? 0);
              const menuItems = s.status === "deleted"
                ? [{ label: "↩ استرجاع الحساب", icon: "↩", onClick: () => handleRestore(s) }]
                : [
                    { label: "عرض / تعديل البيانات", icon: "✎", onClick: () => openProfile(s) },
                    { label: "تغيير كلمة المرور", icon: "🔑", onClick: () => openPasswordModal(s) },
                    {
                      label: s.status === "active" ? "تعطيل الحساب" : "تفعيل الحساب",
                      icon: s.status === "active" ? "⏸" : "▶",
                      onClick: () =>
                        updateDocById("profiles", s.id, { status: s.status === "active" ? "disabled" : "active" }),
                    },
                    { label: "مشاركة النتائج", icon: "🔗", onClick: () => handleShare(s) },
                    { label: "حذف الحساب", icon: "🗑", danger: true, onClick: () => setDeleteTarget(s) },
                  ];
              return (
                <GlassCard
                  key={s.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => s.status !== "deleted" && openProfile(s)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-white font-bold ${avatarColor(s.fullName)}`}>
                      {s.fullName.trim().charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-brand-text truncate">{s.fullName}</p>
                      <p dir="ltr" className="text-brand-textMuted text-xs">{s.username}</p>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <ActionMenu items={menuItems} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      {statusBadge(s.status)}
                      <span className="text-xs text-brand-textMuted">
                        {stages.find((st) => st.id === s.stageId)?.name ?? "—"}
                      </span>
                    </div>
                    <span className="text-xs text-brand-primary font-medium">
                      {s.points ?? 0} نقطة · {level.name}
                    </span>
                  </div>
                </GlassCard>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-brand-textMuted col-span-2 text-center py-8">لا يوجد طلاب مطابقون.</p>
            )}
          </div>
        </div>
      </div>

      {/* بيانات الدخول بعد إنشاء حساب جديد */}
      <Modal open={!!credentialsModal} onClose={() => setCredentialsModal(null)} title="مشاركة بيانات الدخول">
        {credentialsModal && (
          <div className="flex flex-col gap-3">
            <p className="text-brand-text text-sm">
              تم إنشاء حساب <strong>{credentialsModal.fullName}</strong> بنجاح. شارك بيانات الدخول التالية معه:
            </p>
            <div className="bg-brand-primary/5 rounded-xl p-4 text-sm flex flex-col gap-1.5" dir="ltr">
              <p className="text-brand-text"><strong>Phone:</strong> {credentialsModal.phone}</p>
              <p className="text-brand-text"><strong>Password:</strong> {credentialsModal.password}</p>
            </div>
            <p className="text-xs text-brand-textMuted">دوّن كلمة المرور الآن — لن تظهر مجددًا بهذا الوضوح لاحقًا.</p>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => copyCredentials(credentialsModal.fullName, credentialsModal.phone, credentialsModal.password)}>
                📋 نسخ بيانات الدخول
              </Button>
              <a
                href={buildWhatsappMessage(credentialsModal.fullName, credentialsModal.phone, credentialsModal.password)}
                target="_blank" rel="noreferrer"
                className="px-4 py-2.5 rounded-2xl text-sm font-medium bg-brand-success text-white hover:opacity-90 inline-flex items-center"
              >
                📱 مشاركة عبر واتساب
              </a>
            </div>
          </div>
        )}
      </Modal>

      {/* الملف الكامل — عرض وتعديل كل بيانات الطالب */}
      <Modal open={!!profileTarget} onClose={() => setProfileTarget(null)} title="ملف الطالب">
        {profileTarget && (
          <div
            className="flex flex-col gap-3"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !(e.target as HTMLElement).closest("select")) {
                e.preventDefault();
                saveProfile();
              }
            }}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-14 h-14 rounded-full shrink-0 flex items-center justify-center text-white text-xl font-bold ${avatarColor(profileTarget.fullName)}`}>
                {profileTarget.fullName.trim().charAt(0)}
              </div>
              <div>
                <p className="text-xs text-brand-textMuted">{profileTarget.studentNumber}</p>
                <p className="text-xs text-brand-primary">
                  {(profileTarget.points ?? 0)} نقطة · {computeLevel(profileTarget.points ?? 0).name}
                </p>
              </div>
            </div>

            <label className="text-xs text-brand-textMuted">الاسم الكامل</label>
            <input value={profileForm.fullName} onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70" />

            <label className="text-xs text-brand-textMuted">رقم الهاتف (اسم الدخول)</label>
            <input dir="ltr" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70" />

            <label className="text-xs text-brand-textMuted">العنوان</label>
            <input value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70" />

            <label className="text-xs text-brand-textMuted">المرحلة</label>
            <select value={profileForm.stageId} onChange={(e) => setProfileForm({ ...profileForm, stageId: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70">
              <option value="">اختر المرحلة</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <label className="text-xs text-brand-textMuted">المجموعة</label>
            <select value={profileForm.groupId} onChange={(e) => setProfileForm({ ...profileForm, groupId: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70">
              <option value="">بدون مجموعة</option>
              {groups.filter((g) => g.stageId === profileForm.stageId).map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>

            <div className="flex gap-2 mt-1">
              <Button onClick={saveProfile} disabled={savingProfile} className="flex-1">
                {savingProfile ? "جارٍ الحفظ..." : "حفظ التعديلات"}
              </Button>
              <Button variant="secondary" onClick={() => openPasswordModal(profileTarget)}>
                🔑 كلمة المرور
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* تغيير كلمة المرور — فعلي بالكامل عبر API route بصلاحيات Admin */}
      <Modal open={!!passwordTarget} onClose={() => setPasswordTarget(null)} title="تغيير كلمة المرور">
        {passwordTarget && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-brand-text">
              كلمة مرور جديدة لـ <strong>{passwordTarget.fullName}</strong>:
            </p>
            <div className="flex gap-2">
              <input dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70" />
              <button type="button" onClick={() => setNewPassword(randomPassword())}
                className="px-2 text-xs text-brand-primary shrink-0" title="توليد كلمة مرور عشوائية">
                🎲
              </button>
            </div>
            <Button onClick={submitPasswordReset} disabled={resettingPassword}>
              {resettingPassword ? "جارٍ التحديث..." : "تحديث كلمة المرور الآن"}
            </Button>
            <button
              onClick={() => copyCredentials(passwordTarget.fullName, passwordTarget.phone ?? "", newPassword)}
              className="text-brand-primary text-xs"
            >
              📋 نسخ بيانات الدخول الجديدة
            </button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="حذف الطالب"
        message={`هل أنت متأكد من حذف الطالب "${deleteTarget?.fullName ?? ""}"؟ سيتم إخفاء بياناته ووقف وصوله للمنصة فورًا. يمكنك استرجاعه لاحقًا من فلتر "محذوف".`}
        confirmLabel="حذف"
      />

      {toast && <Toast message={toast.message} type={toast.type} />}
    </AppShell>
  );
}
