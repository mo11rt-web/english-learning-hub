"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Toast } from "@/components/ui/Modal";
import {
  listenCollection,
  createDoc,
  deleteDocById,
} from "@/lib/firestore-helpers";
import { Group } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function GroupsPage() {
  const [groups, setGroups] = useState<(Group & { id: string })[]>([]);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<(Group & { id: string }) | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { user } = useAuth();
  const { stageId, stageName } = useWorkspace();

  useEffect(() => {
    const u = listenCollection<Group>("groups", [], setGroups);
    return () => u();
  }, []);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  const addGroup = async () => {
    if (!name.trim() || !stageId) return;
    await createDoc("groups", {
      name: name.trim(),
      stageId,
      teacherIds: user ? [user.uid] : [],
      createdAt: Date.now(),
    });
    setName("");
    showToast("تمت إضافة المجموعة ✅");
  };

  const groupsInWorkspace = groups.filter((g) => g.stageId === stageId);

  return (
    <AppShell requireRole="teacher">
      <h1 className="text-2xl font-bold text-brand-text mb-1">المجموعات والصفوف</h1>
      <p className="text-brand-textMuted text-sm mb-6">
        فرع "{stageName ?? "—"}" — كل مجموعة تُنشأ هنا خاصة بهذا الفرع فقط.
      </p>

      <div className="max-w-xl">
        <GlassCard>
          <div
            className="flex gap-2 mb-4"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addGroup();
              }
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم المجموعة (مثال: مجموعة A)"
              className="flex-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70"
            />
            <Button onClick={addGroup}>+ إضافة</Button>
          </div>
          <ul className="flex flex-col gap-2">
            {groupsInWorkspace.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface/60 text-sm"
              >
                <span className="text-brand-text font-medium">{g.name}</span>
                <button
                  onClick={() => setDeleteTarget(g)}
                  className="text-brand-error text-xs"
                >
                  حذف
                </button>
              </li>
            ))}
            {groupsInWorkspace.length === 0 && (
              <p className="text-brand-textMuted text-sm text-center py-6">
                لا توجد مجموعات بهذا الفرع بعد.
              </p>
            )}
          </ul>
        </GlassCard>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteDocById("groups", deleteTarget.id);
          showToast(`تم حذف مجموعة "${deleteTarget.name}"`);
        }}
        title="حذف المجموعة"
        message={`هل أنت متأكد من حذف مجموعة "${deleteTarget?.name ?? ""}"؟ الطلاب المرتبطون فيها لن يُحذفوا، بس رح ينفصلوا عنها.`}
        confirmLabel="حذف"
      />

      {toast && <Toast message={toast} />}
    </AppShell>
  );
}
