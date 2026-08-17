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

// ============================================================
// ناقل أخطاء عام: أي خطأ بأي استماع Firestore بالتطبيق (حتى لو
// المستدعي ما مرّر onError خاص فيه) يوصل تلقائيًا لأي مكوّن مشترك
// بالتطبيق (متل GlobalErrorToast). هيك نضمن إنه ما فيه ولا صفحة
// بتفشل بصمت — كانت هاي المشكلة الأصلية اللي خلّت شاشة اختيار
// القسم تعلّق للأبد بدون أي تفسير للمستخدم.
// ============================================================
type FirestoreErrorListener = (err: Error, path: string) => void;
const globalErrorListeners = new Set<FirestoreErrorListener>();

export function onFirestoreError(fn: FirestoreErrorListener) {
  globalErrorListeners.add(fn);
  return () => globalErrorListeners.delete(fn);
}

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
      // قبل هيك أي خطأ هون (مثلاً فهرس Firestore ناقص أو صلاحية مرفوضة)
      // كان يختفي بصمت بالكونسول فقط، والواجهة تبقى فاضية أو عالقة للأبد
      // بدون أي تفسير. هلق: (1) أي مستدعي يقدر يمرر onError خاص فيه،
      // و(2) بكل الحالات الخطأ يوصل تلقائيًا لـ GlobalErrorToast.
      console.error(`[listenCollection:${path}] `, err);
      onError?.(err);
      globalErrorListeners.forEach((fn) => fn(err, path));
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
