# 📋 سجل التغييرات - الإصدار 2.0.0

**تاريخ التحديث:** 2026-05-29

---

## 🔴 إصلاحات أمنية

### 1. ✅ كلمة مرور الأدمن الافتراضية
- **قبل:** `password` (مكشوفة في الكود)
- **بعد:** تُقرأ من `ADMIN_DEFAULT_PASSWORD` في `.env` أو تكون `ChangeMe@2026!`

### 2. ✅ Session Secret
- **قبل:** fallback مكشوف `wats_secret_123`
- **بعد:** تحذير في الكونسول + قيمة عشوائية تلقائية + يُنصح بتعيينها من `.env`

### 3. ✅ إضافة `.gitignore`
- يمنع رفع: `node_modules/`, `.env`, `auth_info_baileys/`, `*.log`

### 4. ✅ إضافة `.env.example`
- نموذج لجميع المتغيرات البيئية المطلوبة مع شرح لكل متغير

### 5. ✅ CORS محدد
- **قبل:** `app.use(cors())` - مفتوح للكل
- **بعد:** يقرأ `CORS_ORIGINS` من `.env` ويحدد النطاقات المسموحة

### 6. ✅ Rate Limiting شامل
- حماية تسجيل الدخول: 7 محاولات / 15 دقيقة
- حماية التسجيل: 5 محاولات / ساعة
- حماية OTP: 5 محاولات / 10 دقائق
- حماية API: 30 طلب / دقيقة
- حماية عامة: 200 طلب / 15 دقيقة

### 7. ✅ التحقق من قوة كلمة المرور
- الحد الأدنى 6 أحرف عند التسجيل وإعادة التعيين وتغيير كلمة مرور الأدمن

### 8. ✅ Session Cookie محسّن
- `httpOnly: true` لمنع الوصول من JavaScript
- `maxAge: 24 ساعة` لانتهاء صلاحية الجلسة تلقائياً

---

## 🟡 تحسينات هيكلية

### 9. ✅ تقسيم server.js
- **قبل:** ملف واحد 424 سطر
- **بعد:** 142 سطر فقط + ملفات منفصلة:
  - `routes/auth.js` - التسجيل والدخول (168 سطر)
  - `routes/dashboard.js` - لوحة التحكم (57 سطر)
  - `routes/admin.js` - الإدارة (131 سطر)
  - `routes/logs.js` - السجلات (61 سطر)
  - `routes/api.js` - نقاط API (74 سطر)
  - `middleware/auth.js` - التحقق من الهوية (29 سطر)
  - `middleware/rateLimiter.js` - الحد من الطلبات (119 سطر)
  - `middleware/errorHandler.js` - معالجة الأخطاء (38 سطر)
  - `utils/helpers.js` - دوال مساعدة (69 سطر)
  - `utils/settingsCache.js` - تخزين مؤقت (35 سطر)

### 10. ✅ استخدام MongoDB Auth State
- **قبل:** `useMultiFileAuthState` (تخزين على الملفات → تُحذف عند إعادة التشغيل)
- **بعد:** `useMongoDBAuthState` من `Session.js` (تخزين في MongoDB → دائم)

### 11. ✅ صفحة خطأ موحدة (error.ejs)
- صفحة 404 / 403 / 429 / 500 جميلة ومتسقة بدل صفحات الخطأ الافتراضية

### 12. ✅ معالجة أخطاء غير ملتقطة
- `uncaughtException` و `unhandledRejection` - يمنع تعطل الخادم

### 13. ✅ إضافة README.md شامل
- وصف المشروع، التثبيت، الهيكل، استخدام API

---

## 🟠 تحسينات الأداء

### 14. ✅ تخزين مؤقت للإعدادات (Settings Cache)
- **قبل:** يذهب لقاعدة البيانات في كل طلب
- **بعد:** كاش في الذاكرة لمدة 5 دقائق مع مسح تلقائي عند التحديث

### 15. ✅ MongoDB Indexes
- `MessageLog`: فهرس على `(userId, createdAt)` و `(userId, status)`
- `User`: فهرس على `phone`, `apiToken`, `(role, isActive)`

### 16. ✅ Lazy Loading للجلسات
- **قبل:** يفتح جميع الجلسات فوراً عند بدء التشغيل
- **بعد:** يحمّل بحد أقصى `MAX_CONCURRENT_SESSIONS` مع تأخير 2 ثانية بين كل جلسة

### 17. ✅ حد أقصى للجلسات المتزامنة
- متغير `MAX_CONCURRENT_SESSIONS` (افتراضي: 50)
- يمنع استنزاف الذاكرة عند كثرة المستخدمين

### 18. ✅ Reconnection بـ Backoff تدريجي
- **قبل:** إعادة اتصال كل 5 ثواني ثابتة
- **بعد:** backoff عشوائي (5-30 ثانية) لتخفيف الضغط

---

## 🔵 ميزات جديدة

### 19. ✅ تعطيل/تفعيل العملاء
- route جديد: `POST /admin/toggle-user/:id`

### 20. ✅ تتبع آخر تسجيل دخول
- حقل `lastLoginAt` في موديل User

### 21. ✅ مؤشر قوة كلمة المرور
- شريط ملون في صفحة التسجيل

### 22. ✅ تحسين صفحات المصادقة
- تصميم محسّن لجميع صفحات (login, register, verify, forgot, reset)
- Responsive أفضل للجوال
- ألوان وأيقونات متناسقة

---

## 📁 الملفات الجديدة
```
+ .gitignore
+ .env.example
+ README.md
+ CHANGELOG.md
+ middleware/auth.js
+ middleware/rateLimiter.js
+ middleware/errorHandler.js
+ routes/auth.js
+ routes/dashboard.js
+ routes/admin.js
+ routes/logs.js
+ routes/api.js
+ utils/helpers.js
+ utils/settingsCache.js
+ views/error.ejs
+ public/css/ (مجلد)
```

## 📝 الملفات المُعدّلة
```
~ server.js (أُعيد كتابته بالكامل - 424→142 سطر)
~ whatsappManager.js (MongoDB Auth + حد الجلسات)
~ models/User.js (indexes + lastLoginAt)
~ models/MessageLog.js (indexes)
~ package.json (الوصف والإصدار)
~ views/landing.ejs (تصميم محسّن + responsive)
~ views/login.ejs (تصميم محسّن)
~ views/register.ejs (تصميم محسّن + مؤشر القوة)
~ views/verify.ejs (تصميم محسّن)
~ views/forgot-password.ejs (تصميم محسّن)
~ views/reset-password.ejs (تصميم محسّن)
```
