"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import {
  listenCollection,
  createDoc,
  deleteDocById,
  orderBy,
} from "@/lib/firestore-helpers";
import { Group, Stage } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

export default function GroupsPage() {
  const [stages, setStages] = useState<(Stage & { id: string })[]>([]);
  const [groups, setGroups] = useState<(Group & { id: string })[]>([]);
  const [name, setName] = useState("");
  const [stageId, setStageId] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    const u1 = listenCollection<Stage>("stages", [orderBy("order")], setStages);
    const u2 = listenCollection<Group>("groups", [], setGroups);
    return () => {
      u1();
      u2();
    };
  }, []);

  const addStage = async () => {
    if (!newStageName.trim()) return;
    await createDoc("stages", { name: newStageName, order: stages.length });
    setNewStageName("");
  };

  const addGroup = async () => {
    if (!name.trim() || !stageId) return;
    await createDoc("groups", {
      name,
      stageId,
      teacherIds: user ? [user.uid] : [],
      createdAt: Date.now(),
    });
    setName("");
  };

  return (
    <AppShell requireRole="teacher">
      <h1 className="text-2xl font-bold text-brand-text mb-6">
        المراحل والمجموعات
      </h1>

      <div className="grid md:grid-cols-2 gap-6">
        <GlassCard>
          <h2 className="font-bold text-brand-text mb-4">المراحل / الصفوف</h2>
          <div className="flex gap-2 mb-4">
            <input
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="مثال: الصف التاسع"
              className="flex-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
            />
            <Button onClick={addStage}>إضافة</Button>
          </div>
          <ul className="flex flex-col gap-2">
            {stages.map((s) => (
              <li
                key={s.id}
                className="px-3 py-2 rounded-xl bg-white/60 text-brand-text text-sm"
              >
                {s.name}
              </li>
            ))}
            {stages.length === 0 && (
              <p className="text-brand-textMuted text-sm">لا توجد مراحل بعد.</p>
            )}
          </ul>
        </GlassCard>

        <GlassCard>
          <h2 className="font-bold text-brand-text mb-4">المجموعات</h2>
          <div className="flex flex-col gap-2 mb-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم المجموعة"
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
            />
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
            >
              <option value="">اختر المرحلة</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button onClick={addGroup}>إضافة مجموعة</Button>
          </div>
          <ul className="flex flex-col gap-2">
            {groups.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/60 text-sm"
              >
                <span className="text-brand-text">
                  {g.name}{" "}
                  <span className="text-brand-textMuted">
                    ({stages.find((s) => s.id === g.stageId)?.name ?? "—"})
                  </span>
                </span>
                <button
                  onClick={() => deleteDocById("groups", g.id)}
                  className="text-brand-error text-xs"
                >
                  حذف
                </button>
              </li>
            ))}
            {groups.length === 0 && (
              <p className="text-brand-textMuted text-sm">
                لا توجد مجموعات بعد.
              </p>
            )}
          </ul>
        </GlassCard>
      </div>
    </AppShell>
  );
}
