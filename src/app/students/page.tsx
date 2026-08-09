"use client";

import { useEffect, useState } from "react";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import {
  listenCollection,
  updateDocById,
  orderBy,
} from "@/lib/firestore-helpers";
import { StudentProfile, Stage, Group } from "@/lib/types";
import { phoneToEmail, normalizePhone } from "@/lib/phone";

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

export default function StudentsPage() {
  const [students, setStudents] = useState<(StudentProfile & { id: string })[]>(
    []
  );
  const [stages, setStages] = useState<(Stage & { id: string })[]>([]);
  const [groups, setGroups] = useState<(Group & { id: string })[]>([]);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    stageId: "",
    groupId: "",
  });
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<{
    phone: string;
    password: string;
  } | null>(null);
  const [search, setSearch] = useState("");

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
    if (!form.fullName.trim() || !form.phone.trim() || !form.stageId) return;
    setCreating(true);
    const password = randomPassword();
    const phone = normalizePhone(form.phone);
    const email = phoneToEmail(phone, "student");

    // نستخدم تطبيق Firebase ثانوي مؤقت حتى لا يتم تسجيل خروج المعلم الحالي
    const secondaryApp = initializeApp(firebaseConfig, `student-create-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );
      const studentNumber = `STU-${Date.now().toString().slice(-6)}`;
      await setDoc(doc(db, "profiles", cred.user.uid), {
        uid: cred.user.uid,
        fullName: form.fullName,
        role: "student",
        username: phone,
        phone,
        studentNumber,
        stageId: form.stageId,
        groupIds: form.groupId ? [form.groupId] : [],
        status: "active",
        mustChangePassword: true,
        createdAt: Date.now(),
      } as StudentProfile);
      setLastCreated({ phone, password });
      setForm({ fullName: "", phone: "", stageId: "", groupId: "" });
    } catch (e: any) {
      alert("تعذر إنشاء الحساب: " + (e.message ?? "خطأ غير معروف"));
    } finally {
      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);
      setCreating(false);
    }
  };

  const filtered = students.filter(
    (s) =>
      s.fullName.includes(search) ||
      s.username?.includes(search) ||
      s.studentNumber?.includes(search)
  );

  return (
    <AppShell requireRole="teacher">
      <h1 className="text-2xl font-bold text-brand-text mb-6">إدارة الطلاب</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-1 h-fit">
          <h2 className="font-bold text-brand-text mb-4">إضافة طالب جديد</h2>
          <div className="flex flex-col gap-3">
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
            <select
              value={form.stageId}
              onChange={(e) => setForm({ ...form, stageId: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
            >
              <option value="">اختر المرحلة</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={form.groupId}
              onChange={(e) => setForm({ ...form, groupId: e.target.value })}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
            >
              <option value="">بدون مجموعة (اختياري)</option>
              {groups
                .filter((g) => g.stageId === form.stageId)
                .map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
            </select>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "جاري الإنشاء..." : "إنشاء حساب الطالب"}
            </Button>
          </div>

          {lastCreated && (
            <div className="mt-4 p-3 rounded-xl bg-brand-success/10 text-sm">
              <p className="text-brand-text font-medium mb-1">
                تم إنشاء الحساب بنجاح ✅
              </p>
              <p dir="ltr" className="text-brand-text">
                Phone: {lastCreated.phone}
              </p>
              <p dir="ltr" className="text-brand-text">
                Password: {lastCreated.password}
              </p>
              <p className="text-brand-textMuted text-xs mt-1">
                يرجى تدوين كلمة المرور الآن — لن تظهر مجددًا.
              </p>
            </div>
          )}
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-brand-text">
              قائمة الطلاب ({filtered.length})
            </h2>
            <input
              placeholder="بحث بالاسم أو الرقم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-brand-primary/25 bg-white/70 text-sm"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-brand-textMuted text-right border-b border-brand-primary/10">
                  <th className="py-2 px-2">الاسم</th>
                  <th className="py-2 px-2">رقم الهاتف</th>
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
                      {stages.find((st) => st.id === s.stageId)?.name ?? "—"}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={
                          s.status === "active"
                            ? "text-brand-success"
                            : "text-brand-error"
                        }
                      >
                        {s.status === "active" ? "نشط" : "معطّل"}
                      </span>
                    </td>
                    <td className="py-2 px-2">
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
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-brand-textMuted">
                      لا يوجد طلاب بعد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
