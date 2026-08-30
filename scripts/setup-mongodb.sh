#!/usr/bin/env bash
# ============================================================
# 🗄️ تثبيت MongoDB على سيرفر هتزنر (Debian/Ubuntu) + ترحيل البيانات
# يُنفَّذ مرة واحدة فقط على السيرفر (بصلاحيات root):
#   bash scripts/setup-mongodb.sh
# ============================================================
set -Eeuo pipefail

say() { echo; echo "==== $* ===="; }

say "1) التحقق من وجود MongoDB"
if command -v mongod >/dev/null 2>&1; then
    echo "✅ MongoDB مثبت بالفعل: $(mongod --version | head -1)"
else
    echo "⬇️  جاري تثبيت MongoDB 7.0..."

    apt-get update -y
    apt-get install -y gnupg curl

    # تحديد نظام التشغيل
    if [ -f /etc/os-release ]; then
        . /etc/os-release
    fi
    DISTRO="${ID:-debian}"          # debian أو ubuntu
    CODENAME="${VERSION_CODENAME:-bookworm}"

    # إضافة مفتاح MongoDB الرسمي
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
        gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

    # إضافة المستودع الرسمي
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/${DISTRO} ${CODENAME}/mongodb-org/7.0 main" \
        > /etc/apt/sources.list.d/mongodb-org-7.0.list

    apt-get update -y
    apt-get install -y mongodb-org

    echo "✅ تم تثبيت MongoDB"
fi

say "2) تشغيل MongoDB وتفعيله عند الإقلاع"
systemctl enable mongod >/dev/null 2>&1 || true
systemctl start mongod 2>/dev/null || service mongod start 2>/dev/null || mongod --fork --logpath /var/log/mongodb.log || true
sleep 3

# انتظار جاهزية MongoDB (حتى 60 ثانية)
say "3) انتظار جاهزية MongoDB"
READY=""
for i in $(seq 1 30); do
    if command -v mongosh >/dev/null 2>&1; then
        if mongosh --quiet --eval "db.runCommand({ping:1}).ok" --norc 2>/dev/null | grep -q "1"; then READY=yes; break; fi
    else
        if curl -fsS "http://127.0.0.1:27017" >/dev/null 2>&1; then READY=yes; break; fi
        # بديل: فحص عبر node من مكتبات المشروع
        if command -v node >/dev/null 2>&1; then
            cd "$(dirname "$0")/.."
            if node -e "const {MongoClient}=require('mongodb'); new MongoClient('mongodb://127.0.0.1:27017',{serverSelectionTimeoutMS:1500}).connect().then(c=>{c.close();process.exit(0)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then READY=yes; break; fi
        fi
    fi
    sleep 2
done
if [ -z "$READY" ]; then
    echo "⚠️  لم نتمكن من التأكد من جاهزية MongoDB، سأكمل ونراقب الأخطاء..."
fi

say "4) إعداد مجلد المرفقات"
mkdir -p "$(dirname "$0")/../uploads"
echo "✅ مجلد uploads جاهز"

say "5) ترحيل البيانات من السحابة إلى المحلي (إن وجدت)"
cd "$(dirname "$0")/.."
if [ -f .env ] && grep -q "^MONGODB_URI=" .env; then
    node scripts/migrate-atlas-to-local.js
    echo "✅ تم الترحيل"
else
    echo "ℹ️  لا يوجد MONGODB_URI في .env — ستُستخدم القاعدة المحلية تلقائياً"
fi

say "6) تحديث .env للإشارة إلى القاعدة المحلية"
if [ -f .env ]; then
    if grep -q "^MONGODB_URI=" .env; then
        sed -i 's|^MONGODB_URI=.*|MONGODB_URI=mongodb://127.0.0.1:27017/wats|' .env
    else
        echo "MONGODB_URI=mongodb://127.0.0.1:27017/wats" >> .env
    fi
    echo "✅ .env يشير الآن إلى: mongodb://127.0.0.1:27017/wats"
else
    echo "⚠️  لا يوجد ملف .env — تأكد من إنشائه"
fi

say "✅ اكتمل الإعداد!"
echo "MongoDB يعمل على: mongodb://127.0.0.1:27017/wats"
echo "أعد تشغيل التطبيق الآن (أو سيتشغل تلقائياً مع النشر القادم)"
