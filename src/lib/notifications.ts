import { collection, getDocs, query, where, writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createDoc } from "@/lib/firestore-helpers";
import { Notification } from "@/lib/types";

// يرسل نفس الإشعار لعدة مستخدمين دفعة واحدة (Batch) لتقليل عدد عمليات الكتابة
export async function notifyUsers(
  userIds: string[],
  data: Omit<Notification, "id" | "userId" | "createdAt">
) {
  const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
  if (uniqueIds.length === 0) return;
  const batch = writeBatch(db);
  const createdAt = Date.now();
  for (const uid of uniqueIds) {
    const ref = doc(collection(db, "notifications"));
    batch.set(ref, { ...data, userId: uid, createdAt });
  }
  await batch.commit();
}

// يجيب كل معرّفات الطلاب النشطين ضمن مرحلة معينة (وضمن مجموعات محددة إن وُجدت)
export async function getStudentUidsForStage(
  stageId: string,
  groupIds: string[] = []
): Promise<string[]> {
  const q = query(
    collection(db, "profiles"),
    where("role", "==", "student"),
    where("stageId", "==", stageId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .filter((d) => d.data().status === "active")
    .filter((d) => {
      if (groupIds.length === 0) return true;
      const studentGroups: string[] = d.data().groupIds ?? [];
      return studentGroups.some((g) => groupIds.includes(g));
    })
    .map((d) => d.id);
}

// يجيب معرّفات كل المعلمين/المدراء (لإشعارهم بأحداث الطلاب، مثل تسليم واجب)
export async function getTeacherUids(): Promise<string[]> {
  const q = query(collection(db, "profiles"), where("role", "in", ["admin", "teacher"]));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.id);
}
