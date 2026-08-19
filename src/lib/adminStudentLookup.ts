import type { DocumentReference, Firestore } from "firebase-admin/firestore";

export async function findStudentProfile(
  db: Firestore,
  identifier: string,
  phone?: string
): Promise<{ ref: DocumentReference; data: Record<string, any>; authUid: string } | null> {
  const value = identifier.trim();
  if (!value) return null;

  const directRef = db.doc(`profiles/${value}`);
  const directSnap = await directRef.get();
  if (directSnap.exists) {
    const data = directSnap.data() ?? {};
    return { ref: directRef, data, authUid: typeof data.uid === "string" && data.uid ? data.uid : value };
  }

  const uidSnap = await db.collection("profiles").where("uid", "==", value).limit(1).get();
  if (!uidSnap.empty) {
    const item = uidSnap.docs[0];
    const data = item.data();
    return { ref: item.ref, data, authUid: typeof data.uid === "string" && data.uid ? data.uid : item.id };
  }

  const normalizedPhone = typeof phone === "string" ? phone.trim() : "";
  if (normalizedPhone) {
    const phoneSnap = await db.collection("profiles").where("phone", "==", normalizedPhone).limit(1).get();
    if (!phoneSnap.empty) {
      const item = phoneSnap.docs[0];
      const data = item.data();
      return { ref: item.ref, data, authUid: typeof data.uid === "string" && data.uid ? data.uid : item.id };
    }
  }

  return null;
}
