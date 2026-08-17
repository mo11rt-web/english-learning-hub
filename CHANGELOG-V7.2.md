# English Hub v7.2

## الإصلاحات المنفذة

### 1. شريط التنقل السفلي
تمت زيادة مساحة الأمان أسفل محتوى الصفحات على الهاتف، وإعادة رفع رسائل الأخطاء فوق شريط التنقل، حتى لا يظهر نص أو إشعار خلف الأزرار العائمة.

### 2. رابط يوتيوب
أصبح التطبيق يقبل روابط يوتيوب المكتوبة مع أو بدون `https://`، وروابط `youtube.com/watch`, `youtu.be`, `youtube.com/shorts` و`embed`.

### 3. Firebase Admin
تم توسيع التهيئة الخادمية لتقبل:

* `FIREBASE_ADMIN_PROJECT_ID` و`FIREBASE_ADMIN_CLIENT_EMAIL` و`FIREBASE_ADMIN_PRIVATE_KEY`.
* `FIREBASE_SERVICE_ACCOUNT_JSON` أو `FIREBASE_ADMIN_SERVICE_ACCOUNT`.
* `FIREBASE_SERVICE_ACCOUNT_BASE64`.
* بدائل المفتاح `FIREBASE_PRIVATE_KEY` و`FIREBASE_PRIVATE_KEY_BASE64`.

استخدم صيغة JSON الواحدة أو المتغيرات الثلاثة، وليس الاثنين معًا. بعد تعديل Environment Variables في Vercel يجب تنفيذ Redeploy من دون Cache أو دفع Commit جديد.

### 4. تغيير كلمة المرور والحذف النهائي
أصبح الخادم يبحث عن الطالب عبر معرّف المستند أو UID الداخلي أو رقم الهاتف، لذلك تعمل العمليات أيضاً مع السجلات القديمة التي يختلف فيها معرّف مستند Firestore عن UID الخاص بـ Firebase Authentication. الحذف النهائي ينظف حساب Authentication والملف والبيانات التابعة المعروفة.

### 5. الأداء
تم تقليل قراءات جرس الإشعارات إلى آخر 20 إشعاراً، وإلغاء إجبار تحديث رمز الدخول عند كل فتح لتقرير النتائج أو الواجب، مع إبقاء التحقق الخادمي. كما يتجاوز التقرير الواجبات المحذوفة أو غير المنشورة ولا يتوقف بسببها، ويضع مهلة لطلب الترتيب.

## الفحوصات

* `npx tsc --noEmit`: ناجح.
* `npm run build`: ناجح.
* اختبار دخان لخادم الإنتاج المحلي: صفحة الدخول والصفحة المحمية استجابتا، ومسار الأسئلة أعاد `401` عند طلبه بلا رمز كما هو متوقع.

## خطوات النشر الضرورية

1. ارفع ملفات المشروع الجديد إلى GitHub.
2. في Vercel أضف متغيرات Firebase العامة كما في `.env.example`.
3. أضف أحد إعدادات Firebase Admin التالية:
   * `FIREBASE_SERVICE_ACCOUNT_JSON`: كامل محتوى ملف Service Account JSON في قيمة واحدة، أو
   * المتغيرات الثلاثة `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`.
4. فعّل المتغيرات للبيئات `Production` و`Preview` التي تستخدمها.
5. نفّذ Redeploy بعد حفظ المتغيرات. لا يكفي حفظ المتغيرات من دون إعادة النشر.
6. انشر `firestore.rules` المرفق إذا لم يكن آخر إصدار منشوراً.
