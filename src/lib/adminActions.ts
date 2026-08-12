import { auth } from "@/lib/firebase";

async function callAdminApi(path: string, body: Record<string, unknown>) {
  if (!auth.currentUser) throw new Error("جلستك انتهت، سجّل الدخول من جديد");
  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "تعذر إتمام العملية");
  return data;
}

// يغيّر كلمة مرور طالب فورًا من جلسة المعلم — بدون أي ترقية لخطة Firebase،
// عبر مسار API داخلي بالمنصة نفسها (Next.js API Route) بصلاحيات Admin SDK
export async function adminResetStudentPassword(targetUid: string, newPassword: string) {
  await callAdminApi("/api/admin/reset-password", { targetUid, newPassword });
}

// يُستدعى تلقائيًا كل مرة يعدّل فيها المعلم رقم هاتف طالب، حتى يبقى تسجيل
// الدخول شغّال بالرقم الجديد فورًا
export async function syncStudentLoginEmail(targetUid: string, newPhone: string) {
  await callAdminApi("/api/admin/update-login-email", { targetUid, newPhone });
}
