# 💬 واتساب تكوين - WhatsApp Takween

> منصة SaaS سحابية لإرسال رسائل الواتساب الجماعية مع نظام إدارة المشتركين و API برمجي.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 🌟 المميزات

- ✅ **إرسال جماعي** لرسائل الواتساب (نصوص + مرفقات)
- ✅ **لوحة تحكم** متكاملة للمستخدمين والأدمن
- ✅ **نظام اشتراكات** مع فترة تجريبية مجانية
- ✅ **API برمجي** لربط المتاجر والأنظمة الخارجية
- ✅ **نظام OTP** للتفعيل واستعادة كلمة المرور عبر الواتساب
- ✅ **إحصائيات** ورسوم بيانية للرسائل المرسلة
- ✅ **Socket.IO** لتحديثات لحظية
- ✅ **حماية متقدمة** (Rate Limiting, bcrypt, CORS)
- ✅ **تخزين الجلسات** في MongoDB (لا ملفات)
- ✅ **تنظيف تلقائي** للسجلات القديمة (30 يوم)

---

## 📋 المتطلبات

- **Node.js** 18+
- **MongoDB** (محلي أو Atlas)
- **رقم واتساب** للإدارة (لإرسال أكواد OTP)

---

## 🚀 التثبيت والتشغيل

### 1. استنساخ المشروع
```bash
git clone https://github.com/turky4500/wats.git
cd wats
```

### 2. تثبيت المكتبات
```bash
npm install
```

### 3. إعداد المتغيرات البيئية
```bash
cp .env.example .env
```
ثم عدّل ملف `.env` بقيمك الخاصة:
```env
MONGODB_URI=mongodb+srv://...
SESSION_SECRET=your_secret_key_here
ADMIN_DEFAULT_PASSWORD=YourStrongPass123!
```

### 4. تشغيل المشروع
```bash
# وضع الإنتاج
npm start

# وضع التطوير (إعادة تشغيل تلقائي)
npm run dev
```

### 5. فتح المتصفح
```
http://localhost:3000
```

---

## 📁 هيكل المشروع

```
wats/
├── server.js                 # نقطة الدخول الرئيسية
├── whatsappManager.js        # إدارة جلسات الواتساب
├── package.json
├── .env.example              # نموذج المتغيرات البيئية
├── .gitignore
│
├── models/                   # نماذج قاعدة البيانات
│   ├── User.js               # المستخدمين
│   ├── MessageLog.js         # سجلات الرسائل
│   ├── Settings.js           # إعدادات النظام
│   └── Session.js            # جلسات الواتساب (MongoDB)
│
├── routes/                   # الروتات
│   ├── auth.js               # تسجيل الدخول والتسجيل
│   ├── dashboard.js          # لوحة التحكم
│   ├── admin.js              # إدارة المستخدمين
│   ├── logs.js               # سجلات الرسائل
│   └── api.js                # نقاط API
│
├── middleware/                # الوسطاء
│   ├── auth.js               # التحقق من الهوية
│   ├── rateLimiter.js        # الحد من الطلبات
│   └── errorHandler.js       # معالجة الأخطاء
│
├── utils/                    # دوال مساعدة
│   ├── helpers.js            # دوال مشتركة
│   └── settingsCache.js      # تخزين مؤقت للإعدادات
│
├── views/                    # صفحات EJS
│   ├── landing.ejs           # الصفحة الرئيسية
│   ├── login.ejs             # تسجيل الدخول
│   ├── register.ejs          # التسجيل
│   ├── verify.ejs            # تفعيل OTP
│   ├── dashboard.ejs         # لوحة التحكم
│   ├── admin.ejs             # لوحة الإدارة
│   ├── api-guide.ejs         # دليل API
│   ├── logs.ejs              # سجلات الرسائل
│   ├── forgot-password.ejs   # نسيت كلمة المرور
│   ├── reset-password.ejs    # إعادة تعيين كلمة المرور
│   └── error.ejs             # صفحة الخطأ
│
└── public/                   # ملفات ثابتة
    └── css/
```

---

## 🔌 استخدام الـ API

### إرسال رسالة نصية
```bash
curl -X POST https://your-domain.com/api/v1/send \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "966500000000",
    "message": "مرحباً! هذه رسالة تجريبية 🚀"
  }'
```

### إرسال لعدة أرقام
```bash
curl -X POST https://your-domain.com/api/v1/send \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": ["966500000001", "966500000002"],
    "message": "رسالة جماعية 📢"
  }'
```

---

## 🔐 الأمان

- ✅ كلمات المرور مشفرة بـ bcrypt
- ✅ Rate Limiting على تسجيل الدخول والتسجيل والـ API
- ✅ جلسات آمنة مع httpOnly cookies
- ✅ حماية من brute force
- ✅ CORS قابل للتخصيص

---

## 📄 الرخصة

MIT License - يحق لك الاستخدام والتعديل والتوزيع بحرية.

---

> تم تطويره بـ ❤️ بواسطة [turky4500](https://github.com/turky4500)
