@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════════════════╗
echo ║     نِكاح — إعداد وبناء ملف APK تلقائياً        ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: التحقق من Flutter
echo [1/4] التحقق من Flutter...
flutter --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo ❌ Flutter غير موجود!
    echo.
    echo 👉 حمّل Flutter من: https://docs.flutter.dev/get-started/install/windows
    echo    فك الضغط في C:\flutter
    echo    أضف C:\flutter\bin إلى PATH
    echo.
    pause
    exit /b 1
)
echo ✅ Flutter موجود

:: تثبيت المكتبات
echo.
echo [2/4] تثبيت المكتبات (flutter pub get)...
flutter pub get
IF ERRORLEVEL 1 (
    echo ❌ فشل تثبيت المكتبات!
    pause
    exit /b 1
)
echo ✅ تم تثبيت المكتبات

:: تنظيف Build القديم
echo.
echo [3/4] تنظيف البناء القديم...
flutter clean
echo ✅ تم التنظيف

:: بناء APK
echo.
echo [4/4] بناء ملف APK... (يستغرق 3-5 دقائق)
echo.
flutter build apk --release
IF ERRORLEVEL 1 (
    echo.
    echo ❌ فشل بناء APK!
    echo.
    echo جرّب الحلول التالية:
    echo  1. flutter doctor --android-licenses
    echo  2. تأكد من تثبيت Android Studio
    echo  3. تأكد من اتصال الإنترنت
    pause
    exit /b 1
)

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║              ✅ تم بناء APK بنجاح!              ║
echo ╚══════════════════════════════════════════════════╝
echo.
echo 📁 موقع الملف:
echo    build\app\outputs\flutter-apk\app-release.apk
echo.
echo 📲 لتثبيته على هاتفك:
echo    1. انقله للهاتف عبر كابل أو واتساب
echo    2. فعّل "تثبيت تطبيقات غير معروفة" في الإعدادات
echo    3. افتح الملف وثبّته
echo.

:: فتح مجلد APK تلقائياً
echo 📂 فتح مجلد APK...
explorer build\app\outputs\flutter-apk

pause
