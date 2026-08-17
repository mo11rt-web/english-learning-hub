// Firebase Auth يحتاج بريدًا إلكترونيًا للمصادقة، لكن تسجيل الدخول بالمنصة
// يتم برقم الهاتف فقط (للمعلم والطالب). نحوّل رقم الهاتف داخليًا إلى بريد
// وهمي ثابت حسب الدور، بنفس الصيغة المستخدمة يدويًا لإنشاء حساب المدير
// الأول: 0956509473@teacher.com

export function normalizePhone(phone: string) {
  // إزالة أي مسافات أو شرطات أو رمز + يكتبه المستخدم بالغلط
  return phone.trim().replace(/[\s\-()]/g, "").replace(/^\+/, "");
}

export function phoneToEmail(phone: string, role: "teacher" | "student") {
  const domain = role === "teacher" ? "teacher.com" : "student.com";
  return `${normalizePhone(phone)}@${domain}`;
}
