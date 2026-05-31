# تشغيل فرع MultiWA على Render

## الهدف
هذا الفرع هو بداية نقل مشروع **واتساب تكوين** إلى هيكل **MultiWA** مع الاحتفاظ بالنسخة المستقرة القديمة في الفرع `main`.

## الفرع المخصص
- `multiwa-migration`

## النسخة الاحتياطية المحلية
- `/home/user/backups/wats-pre-multiwa-20260531-134405`

## ملفات Render المضافة
- `render.yaml`
- `docker/Dockerfile.api`
- `docker/Dockerfile.admin`

## طريقة الربط مع Render
### الخيار الأفضل
من داخل Render:
1. اختر **New +**
2. اختر **Blueprint**
3. اربط نفس مستودع GitHub
4. اختر الفرع: `multiwa-migration`
5. سيقرأ Render ملف `render.yaml` ويجهز خدمتين:
   - `wats-multiwa-api`
   - `wats-multiwa-admin`
   - وقاعدة PostgreSQL

## روابط متوقعة بعد النشر
- لوحة التحكم: `https://wats-multiwa-admin.onrender.com`
- API: `https://wats-multiwa-api.onrender.com`
- Swagger: `https://wats-multiwa-api.onrender.com/api/docs`

## ملاحظات مهمة
- قيمة `NEXT_PUBLIC_API_URL` داخل `render.yaml` مربوطة باسم خدمة الـ API الحالي.
- إذا غيّرت اسم الخدمة على Render، عدّل الرابط داخل `render.yaml`.
- تم إعداد الـ API ليستخدم `PORT` الخاص بـ Render تلقائيًا.
- تم إعداد الـ API ليشغّل `prisma migrate deploy` تلقائيًا عند بدء الحاوية.
- تم إضافة قرص دائم لحفظ جلسات واتساب في:
  - `/data/sessions`

## الخطوة التالية بعد النشر
بعد تشغيل المشروع على Render نبدأ مباشرة في:
1. التعريب الكامل
2. RTL
3. إعادة بناء نظام المستخدمين والاشتراكات مثل مشروع واتساب تكوين
4. نقل منطق الحملات والربط والـ OTP تدريجيًا
