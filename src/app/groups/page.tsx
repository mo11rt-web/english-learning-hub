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
import ActionsDropdown from "@/components/ui/ActionsDropdown";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Group, StudentProfile } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function GroupsPage() {
  const [groups, setGroups] = useState<(Group & { id: string })[]>([]);
  const [students, setStudents] = useState<(StudentProfile & { id: string })[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<(Group & { id: string }) | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { user } = useAuth();
  const { stageId, stageName } = useWorkspace();

  useEffect(() => {
    const u = listenCollection<Group>("groups", [], setGroups);
    const uStudents = listenCollection<StudentProfile>("profiles", [], (all) => setStudents(all.filter((profile) => profile.role === "student") as (StudentProfile & { id: string })[]));
    return () => { u(); uStudents(); };
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
          <div className="flex flex-col">
            {groupsInWorkspace.map((g) => {
              const leaderboardOn = g.leaderboardEnabled !== false;
              const isExpanded = expandedGroupId === g.id;
              const members = students
                .filter((student) => student.stageId === stageId && student.status !== "deleted" && (student.groupIds ?? []).includes(g.id))
                .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
              const rankLabels = ["الأول", "الثاني", "الثالث"];
              const rankIcons = ["🥇", "🥈", "🥉"];

              return (
                <div key={g.id} className="border-b border-surfaceBorder/50 last:border-b-0">
                  <div className="flex items-center gap-2.5 px-2.5 py-2.5">
                    <button
                      type="button"
                      onClick={() => setExpandedGroupId((current) => current === g.id ? null : g.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-primary hover:bg-brand-primary/10 active:bg-brand-primary/15 transition-colors"
                      aria-label={isExpanded ? `إخفاء طلاب ${g.name}` : `عرض طلاب ${g.name}`}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
                    </button>
                    <div className="w-[42px] h-[42px] shrink-0 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-white text-sm font-bold flex items-center justify-center">
                      {g.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-bold text-brand-text truncate">{g.name}</span>
                        <button
                          onClick={() => toggleLeaderboard(g)}
                          className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${
                            leaderboardOn
                              ? "bg-brand-primary/10 text-brand-primary"
                              : "bg-brand-textMuted/10 text-brand-textMuted"
                          }`}
                        >
                          🏆 {leaderboardOn ? "ظاهرة" : "مخفية"}
                        </button>
                      </div>
                      <p className="text-[11px] text-brand-textMuted mt-0.5">{members.length} طالب</p>
                    </div>
                    <div className="shrink-0"><ActionsDropdown actions={[{ label: "حذف المجموعة", icon: <Trash2 className="w-4 h-4" />, onClick: () => setDeleteTarget(g), variant: "danger" }]} /></div>
                  </div>

                  {isExpanded && (
                    <div className="mx-3 mb-3 rounded-2xl border border-brand-primary/10 bg-surface/45 overflow-hidden">
                      <div className="px-3 py-2 text-[11px] font-bold text-brand-textMuted border-b border-surfaceBorder/50">طلاب المجموعة — مرتّبون حسب النقاط</div>
                      {members.map((student, index) => {
                        const isTopThree = index < 3;
                        return (
                          <div key={student.id} className={`flex items-center gap-2.5 px-3 py-2 border-b border-surfaceBorder/40 last:border-b-0 ${isTopThree ? "bg-brand-gold/10" : ""}`}>
                            <span className={`min-w-12 text-center text-[11px] font-bold ${isTopThree ? "text-brand-primary" : "text-brand-textMuted"}`}>{isTopThree ? `${rankIcons[index]} ${rankLabels[index]}` : `#${index + 1}`}</span>
                            <span className={`flex-1 min-w-0 truncate text-sm ${isTopThree ? "font-bold text-brand-text" : "text-brand-text"}`}>{student.fullName}</span>
                            <span className="text-xs font-bold text-brand-primary whitespace-nowrap">{student.points ?? 0} نقطة</span>
                          </div>
                        );
                      })}
                      {members.length === 0 && <p className="px-3 py-5 text-center text-xs text-brand-textMuted">لا يوجد طلاب في هذه المجموعة.</p>}
                    </div>
                  )}
                </div>
              );
            })}
            {groupsInWorkspace.length === 0 && (
              <p className="text-brand-textMuted text-sm text-center py-8">
                لا توجد مجموعات بهذا الفرع بعد.
              </p>
            )}
          </div>
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
