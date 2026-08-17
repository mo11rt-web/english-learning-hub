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

  // محاولة إرسال Push Notification (اختياري)
  try {
    if (auth.currentUser) {
      // هنا يمكن إضافة استدعاء لـ API خارجي لإرسال Push Notification حقيقية
      // سنكتفي حالياً بتجهيز البيانات
    }
  } catch (err) {
    // تجاهل
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
