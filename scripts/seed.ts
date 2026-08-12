/**
 * سكربت بيانات تجريبية.
 * التشغيل: npm run seed
 * يتطلب متغيرات FIREBASE_ADMIN_* في .env.local
 */
import admin from "firebase-admin";
import "dotenv/config";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function main() {
  console.log("🌱 بدء إنشاء البيانات التجريبية...");

  // 1) حساب المعلم/المدير (تسجيل الدخول برقم الهاتف)
  const teacherPhone = "0900000000";
  const teacherEmail = `${teacherPhone}@teacher.com`;
  const teacherPassword = "Teacher@123";
  let teacherUid: string;
  try {
    const existing = await auth.getUserByEmail(teacherEmail);
    teacherUid = existing.uid;
  } catch {
    const user = await auth.createUser({ email: teacherEmail, password: teacherPassword });
    teacherUid = user.uid;
  }
  await db.collection("profiles").doc(teacherUid).set({
    uid: teacherUid,
    fullName: "الأستاذ محمد",
    role: "admin",
    phone: teacherPhone,
    email: teacherEmail,
    status: "active",
    createdAt: Date.now(),
  });
  console.log(`✅ حساب المعلم: هاتف ${teacherPhone} / ${teacherPassword}`);

  // 2) المراحل
  const stageRef = await db.collection("stages").add({ name: "الصف التاسع", order: 0 });
  const stageId = stageRef.id;

  // 3) مجموعة
  const groupRef = await db.collection("groups").add({
    name: "مجموعة A",
    stageId,
    teacherIds: [teacherUid],
    createdAt: Date.now(),
  });

  // 4) خمسة طلاب (تسجيل الدخول برقم الهاتف)
  const studentCreds: { phone: string; password: string }[] = [];
  for (let i = 1; i <= 5; i++) {
    const phone = `090000000${i}`;
    const password = `Student${i}23`;
    const email = `${phone}@student.com`;
    let uid: string;
    try {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
    } catch {
      const user = await auth.createUser({ email, password });
      uid = user.uid;
    }
    await db.collection("profiles").doc(uid).set({
      uid,
      fullName: `الطالب رقم ${i}`,
      role: "student",
      username: phone,
      phone,
      studentNumber: `STU-00${i}`,
      stageId,
      groupIds: [groupRef.id],
      status: "active",
      createdAt: Date.now(),
    });
    studentCreds.push({ phone, password });
  }

  // 5) وحدة ودرس
  const unitRef = await db.collection("units").add({
    title: "Unit 1", stageId, order: 0, status: "published", createdAt: Date.now(),
  });

  await db.collection("lessons").add({
    title: "Present Simple",
    unitId: unitRef.id,
    stageId,
    status: "published",
    order: 0,
    targetGroupIds: [],
    createdBy: teacherUid,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    publishedAt: Date.now(),
    blocks: [
      { id: "b1", type: "heading", content: "Present Simple / المضارع البسيط", order: 0 },
      { id: "b2", type: "paragraph-ar", content: "يُستخدم المضارع البسيط للحديث عن العادات والحقائق الثابتة.", order: 1 },
      { id: "b3", type: "vocabulary-word", content: "achieve", order: 2 },
      { id: "b4", type: "example", content: "She achieves her goals every year.", order: 3 },
    ],
  });

  // 6) كلمات
  const words = [
    { word: "achieve", translation: "يحقق" },
    { word: "improve", translation: "يحسّن" },
    { word: "environment", translation: "بيئة" },
    { word: "decision", translation: "قرار" },
    { word: "responsibility", translation: "مسؤولية" },
  ];
  for (const w of words) {
    await db.collection("vocabulary_items").add({
      ...w,
      wordType: "noun",
      difficulty: "medium",
      stageId,
      createdAt: Date.now(),
    });
  }

  // 7) سؤال + واجب
  const qRef = await db.collection("question_bank").add({
    text: "Choose the correct form: She ___ to school every day.",
    type: "mcq",
    options: ["go", "goes", "going", "gone"],
    correctAnswer: "goes",
    points: 1,
    difficulty: "easy",
    stageId,
    autoGrade: true,
    createdBy: teacherUid,
    createdAt: Date.now(),
  });

  await db.collection("assignments").add({
    title: "واجب Present Simple",
    type: "homework",
    targetGroupIds: [groupRef.id],
    lessonIds: [],
    questionIds: [qRef.id],
    maxAttempts: 1,
    passingScore: 60,
    showScoreImmediately: true,
    showCorrectAnswers: false,
    shuffleQuestions: false,
    status: "published",
    createdBy: teacherUid,
    createdAt: Date.now(),
  });

  console.log("\n✅ تمت تعبئة البيانات التجريبية بنجاح.\n");
  console.log("بيانات دخول المعلم:", teacherEmail, "/", teacherPassword);
  console.log("بيانات دخول الطلاب:");
  studentCreds.forEach((s) => console.log(" - هاتف:", s.phone, "/", s.password));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
