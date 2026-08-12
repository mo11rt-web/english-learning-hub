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
  cb: (items: (T & { id: string })[]) => void
) {
  const q = query(collection(db, path), ...constraints);
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
  });
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
