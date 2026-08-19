"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Toast } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  listenCollection,
  createDoc,
  deleteDocById,
  updateDocById,
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

  const toggleLeaderboard = async (g: Group & { id: string }) => {
    const next = g.leaderboardEnabled === false; // false -> true, و(true أو undefined) -> false
    await updateDocById("groups", g.id, { leaderboardEnabled: next });
    showToast(next ? `طلاب "${g.name}" رح يظهروا بلوحة الصدارة ✅` : `طلاب "${g.name}" رح ينخفوا عن لوحة الصدارة`);
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
      <PageHeader
        icon="👥"
        title="المجموعات والصفوف"
        meta={
          <span className="text-xs font-bold text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-full">
            {groupsInWorkspace.length} مجموعة
          </span>
        }
      />
      <p className="text-brand-textMuted text-sm mb-6 -mt-4">
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
            {groupsInWorkspace.map((g) => {
              const leaderboardOn = g.leaderboardEnabled !== false;
              return (
                <li
                  key={g.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface/60 text-sm gap-3"
                >
                  <span className="text-brand-text font-medium">{g.name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => toggleLeaderboard(g)}
                      title={leaderboardOn ? "إخفاء طلاب هذه المجموعة عن لوحة الصدارة" : "إظهار طلاب هذه المجموعة بلوحة الصدارة"}
                      className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full transition-colors ${
                        leaderboardOn
                          ? "bg-brand-primary/10 text-brand-primary"
                          : "bg-brand-textMuted/10 text-brand-textMuted"
                      }`}
                    >
                      🏆 {leaderboardOn ? "ظاهرة بالصدارة" : "مخفية عن الصدارة"}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(g)}
                      className="text-brand-error text-xs"
                    >
                      حذف
                    </button>
                  </div>
                </li>
              );
            })}
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
