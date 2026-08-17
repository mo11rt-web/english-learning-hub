import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Group, LeaderboardEntry, LeaderboardPeriod, LeaderboardSettings, StudentProfile } from "@/lib/types";

export const DEFAULT_LEADERBOARD_SETTINGS: Omit<LeaderboardSettings, "stageId" | "updatedAt" | "updatedBy" | "entries"> = {
  enabled: true,
  limit: 5,
  period: "month",
};

export async function getLeaderboardSettings(stageId: string): Promise<LeaderboardSettings> {
  const snap = await getDoc(doc(db, "public_leaderboards", stageId));
  return snap.exists()
    ? ({ ...DEFAULT_LEADERBOARD_SETTINGS, ...(snap.data() as Partial<LeaderboardSettings>), stageId, entries: (snap.data().entries ?? []) } as LeaderboardSettings)
    : ({ ...DEFAULT_LEADERBOARD_SETTINGS, stageId, entries: [], updatedAt: 0, updatedBy: "" } as LeaderboardSettings);
}

export async function calculateLeaderboard(stageId: string, limit: number): Promise<LeaderboardEntry[]> {
  const [studentsSnapshot, groupsSnapshot] = await Promise.all([
    getDocs(query(collection(db, "profiles"), where("role", "==", "student"), where("stageId", "==", stageId))),
    getDocs(collection(db, "groups")),
  ]);
  const groups = new Map(groupsSnapshot.docs.map((item) => [item.id, (item.data() as Group).name]));
  const activeStudents = studentsSnapshot.docs
    .map((item) => ({ ...(item.data() as StudentProfile), uid: item.id }))
    .filter((student) => student.status === "active");

  const entries: (LeaderboardEntry & { groupIds?: string[] })[] = [];
  
  // تصنيف الطلاب وترتيبهم ضمن مجموعاتهم أو بشكل عام إذا لم تكن لهم مجموعة
  activeStudents
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .forEach((student, index) => {
      const gNames = (student.groupIds ?? []).map((id) => groups.get(id)).filter(Boolean).join("، ") || "بدون مجموعة";
      entries.push({
        rank: index + 1,
        studentName: student.fullName,
        groupName: gNames,
        points: student.points ?? 0,
        groupIds: student.groupIds ?? [],
      });
    });

  return entries;
}

export async function refreshPublicLeaderboard(stageId: string, settings: { enabled: boolean; limit: number; period: LeaderboardPeriod }, updatedBy: string) {
  const entries = settings.enabled ? await calculateLeaderboard(stageId, settings.limit) : [];
  const payload: LeaderboardSettings = {
    stageId,
    enabled: settings.enabled,
    limit: settings.limit,
    period: settings.period,
    entries,
    updatedAt: Date.now(),
    updatedBy,
  };
  await setDoc(doc(db, "public_leaderboards", stageId), payload, { merge: true });
  return payload;
}
