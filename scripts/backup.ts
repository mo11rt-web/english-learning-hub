/**
 * نسخة احتياطية مجانية بالكامل — بتصدّر كل بيانات Firestore لملفات JSON
 * داخل مجلد backups/، ومحفوظة كجزء من تاريخ نفس مستودع GitHub (بدون أي
 * تكلفة إضافية أو حاجة لخدمة تخزين خارجية).
 *
 * التشغيل يدويًا: npm run backup
 * التشغيل التلقائي: يوميًا عبر .github/workflows/backup.yml
 */
import admin from "firebase-admin";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

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

// كل الكوليكشنز المستخدمة بالمنصة — حدّث هالقائمة لو ضفت كوليكشن جديد لاحقًا
const COLLECTIONS = [
  "profiles", "stages", "groups", "units", "lessons", "lesson_progress",
  "vocabulary_items", "irregular_verbs", "question_bank", "past_exam_questions",
  "assignments", "attempts", "announcements", "files", "notifications",
  "results_shares",
];

async function main() {
  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = path.join(process.cwd(), "backups", stamp);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`🗄️  بدء النسخ الاحتياطي بتاريخ ${stamp}...`);
  let totalDocs = 0;

  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(docs, null, 2));
    totalDocs += docs.length;
    console.log(`  ✅ ${name}: ${docs.length} مستند`);
  }

  console.log(`\n✅ تم حفظ ${totalDocs} مستند بمجلد backups/${stamp}`);
}

main().catch((err) => {
  console.error("❌ فشل النسخ الاحتياطي:", err);
  process.exit(1);
});
