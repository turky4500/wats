# 🚀 دليل بناء ملف APK — خطوة بخطوة على Windows

## ⏱️ الوقت المتوقع: 30-45 دقيقة (أول مرة)

---

## 📋 المتطلبات
- ✅ Windows 10/11
- ✅ اتصال إنترنت
- ✅ 10 GB مساحة فارغة على الهارد

---

## الخطوة 1️⃣ — تحميل Flutter SDK

1. اذهب إلى: https://docs.flutter.dev/get-started/install/windows
2. اضغط "Download Flutter SDK"
3. فك الضغط في مسار بسيط مثل: `C:\flutter`
   - ⚠️ تجنب مسارات بها مسافات مثل `C:\Program Files`

---

## الخطوة 2️⃣ — إضافة Flutter إلى PATH

1. اضغط `Win + S` واكتب "Environment Variables"
2. افتح "Edit the system environment variables"
3. اضغط "Environment Variables"
4. في "System Variables" ابحث عن `Path` واضغط Edit
5. اضغط "New" وأضف: `C:\flutter\bin`
6. اضغط OK وأغلق كل شيء
7. افتح CMD جديد واكتب:
   ```
   flutter --version
   ```
   يجب أن تظهر نسخة Flutter ✅

---

## الخطوة 3️⃣ — تحميل Android Studio

1. اذهب إلى: https://developer.android.com/studio
2. حمّل وثبّت Android Studio
3. عند الإعداد الأول اختر "Standard" وثبّت كل شيء

---

## الخطوة 4️⃣ — قبول Android Licenses

افتح CMD واكتب:
```bash
flutter doctor --android-licenses
```
اكتب `y` لكل سؤال

---

## الخطوة 5️⃣ — التحقق من الإعداد

```bash
flutter doctor
```
يجب أن يظهر:
```
[✓] Flutter
[✓] Android toolchain
[✓] Android Studio
```

---

## الخطوة 6️⃣ — نسخ مجلد المشروع

انسخ مجلد `islamic_marriage_app` إلى:
```
C:\Projects\islamic_marriage_app
```

---

## الخطوة 7️⃣ — بناء ملف APK

افتح CMD وانتقل للمجلد:
```bash
cd C:\Projects\islamic_marriage_app
```

ثبّت المكتبات:
```bash
flutter pub get
```

ابنِ ملف APK:
```bash
flutter build apk --release
```

⏱️ انتظر 3-5 دقائق...

---

## ✅ أين ملف APK؟

بعد انتهاء البناء، ستجد الملف هنا:
```
C:\Projects\islamic_marriage_app\build\app\outputs\flutter-apk\app-release.apk
```

انقله لهاتفك وثبّته! 🎉

---

## 📲 تثبيت APK على الهاتف

1. افتح **إعدادات الهاتف**
2. اذهب إلى **الأمان** أو **التطبيقات**
3. فعّل **"تثبيت تطبيقات من مصادر غير معروفة"**
4. انقل ملف APK للهاتف (واتساب، كابل، Google Drive...)
5. افتح الملف وثبّته

---

## ❓ مشاكل شائعة وحلولها

| المشكلة | الحل |
|---------|------|
| `flutter not recognized` | أعد تشغيل CMD بعد إضافة PATH |
| `SDK not found` | تأكد من تثبيت Android Studio |
| `License not accepted` | شغّل `flutter doctor --android-licenses` |
| `Gradle build failed` | شغّل `flutter clean` ثم `flutter build apk` |
| مساحة غير كافية | احذف ملفات مؤقتة واترك 10 GB |
