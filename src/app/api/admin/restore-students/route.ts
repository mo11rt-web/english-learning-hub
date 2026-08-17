import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { normalizePhone, phoneToEmail } from "@/lib/phone";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_RECORDS = 500;

interface StudentBackupRecord {
  uid?: string;
  fullName?: string;
  phone?: string;
  username?: string;
  address?: string;
  studentNumber?: string;
  stageId?: string;
  groupIds?: string[];
  status?: "active" | "disabled" | "deleted";
  points?: number;
  mustChangePassword?: boolean;
  level?: string;
  guardianName?: string;
  guardianPhone?: string;
  notes?: string;
  createdAt?: number;
}

function bearerToken(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function temporaryPassword() {
  return `${randomBytes(6).toString("base64url")}A1!`;
}

function isSafeUid(uid: unknown): uid is string {
  return typeof uid === "string" && /^[A-Za-z0-9:_-]{1,128}$/.test(uid);
}

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanStringArray(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 128))))
    : [];
}

function errorMessage(error: any) {
  if (typeof error?.message === "string" && error.message.includes("متغيرات حساب خدمة Firebase")) {
    return "إعدادات Firebase Admin غير مكتملة على الخادم.";
  }
  if (error?.code === "auth/id-token-expired") return "انتهت صلاحية جلستك، سجّل الدخول من جديد.";
  if (error?.code === "auth/invalid-id-token" || error?.code === "auth/argument-error") {
    return "جلسة الدخول غير صالحة، سجّل الدخول من جديد.";
  }
  return "تعذر استعادة الطلاب من الملف.";
}

export async function POST(req: NextRequest) {
  try {
    const token = bearerToken(req);
    if (!token) return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });

    const auth = adminAuth();
    const db = adminDb();
    const caller = await auth.verifyIdToken(token);
    const callerProfile = await db.doc(`profiles/${caller.uid}`).get();
    const role = callerProfile.exists ? callerProfile.data()?.role : null;
    if (role !== "teacher" && role !== "admin") {
      return NextResponse.json({ error: "غير مصرح — هذه الميزة للمعلم/المدير فقط." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const records = Array.isArray(body?.students) ? body.students : [];
    if (records.length === 0) {
      return NextResponse.json({ error: "الملف لا يحتوي على طلاب صالحين." }, { status: 400 });
    }
    if (records.length > MAX_RECORDS) {
      return NextResponse.json({ error: `الحد الأقصى للاستعادة في العملية الواحدة هو ${MAX_RECORDS} طالب.` }, { status: 400 });
    }

    const seenPhones = new Set<string>();
    const result = {
      created: 0,
      updated: 0,
      failed: 0,
      credentials: [] as { fullName: string; phone: string; password: string }[],
      errors: [] as { row: number; phone?: string; message: string }[],
    };

    for (let index = 0; index < records.length; index += 1) {
      const raw = records[index] as StudentBackupRecord;
      const fullName = cleanText(raw?.fullName, 160);
      const phone = normalizePhone(cleanText(raw?.phone || raw?.username, 80));
      if (!fullName || !phone) {
        result.failed += 1;
        result.errors.push({ row: index + 1, message: "الاسم ورقم الهاتف مطلوبان." });
        continue;
      }
      if (seenPhones.has(phone)) {
        result.failed += 1;
        result.errors.push({ row: index + 1, phone, message: "رقم الهاتف مكرر داخل الملف." });
        continue;
      }
      seenPhones.add(phone);

      const email = phoneToEmail(phone, "student");
      const desiredUid = isSafeUid(raw?.uid) ? raw.uid : undefined;
      const groupIds = cleanStringArray(raw?.groupIds);
      const stageId = cleanText(raw?.stageId, 128);
      const studentNumber = cleanText(raw?.studentNumber, 80) || `STU-${Date.now().toString().slice(-6)}-${index + 1}`;
      const profileData = {
        uid: desiredUid ?? "",
        fullName,
        role: "student" as const,
        username: phone,
        phone,
        address: cleanText(raw?.address, 300),
        studentNumber,
        stageId,
        groupIds,
        status: "active" as const,
        points: Number.isFinite(Number(raw?.points)) ? Math.max(0, Number(raw.points)) : 0,
        mustChangePassword: raw?.mustChangePassword !== false,
        ...(cleanText(raw?.level, 40) ? { level: cleanText(raw.level, 40) } : {}),
        ...(cleanText(raw?.guardianName, 160) ? { guardianName: cleanText(raw.guardianName, 160) } : {}),
        ...(cleanText(raw?.guardianPhone, 80) ? { guardianPhone: cleanText(raw.guardianPhone, 80) } : {}),
        ...(cleanText(raw?.notes, 1000) ? { notes: cleanText(raw.notes, 1000) } : {}),
        createdAt: Number.isFinite(Number(raw?.createdAt)) ? Number(raw.createdAt) : Date.now(),
      };

      try {
        let authUser: any = null;
        if (desiredUid) {
          const existingUidProfile = await db.doc(`profiles/${desiredUid}`).get();
          const existingUidRole = existingUidProfile.exists ? existingUidProfile.data()?.role : null;
          if (existingUidRole && existingUidRole !== "student") {
            throw new Error("لا يمكن استعادة سجل طالب فوق ملف معلم أو مدير.");
          }
        }
        if (desiredUid) {
          try { authUser = await auth.getUser(desiredUid); } catch (error: any) {
            if (error?.code !== "auth/user-not-found") throw error;
          }
        }
        if (!authUser) {
          try { authUser = await auth.getUserByEmail(email); } catch (error: any) {
            if (error?.code !== "auth/user-not-found") throw error;
          }
        }

        if (authUser) {
          const existingProfile = await db.doc(`profiles/${authUser.uid}`).get();
          const existingRole = existingProfile.exists ? existingProfile.data()?.role : null;
          if ((existingRole && existingRole !== "student") || authUser.email?.endsWith("@teacher.com")) {
            throw new Error("لا يمكن استعادة سجل طالب فوق حساب معلم أو مدير.");
          }
        }

        let isNew = false;
        let generatedPassword = "";
        if (!authUser) {
          generatedPassword = temporaryPassword();
          authUser = await auth.createUser({
            ...(desiredUid ? { uid: desiredUid } : {}),
            email,
            password: generatedPassword,
            displayName: fullName,
          });
          isNew = true;
        } else if (authUser.email !== email || authUser.displayName !== fullName) {
          authUser = await auth.updateUser(authUser.uid, { email, displayName: fullName });
        }

        await db.doc(`profiles/${authUser.uid}`).set(
          { ...profileData, uid: authUser.uid },
          { merge: true }
        );

        if (isNew) {
          result.created += 1;
          result.credentials.push({ fullName, phone, password: generatedPassword });
        } else {
          result.updated += 1;
        }
      } catch (error: any) {
        result.failed += 1;
        result.errors.push({ row: index + 1, phone, message: error?.code === "auth/email-already-exists" ? "البريد الداخلي مستخدم لحساب آخر." : "تعذر إنشاء أو تحديث الحساب." });
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("[restore-students] error:", error);
    const status = error?.code === "auth/id-token-expired" || error?.code === "auth/invalid-id-token" || error?.code === "auth/argument-error" ? 401 : 500;
    return NextResponse.json({ error: errorMessage(error) }, { status });
  }
}
