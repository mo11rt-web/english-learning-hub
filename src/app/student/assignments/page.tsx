"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { useAuth } from "@/hooks/useAuth";
import { listenCollection, where } from "@/lib/firestore-helpers";
import { Assignment, Attempt, StudentProfile } from "@/lib/types";

export default function StudentAssignmentsPage() {
  const { user, profile } = useAuth();
  const student = profile as StudentProfile | null;
  const [assignments, setAssignments] = useState<(Assignment & { id: string })[]>([]);
  const [attempts, setAttempts] = useState<(Attempt & { id: string })[]>([]);

  useEffect(() => {
    const u1 = listenCollection<Assignment>("assignments", [where("status", "==", "published")], setAssignments);
    if (user) {
      const u2 = listenCollection<Attempt>("attempts", [where("studentId", "==", user.uid)], setAttempts);
      return () => { u1(); u2(); };
    }
    return () => u1();
  }, [user]);

  const myAssignments = assignments.filter(
    (a) =>
      a.targetGroupIds.length === 0 ||
      a.targetGroupIds.some((g) => student?.groupIds?.includes(g))
  );

  return (
    <AppShell requireRole="student">
      <h1 className="text-2xl font-bold text-brand-text mb-6">الواجبات والاختبارات</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myAssignments.map((a) => {
          const done = attempts.find((att) => att.assignmentId === a.id);
          return (
            <Link key={a.id} href={`/student/assignments/${a.id}`}>
              <GlassCard className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <h3 className="font-bold text-brand-text mb-1">{a.title}</h3>
                <p className="text-brand-textMuted text-sm mb-2">{a.questionIds.length} سؤال</p>
                <span className={`text-xs px-2 py-1 rounded-full ${done ? "bg-brand-success/15 text-brand-success" : "bg-brand-warning/15 text-brand-warning"}`}>
                  {done ? "تم الحل" : "لم يُحل بعد"}
                </span>
              </GlassCard>
            </Link>
          );
        })}
        {myAssignments.length === 0 && <p className="text-brand-textMuted">لا توجد واجبات حاليًا.</p>}
      </div>
    </AppShell>
  );
}
