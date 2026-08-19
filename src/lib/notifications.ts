import { collection, doc, getDocs, limit, orderBy, query, where, writeBatch, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Notification } from "@/lib/types";

const MAX_NOTIFICATIONS = 10;

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
    batch.set(ref, { ...data, userId: uid, createdAt, read: false });
  }
  await batch.commit();

  // تنظيف الإشعارات القديمة (إبقاء آخر 10 فقط) لكل مستخدم بشكل غير متزامن
  uniqueIds.forEach(async (uid) => {
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      if (snap.size > MAX_NOTIFICATIONS) {
        const toDelete = snap.docs.slice(MAX_NOTIFICATIONS);
        const deleteBatch = writeBatch(db);
        toDelete.forEach((d) => deleteBatch.delete(d.ref));
        await deleteBatch.commit();
      }
    } catch (err) {
      console.error("Failed to prune notifications for user:", uid, err);
    }
  });

  // إرسال Push حقيقي عبر FCM (أندرويد + متصفح) — استدعاء /api/notifications/send
  // (شوف src/app/api/notifications/send/route.ts). هذا الاستدعاء "fire and
  // forget": إذا فشل (لا يوجد اتصال، توكن منتهي...) ما نعطّل بقية التطبيق،
  // لأن الإشعار داخل التطبيق (Firestore، فوق) كتب بنجاح أصلاً بأي الحالتين.
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (idToken) {
      await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ userIds: uniqueIds, title: data.title, body: data.body, link: data.link }),
      });
    }
  } catch (err) {
    console.warn("Push notification request failed (in-app notification was still created):", err);
  }
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
