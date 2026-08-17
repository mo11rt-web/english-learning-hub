# Allawi Net image upload findings

تم العثور على نسخة تطبيق علاوي نت في `/home/ubuntu/upload/allawi-net-source-updated(1).zip`.

الطريقة المستخدمة في الملف `src/services/cloudinary.ts` هي Cloudinary Unsigned Upload Preset، وليس Firebase Storage. يتم إرسال الصورة من المتصفح عبر `FormData` إلى:

`https://api.cloudinary.com/v1_1/{CLOUD_NAME}/image/upload`

مع الحقول `file` و`upload_preset` و`folder`، ثم حفظ `secure_url` فقط في Firestore. لا يتم شحن `api_secret` إلى المتصفح.

المتغيرات المستخدمة في علاوي نت:

- `VITE_CLOUDINARY_CLOUD_NAME`
- `VITE_CLOUDINARY_UPLOAD_PRESET`

القيمة الموجودة في أرشيف علاوي نت كانت `VITE_CLOUDINARY_CLOUD_NAME=haffbick` و`VITE_CLOUDINARY_UPLOAD_PRESET=receipts`، لكن يجب أن يعتمد English Hub على متغيراته الخاصة أو نفس الحساب فقط إذا كان المستخدم يملك الحساب ويوافق على ذلك.

الرفع غير الموقّع يحتاج إنشاء Upload Preset من Cloudinary Dashboard عبر Settings > Upload > Upload presets > Add upload preset > Signing Mode: Unsigned. الخطة المجانية في Cloudinary هي البديل عن Firebase Storage، وتُستخدم هنا للصور فقط.

الخطة التنفيذية: إضافة `src/lib/cloudinary.ts`، دعم `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` و`NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` في Next.js، إعادة تفعيل رفع صورة الإعلان عبر Cloudinary مع إبقاء رابط الصورة الخارجي كبديل، وتعديل BlockFileUpload بنفس النمط للصور. لا يتم استخدام Firebase Storage.
