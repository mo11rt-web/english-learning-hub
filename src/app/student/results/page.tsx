"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { useAuth } from "@/hooks/useAuth";
import { listenCollection, where } from "@/lib/firestore-helpers";
import { Attempt, Assignment } from "@/lib/types";

export default function StudentResultsPage() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<(Attempt & { id: string })[]>([]);
  const [assignments, setAssignments] = useState<(Assignment & { id: string })[]>([]);

  useEffect(() => {
    if (!user) return;
    const u1 = listenCollection<Attempt>("attempts", [where("studentId", "==", user.uid)], setAttempts);
    const u2 = listenCollection<Assignment>("assignments", [], setAssignments);
    return () => { u1(); u2(); };
  }, [user]);

  return (
    <AppShell requireRole="student">
      <h1 className="text-2xl font-bold text-brand-text mb-6">نتائجي</h1>
      <div className="flex flex-col gap-3">
        {attempts.map((att) => {
          const assignment = assignments.find((a) => a.id === att.assignmentId);
          const score = att.finalScore ?? att.autoScore;
          return (
            <GlassCard key={att.id} className="flex items-center justify-between">
              <div>
                <p className="font-bold text-brand-text">{assignment?.title ?? "واجب"}</p>
                <p className="text-brand-textMuted text-sm">
                  {att.status === "graded" ? "تم تصحيحه من المعلم" : "تصحيح تلقائي مبدئي"}
                </p>
                {att.teacherFeedback && (
                  <p className="text-brand-primary text-sm mt-1">ملاحظة: {att.teacherFeedback}</p>
                )}
              </div>
              <p className="text-2xl font-bold text-brand-primary">{score}</p>
            </GlassCard>
          );
        })}
        {attempts.length === 0 && <p className="text-brand-textMuted">لا توجد نتائج بعد.</p>}
      </div>
    </AppShell>
  );
}
