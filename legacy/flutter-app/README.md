# 💍 نِكاح - تطبيق الزواج الإسلامي الشرعي

## وصف المشروع
تطبيق **نِكاح** هو منصة زواج إسلامية شرعية تعمل على Android وiOS، مبنية بـ Flutter.

## المميزات الرئيسية
- ✅ تسجيل وتحقق من الهوية
- 🔍 بحث متقدم بمعايير متعددة
- 💬 رسائل داخلية آمنة
- 👨‍👩‍👧 دور ولي الأمر (للنساء)
- 📸 ملف شخصي تفصيلي
- ⭐ اشتراكات مجانية ومميزة
- 🛡️ نظام إشراف وحماية
- 📖 قصص نجاح
- 🤖 باحث ذكي تلقائي
- 🔔 إشعارات ذكية

## التقنيات
- **Framework:** Flutter (Dart)
- **Backend:** Firebase (Auth + Firestore + Storage + Notifications)
- **State Management:** Provider / Riverpod
- **Platforms:** Android & iOS

## هيكل المشروع
```
lib/
├── main.dart
├── screens/
│   ├── splash_screen.dart
│   ├── onboarding_screen.dart
│   ├── auth/
│   │   ├── login_screen.dart
│   │   └── register_screen.dart
│   ├── home/
│   │   ├── home_screen.dart
│   │   └── search_screen.dart
│   ├── profile/
│   │   ├── profile_screen.dart
│   │   └── edit_profile_screen.dart
│   ├── messages/
│   │   └── messages_screen.dart
│   └── subscription/
│       └── subscription_screen.dart
├── widgets/
├── models/
├── services/
└── utils/
```
