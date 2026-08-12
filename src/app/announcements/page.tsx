"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { listenCollection, createDoc, orderBy } from "@/lib/firestore-helpers";
import { Announcement, Group } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { notifyUsers, getStudentUidsForStage } from "@/lib/notifications";

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { stageId: workspaceStageId, stageName: workspaceStageName } = useWorkspace();
  const [items, setItems] = useState<(Announcement & { id: string })[]>([]);
  const [groups, setGroups] = useState<(Group & { id: string })[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");

  useEffect(() => {
    const u1 = listenCollection<Announcement>("announcements", [orderBy("createdAt", "desc")], setItems);
    const u2 = listenCollection<Group>("groups", [], setGroups);
    return () => { u1(); u2(); };
  }, []);

  const groupsInWorkspace = groups.filter((g) => g.stageId === workspaceStageId);

  const send = async () => {
    if (!title.trim() || !body.trim() || !user) return;
    await createDoc("announcements", {
      title, body,
      targetGroupIds: targetGroupId ? [targetGroupId] : [],
      createdBy: user.uid,
      createdAt: Date.now(),
    });
    if (workspaceStageId) {
      const studentUids = await getStudentUidsForStage(
        workspaceStageId,
        targetGroupId ? [targetGroupId] : []
      );
      await notifyUsers(studentUids, {
        title: "إعلان من المعلم",
        body: title,
        type: "announcement",
        link: "/student/home",
      });
    }
    setTitle(""); setBody("");
  };

  return (
    <AppShell requireRole="teacher">
      <h1 className="text-2xl font-bold text-brand-text mb-6">الإعلانات</h1>

      <GlassCard className="mb-6">
        <h2 className="font-bold text-brand-text mb-4">إعلان جديد</h2>
        <div className="flex flex-col gap-3">
          <input placeholder="العنوان" value={title} onChange={(e) => setTitle(e.target.value)}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
          <textarea placeholder="نص الإعلان" value={body} onChange={(e) => setBody(e.target.value)}
            rows={3} className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70" />
          <select value={targetGroupId} onChange={(e) => setTargetGroupId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-brand-primary/25 bg-surface/70">
            <option value="">جميع الطلاب (كل الأقسام)</option>
            {groupsInWorkspace.map((g) => <option key={g.id} value={g.id}>{g.name} — {workspaceStageName}</option>)}
          </select>
          <Button onClick={send}>نشر الإعلان</Button>
        </div>
      </GlassCard>

      <div className="flex flex-col gap-3">
        {items.map((a) => (
          <GlassCard key={a.id}>
            <h3 className="font-bold text-brand-text">{a.title}</h3>
            <p className="text-brand-text text-sm mt-1">{a.body}</p>
          </GlassCard>
        ))}
        {items.length === 0 && <p className="text-brand-textMuted">لا توجد إعلانات بعد.</p>}
      </div>
    </AppShell>
  );
}
