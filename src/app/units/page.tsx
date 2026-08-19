"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, Edit2, Rocket, PauseCircle, ExternalLink } from "lucide-react";
import { collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Toast } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { listenCollection, createDoc, updateDocById, orderBy } from "@/lib/firestore-helpers";
import { Unit } from "@/lib/types";
import { useWorkspace } from "@/hooks/useWorkspace";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CompactListRow } from "@/components/ui/CompactListRow";
import ActionsDropdown from "@/components/ui/ActionsDropdown";

// بطاقة وحدة منفصلة على مستوى الملف (مش متداخلة جوا مكوّن الصفحة) — نفس
// السبب دايمًا: تفادي أي إعادة إنشاء لنوع المكوّن أثناء الكتابة بحقل
// التعديل، يلي بيسبب فقدان التركيز.
function UnitCard({
  unit,
  onTogglePublish,
  onRename,
  onDelete,
}: {
  unit: Unit & { id: string };
  onTogglePublish: () => void;
  onRename: (newTitle: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(unit.title);

  if (editing) {
    return (
      <div className="px-3 py-3 border-b border-surfaceBorder/50">
        <div className="flex flex-col gap-2">
          <input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (draftTitle.trim()) onRename(draftTitle.trim());
                setEditing(false);
              }}
            >
              حفظ
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraftTitle(unit.title);
                setEditing(false);
              }}
            >
              إلغاء
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CompactListRow
      avatarLabel={unit.title.charAt(0).toUpperCase()}
      title={unit.title}
      badge={<StatusBadge label={unit.status === "published" ? "منشورة" : "مسودة"} tone={unit.status === "published" ? "success" : "warning"} />}
      onClick={() => (window.location.href = `/units/${unit.id}`)}
      trailing={
        <ActionsDropdown
          actions={[
            {
              label: "فتح الدروس",
              icon: <ExternalLink className="w-4 h-4" />,
              onClick: () => (window.location.href = `/units/${unit.id}`),
            },
            {
              label: "تعديل الاسم",
              icon: <Edit2 className="w-4 h-4" />,
              onClick: () => setEditing(true),
            },
            {
              label: unit.status === "published" ? "إلغاء النشر" : "نشر الوحدة",
              icon: unit.status === "published" ? <PauseCircle className="w-4 h-4" /> : <Rocket className="w-4 h-4 text-brand-success" />,
              onClick: onTogglePublish,
            },
            {
              label: "حذف الوحدة",
              icon: <Trash2 className="w-4 h-4" />,
              onClick: onDelete,
              variant: "danger",
            },
          ]}
        />
      }
    />
  );
}

export default function UnitsPage() {
  const [units, setUnits] = useState<(Unit & { id: string })[]>([]);
  const [title, setTitle] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ unit: Unit & { id: string }; lessonsCount: number } | null>(null);
  const { stageId, stageName } = useWorkspace();

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const u1 = listenCollection<Unit>(
      "units",
      [orderBy("order")],
      setUnits,
      (err) => showToast(`تعذّر تحميل الوحدات: ${err.message}`, "error")
    );
    return () => {
      u1();
    };
  }, []);

  const unitsInWorkspace = units.filter((u) => u.stageId === stageId);

  const addUnit = async () => {
    if (!title.trim() || !stageId) return;
    try {
      await createDoc("units", {
        title: title.trim(),
        stageId,
        order: unitsInWorkspace.length,
        status: "draft",
        createdAt: Date.now(),
      });
      showToast("تم إنشاء الوحدة ✅ — اضغط \"نشر الوحدة\" لما تصير جاهزة للطلاب");
      setTitle("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`تعذّر إنشاء الوحدة: ${msg}`, "error");
    }
  };

  const togglePublish = async (u: Unit & { id: string }) => {
    try {
      await updateDocById("units", u.id, {
        status: u.status === "published" ? "draft" : "published",
      });
      showToast(u.status === "published" ? "تم إلغاء نشر الوحدة" : "تم نشر الوحدة ✅");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`تعذّر تحديث حالة النشر: ${msg}`, "error");
    }
  };

  const requestDeleteUnit = async (u: Unit & { id: string }) => {
    try {
      const lessonsSnapshot = await getDocs(query(collection(db, "lessons"), where("unitId", "==", u.id)));
      setDeleteTarget({ unit: u, lessonsCount: lessonsSnapshot.size });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`تعذّر فحص محتوى الوحدة: ${msg}`, "error");
    }
  };

  const confirmDeleteUnit = async () => {
    if (!deleteTarget) return;
    const { unit } = deleteTarget;
    try {
      const lessonsSnapshot = await getDocs(query(collection(db, "lessons"), where("unitId", "==", unit.id)));
      await Promise.all(lessonsSnapshot.docs.map((lesson) => deleteDoc(doc(db, "lessons", lesson.id))));
      await deleteDoc(doc(db, "units", unit.id));
      showToast("تم حذف الوحدة والدروس المرتبطة بها ✅");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`تعذّر حذف الوحدة: ${msg}`, "error");
    }
  };

  const renameUnit = async (u: Unit & { id: string }, newTitle: string) => {
    try {
      await updateDocById("units", u.id, { title: newTitle });
      showToast("تم تحديث اسم الوحدة ✅");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`تعذّر تحديث الاسم: ${msg}`, "error");
    }
  };

  return (
    <AppShell requireRole="teacher">
      <PageHeader icon="📚" title="الوحدات والدروس" />
      <p className="text-brand-textMuted text-sm mb-6 -mt-4">القسم الحالي: {stageName ?? "—"}</p>

      <GlassCard className="mb-6">
        <h2 className="font-bold text-brand-text mb-4">إضافة وحدة جديدة</h2>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            placeholder="اسم الوحدة (Unit 1)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
          />
          <Button onClick={addUnit} disabled={!title.trim()}>إضافة</Button>
        </div>
        <p className="text-brand-textMuted text-xs mt-2">
          الوحدة بتنضاف كمسودة أول شي — لازم تضغط &quot;نشر الوحدة&quot; من بطاقتها تحت حتى تصير ظاهرة للطلاب.
        </p>
      </GlassCard>

      <GlassCard className="!p-0 overflow-hidden mb-36">
        <div className="flex flex-col">
          {unitsInWorkspace.map((u) => (
            <UnitCard
              key={u.id}
              unit={u}
              onTogglePublish={() => togglePublish(u)}
              onRename={(newTitle) => renameUnit(u, newTitle)}
              onDelete={() => requestDeleteUnit(u)}
            />
          ))}
          {unitsInWorkspace.length === 0 && (
            <p className="text-brand-textMuted text-sm text-center py-12">لا توجد وحدات بهذا القسم بعد.</p>
          )}
        </div>
      </GlassCard>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={confirmDeleteUnit} title="تأكيد حذف الوحدة" message={deleteTarget ? `هل أنت متأكد من حذف الوحدة «${deleteTarget.unit.title}»؟${deleteTarget.lessonsCount ? ` هذه الوحدة تحتوي على ${deleteTarget.lessonsCount} درس، وسيتم حذف الدروس المرتبطة بها أيضاً.` : " لا تحتوي هذه الوحدة على دروس حالياً."}` : ""} confirmLabel="تأكيد الحذف" />
      {toast && <Toast message={toast.message} type={toast.type} />}
    </AppShell>
  );
}
