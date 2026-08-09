"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import {
  listenCollection,
  createDoc,
  where,
  orderBy,
} from "@/lib/firestore-helpers";
import { Lesson, Unit } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

export default function UnitLessonsPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const [lessons, setLessons] = useState<(Lesson & { id: string })[]>([]);
  const [unit, setUnit] = useState<(Unit & { id: string }) | null>(null);
  const [title, setTitle] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    const u = listenCollection<Lesson>(
      "lessons",
      [where("unitId", "==", unitId), orderBy("order")],
      setLessons
    );
    getDoc(doc(db, "units", unitId)).then((snap) => {
      if (snap.exists()) setUnit({ ...(snap.data() as Unit), id: snap.id });
    });
    return () => u();
  }, [unitId]);

  const addLesson = async () => {
    if (!title.trim() || !user) return;
    await createDoc("lessons", {
      title,
      unitId,
      stageId: unit?.stageId ?? "",
      status: "draft",
      order: lessons.length,
      targetGroupIds: [],
      blocks: [],
      createdBy: user.uid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setTitle("");
  };

  return (
    <AppShell requireRole="teacher">
      <h1 className="text-2xl font-bold text-brand-text mb-6">دروس الوحدة</h1>

      <GlassCard className="mb-6">
        <div className="flex gap-3">
          <input
            placeholder="عنوان الدرس"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-brand-primary/25 bg-white/70"
          />
          <Button onClick={addLesson}>إضافة درس</Button>
        </div>
      </GlassCard>

      <div className="grid md:grid-cols-2 gap-4">
        {lessons.map((l) => (
          <Link key={l.id} href={`/lessons/${l.id}`}>
            <GlassCard className="hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-brand-text">{l.title}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    l.status === "published"
                      ? "bg-brand-success/15 text-brand-success"
                      : "bg-brand-warning/15 text-brand-warning"
                  }`}
                >
                  {l.status === "published" ? "منشور" : "مسودة"}
                </span>
              </div>
              <p className="text-brand-textMuted text-sm mt-1">
                {l.blocks?.length ?? 0} كتلة محتوى
              </p>
            </GlassCard>
          </Link>
        ))}
        {lessons.length === 0 && (
          <p className="text-brand-textMuted">لا توجد دروس بعد.</p>
        )}
      </div>
    </AppShell>
  );
}
