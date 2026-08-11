"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { listenCollection, createDoc, orderBy } from "@/lib/firestore-helpers";
import { Unit } from "@/lib/types";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function UnitsPage() {
  const [units, setUnits] = useState<(Unit & { id: string })[]>([]);
  const [title, setTitle] = useState("");
  const { stageId, stageName } = useWorkspace();

  useEffect(() => {
    const u1 = listenCollection<Unit>("units", [orderBy("order")], setUnits);
    return () => {
      u1();
    };
  }, []);

  const unitsInWorkspace = units.filter((u) => u.stageId === stageId);

  const addUnit = async () => {
    if (!title.trim() || !stageId) return;
    await createDoc("units", {
      title,
      stageId,
      order: unitsInWorkspace.length,
      status: "draft",
      createdAt: Date.now(),
    });
    setTitle("");
  };

  return (
    <AppShell requireRole="teacher">
      <h1 className="text-2xl font-bold text-brand-text mb-1">الوحدات والدروس</h1>
      <p className="text-brand-textMuted text-sm mb-6">القسم الحالي: {stageName ?? "—"}</p>

      <GlassCard className="mb-6">
        <h2 className="font-bold text-brand-text mb-4">إضافة وحدة جديدة</h2>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            placeholder="اسم الوحدة (Unit 1)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          />
          <Button onClick={addUnit}>إضافة</Button>
        </div>
      </GlassCard>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {unitsInWorkspace.map((u) => (
          <Link key={u.id} href={`/units/${u.id}`}>
            <GlassCard className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-brand-text">{u.title}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    u.status === "published"
                      ? "bg-brand-success/15 text-brand-success"
                      : "bg-brand-warning/15 text-brand-warning"
                  }`}
                >
                  {u.status === "published" ? "منشورة" : "مسودة"}
                </span>
              </div>
            </GlassCard>
          </Link>
        ))}
        {unitsInWorkspace.length === 0 && (
          <p className="text-brand-textMuted">لا توجد وحدات بهذا القسم بعد.</p>
        )}
      </div>
    </AppShell>
  );
}
