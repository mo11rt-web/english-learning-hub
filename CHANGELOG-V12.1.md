# English Hub v12.1 — رفع الصور مجاناً مثل علاوي نت

## الحل المعتمد

تم فحص أرشيف تطبيق علاوي نت، وتبين أنه لا يستخدم Firebase Storage. الطريقة الصحيحة فيه هي Cloudinary عبر Unsigned Upload Preset، مع حفظ رابط `secure_url` فقط في Firestore. تم تطبيق نفس الفكرة في English Hub.

## التعديلات

- إضافة `src/lib/cloudinary.ts` لرفع الصور من المتصفح مباشرة إلى Cloudinary.
- تعديل صفحة الإعلانات لدعم رفع صورة الإعلان مباشرة عبر Cloudinary مع إمكانية استخدام رابط خارجي كبديل.
- تعديل `BlockFileUpload` لدعم رفع الصور مباشرة عبر Cloudinary، مع إبقاء PDF والصوت وصفحة الكتاب عبر روابط Google Drive أو الروابط الخارجية.
- تعديل صفحة الملفات لتعمل دون Firebase Storage: الصور عبر Cloudinary، وPDF والصوت والفيديو عبر روابط خارجية.
- إزالة استخدام `uploadBytes` و`uploadBytesResumable` و`getDownloadURL` من واجهات English Hub.
- الحفاظ على Firebase Firestore للبيانات النصية والروابط والنقاط والإعلانات.

## متغيرات البيئة الجديدة

أضف إلى إعدادات Vercel أو Netlify:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
```

في Cloudinary يجب إنشاء Upload Preset من:

`Settings → Upload → Upload presets → Add upload preset → Signing Mode: Unsigned`

لا تضع `api_secret` في `.env` العام أو في كود المتصفح. التطبيق يحتاج فقط Cloud Name واسم Upload Preset غير الموقّع.

## النتيجة

لا تحتاج هذه الطريقة إلى Firebase Storage ولا إلى ترقية مشروع Firebase إلى Blaze. الخطة المجانية في Cloudinary مخصصة للصور، أما الملفات الكبيرة مثل PDF والصوت والفيديو فتستخدم لها روابط خارجية مجانية مثل Google Drive أو الاستضافة التي يملكها المستخدم.

تم تشغيل `npm run build` بنجاح دون أخطاء TypeScript أو JSX.
