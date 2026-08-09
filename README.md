# English Learning Hub — منصة الأستاذ لتعليم اللغة الإنجليزية

منصة تعليمية متكاملة (المرحلة الأولى / MVP) لمعلم لغة إنجليزية لإدارة الطلاب
والمراحل والمجموعات، وإنشاء دروس ومفردات مع نطق صوتي مجاني، وواجبات واختبارات
مع تصحيح تلقائي للأسئلة الموضوعية، ومتابعة تقدم الطلاب — كل ذلك متصل بقاعدة
بيانات حقيقية (Firebase) وليس بيانات وهمية.

هذا الإصدار يغطي **المرحلة الأولى (MVP)** المذكورة في مخطط المشروع الأصلي.
راجع قسم "خارطة الطريق" أسفل الصفحة لمعرفة ما تم تنفيذه وما هو مؤجل للمرحلتين
الثانية والثالثة.

---

## 1. المتطلبات

- Node.js 18 أو أحدث
- حساب [Firebase](https://console.firebase.google.com) مجاني (خطة Spark كافية)
- حساب [Vercel](https://vercel.com) أو [Netlify](https://netlify.com) مجاني للنشر

كل الخدمات المستخدمة مجانية ضمن الحدود السخية لخطط Firebase وVercel/Netlify
المجانية، وتكفي بسهولة لمعلم واحد وعدد محدود من الطلاب.

---

## 2. إعداد مشروع Firebase

1. افتح [console.firebase.google.com](https://console.firebase.google.com) وأنشئ مشروعًا جديدًا.
2. من القائمة الجانبية **Build → Authentication** → فعّل مزوّد **Email/Password**.
3. من **Build → Firestore Database** → أنشئ قاعدة بيانات (اختر أي موقع قريب منك، ووضع **Production mode**).
4. من **Build → Storage** → فعّل التخزين (Production mode أيضًا).
5. من **Project settings (⚙️) → General** → في قسم "Your apps" أضف تطبيق **Web** جديد،
   وانسخ قيم `firebaseConfig` (ستحتاجها في الخطوة التالية).
6. من **Project settings → Service accounts** → اضغط **Generate new private key**
   لتنزيل ملف JSON (يُستخدم فقط محليًا لسكربت البيانات التجريبية، لا يُرفع أبدًا للموقع).

---

## 3. تشغيل المشروع محليًا

```bash
npm install
cp .env.example .env.local
```

افتح `.env.local` واملأ:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# من ملف JSON الذي نزّلته في الخطوة 6 أعلاه (لسكربت seed فقط)
FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> ملاحظة: انسخ قيمة `private_key` كما هي من ملف JSON (بما فيها `\n`) وضعها بين علامتي تنصيص.

---

## 4. نشر قواعد الحماية (Firestore & Storage Rules)

القواعد جاهزة في `firestore.rules` و`storage.rules` وتطبّق:

- الطالب يرى فقط ملفه، ودرجاته، ومحاولاته الخاصة، والمحتوى المنشور المخصص لمرحلته.
- المعلم/المدير يرى ويدير كل شيء.
- لا أحد يمكنه الكتابة مباشرة في الدرجات النهائية غير المعلم.

لنشرها، ثبّت Firebase CLI مرة واحدة ثم شغّل:

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # اختر مشروعك الذي أنشأته في الخطوة 2
firebase deploy --only firestore:rules,storage:rules
```

---

## 5. إنشاء حساب المعلم الأول وبيانات تجريبية

بعد ضبط `FIREBASE_ADMIN_*` في `.env.local`:

```bash
npm run seed
```

هذا ينشئ:

- حساب معلم/مدير: `teacher@example.com` / `Teacher@123`
- 5 حسابات طلاب تجريبية (`student1` … `student5`) بكلمات مرور تظهر في الطرفية
- مرحلة، مجموعة، وحدة، درس منشور بكلمات ونطق، سؤال، وواجب منشور

**غيّر كلمة مرور حساب المعلم فور أول تسجيل دخول.** يمكنك حذف بيانات
`student1..5` لاحقًا من صفحة "إدارة الطلاب" داخل المنصة إن لم تعد بحاجتها.

---

## 6. التشغيل

```bash
npm run dev
```

افتح `http://localhost:3000` — سجّل الدخول بحساب المعلم من القسم أعلاه.
تسجيل دخول الطلاب من نفس الصفحة عبر تبويب "طالب" باسم المستخدم وكلمة المرور.

---

## 7. النشر (Vercel أو Netlify) — الرابط النهائي

### Vercel
1. ادفع المشروع إلى مستودع GitHub.
2. من [vercel.com/new](https://vercel.com/new) استورد المستودع.
3. أضف كل متغيرات `NEXT_PUBLIC_FIREBASE_*` من `.env.local` في إعدادات المشروع
   (Project Settings → Environment Variables). لا تُضف متغيرات `FIREBASE_ADMIN_*`
   على Vercel — هذه فقط لسكربت seed المحلي.
4. اضغط Deploy. ستحصل على رابط عام مجاني (`your-app.vercel.app`).

### Netlify
1. نفس الخطوات: ادفع إلى GitHub، ثم "Add new site → Import an existing project".
2. Build command: `npm run build` — Publish directory: `.next`
   (فعّل Netlify's Next.js Runtime تلقائيًا عند استيراد مشروع Next.js).
3. أضف متغيرات `NEXT_PUBLIC_FIREBASE_*` في Site settings → Environment variables.

بعد النشر، أضف نطاق موقعك (`your-app.vercel.app` أو مشابه) إلى:
**Firebase Console → Authentication → Settings → Authorized domains**
وإلا سيفشل تسجيل الدخول من الرابط المنشور.

---

## 8. هيكل المشروع

```
src/
  app/                    مسارات المعلم (dashboard, students, groups, units,
                          lessons, vocabulary, files, questions, assignments,
                          announcements) ومسارات الطالب (student/*) وصفحة login
  components/
    ui/                   GlassCard, Button, StatCard
    layout/               AppShell (حراسة الصلاحيات), Sidebar, MobileSidebar
    SpeakButton.tsx        زر النطق (أمريكي/بريطاني/بطيء)
  hooks/useAuth.tsx        سياق تسجيل الدخول + جلب الملف الشخصي والصلاحية
  lib/
    firebase.ts            تهيئة Firebase (Auth, Firestore, Storage)
    firestore-helpers.ts   دوال مساعدة عامة للاستماع/الإنشاء/التحديث/الحذف
    speech.ts               طبقة النطق (Web Speech API) — قابلة للاستبدال لاحقًا
                            بمزود سحابي دون تغيير واجهة الاستخدام
    grading.ts               حساب الدرجة التلقائية للأسئلة الموضوعية
    types.ts                 كل أنواع البيانات (TypeScript)
scripts/seed.ts             سكربت البيانات التجريبية (Firebase Admin SDK)
firestore.rules / storage.rules   قواعد الحماية (RLS)
```

---

## 9. خارطة الطريق — ما تم تنفيذه وما هو مؤجل

**تم تنفيذه في هذا الإصدار (المرحلة الأولى):**
تسجيل الدخول والصلاحيات (مدير/معلم مساعد لاحقًا/طالب) · المراحل والمجموعات ·
إدارة الطلاب (إنشاء حساب وكلمة مرور، تعطيل/تفعيل) · محرر دروس بكتل محتوى
(عناوين، فقرات عربي/إنجليزي، قواعد، أمثلة، صور، PDF، مفردات) · مكتبة مفردات
مع نطق أمريكي/بريطاني وسرعة بطيئة وبطاقات Flashcards · رفع وعرض ملفات PDF/صور/صوت ·
بنك أسئلة (اختيار من متعدد، صح/خطأ، إكمال فراغ، إجابة قصيرة، مقالي) · إنشاء
واجبات واختبارات لمجموعة محددة · حل الطالب للواجب وتصحيح تلقائي فوري للأسئلة
الموضوعية · صفحة تصحيح للمعلم مع درجة نهائية وملاحظة · نتائج الطالب · إعلانات ·
لوحة تحكم بإحصائيات حية · تتبع فتح/إكمال الدرس · تصميم متجاوب بالكامل RTL/LTR.

**مؤجل عمدًا للمرحلة الثانية** (كما حددتها الخطة الأصلية، لإبقاء هذا الإصدار
قابلًا للاختبار والتسليم فعليًا):
مكتبة القواعد والأزمنة المنظمة · مكتبة الأفعال الشاذة · استيراد درس من PDF أو
رابط ويب بمساعدة الذكاء الاصطناعي · مساعد الذكاء الاصطناعي للمعلم · تحليل
أخطاء الطلاب التجميعي · التقارير القابلة للتصدير (PDF/Excel) · معلم مساعد
بصلاحيات محدودة (البنية جاهزة في قاعدة البيانات لكن الواجهة غير مبنية بعد).

**مؤجل للمرحلة الثالثة:** تدريب النطق عبر الميكروفون وSpeech-to-Text · حساب
ولي الأمر · الحضور والغياب · الإشعارات الفورية (Push) · الدروس المباشرة ·
الشهادات والاشتراكات.

---

## 10. قيود معروفة في هذا الإصدار (MVP)

- **النطق**: يستخدم Web Speech API المجاني في المتصفح — الجودة والأصوات
  المتاحة تختلف حسب الجهاز والمتصفح (تعمل بشكل ممتاز على Chrome). طبقة
  `lib/speech.ts` مصممة بواجهة موحّدة بحيث يمكن استبدالها لاحقًا بمزود سحابي
  (Google/Azure/ElevenLabs) دون تغيير أي مكوّن آخر في الواجهة.
- **التصحيح التلقائي**: يتم حاليًا من جهة المتصفح (Client-side) لتبسيط
  الإصدار الأول، ما يعني أن الإجابة الصحيحة تقنيًا قابلة للقراءة من كود
  الصفحة من قبل مستخدم متمرّس. لإخفائها تمامًا، يُنصح بنقل التصحيح إلى
  Cloud Function في المرحلة القادمة.
- **معلم مساعد**: نوع الحساب موجود في قاعدة البيانات لكن واجهة إدارته
  (تعيين مجموعات محددة له) غير مبنية في هذا الإصدار.

---

## 11. الأمان

- كلمات المرور لا تُخزَّن أبدًا في Firestore — Firebase Authentication وحده
  يديرها.
- Row Level Security مطبّقة عبر `firestore.rules` و`storage.rules`: الطالب
  يقرأ ويكتب بياناته فقط، والمعلم/المدير فقط يملك صلاحية الكتابة على المحتوى
  التعليمي.
- مفاتيح Firebase العامة (`NEXT_PUBLIC_*`) آمنة للنشر في المتصفح بتصميم
  Firebase نفسه؛ الحماية الفعلية تأتي من القواعد وليس من إخفاء المفاتيح.
  مفاتيح `FIREBASE_ADMIN_*` لا تُستخدم إلا محليًا في `scripts/seed.ts` ولا
  يجب رفعها أبدًا لأي بيئة نشر عامة.
