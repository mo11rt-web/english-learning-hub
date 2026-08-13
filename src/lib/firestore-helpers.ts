import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export function listenCollection<T>(
  path: string,
  constraints: QueryConstraint[],
  cb: (items: (T & { id: string })[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, path), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
    },
    (err) => {
      // بدون هالسطر، أي استعلام محتاج فهرس مركّب (composite index) غير
      // موجود بـ Firestore كان يفشل بصمت — القائمة تضل فاضية للأبد بدون
      // أي رسالة خطأ ولا حتى بالـ console. راجع firestore.indexes.json.
      console.error(`listenCollection("${path}") failed:`, err);
      onError?.(err);
    }
  );
}

export async function createDoc<T extends object>(path: string, data: T) {
  return addDoc(collection(db, path), data as any);
}

export async function updateDocById(
  path: string,
  id: string,
  data: Record<string, any>
) {
  return updateDoc(doc(db, path, id), data);
}

export async function deleteDocById(path: string, id: string) {
  return deleteDoc(doc(db, path, id));
}

export { where, orderBy };
