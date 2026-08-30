#!/usr/bin/env node
/**
 * 🗄️ سكربت ترحيل قاعدة البيانات من MongoDB Atlas (السحابة المجانية)
 *    إلى MongoDB المحلي المثبت على سيرفر هتزنر
 *
 * الاستخدام (يُنفَّذ مرة واحدة على السيرفر):
 *   node scripts/migrate-atlas-to-local.js
 *
 * اختياري للاختبار بدون كتابة في القاعدة المحلية:
 *   SOURCE_MONGODB_URI="..." node scripts/migrate-atlas-to-local.js --dry-run
 *
 * ماذا يفعل؟
 *   1. يتصل بقاعدة البيانات الحالية (من .env أو SOURCE_MONGODB_URI)
 *   2. يحوّل مرفقات الحملات المخزنة Base64 إلى ملفات في مجلد uploads/
 *   3. ينسخ جميع المجموعات إلى MongoDB المحلي mongodb://127.0.0.1:27017/wats
 *   4. يحفظ نسخة احتياطية EJSON في مجلد backups/
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { MongoClient } = require('mongodb');
const EJSON = require('mongodb').EJSON || require('bson').EJSON || require('bson/extjson');
const fs = require('fs');
const path = require('path');

const APP_ROOT = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(APP_ROOT, 'uploads');
const BACKUPS_DIR = path.join(APP_ROOT, 'backups');
const TARGET_URI = process.env.TARGET_MONGODB_URI || 'mongodb://127.0.0.1:27017/wats';
const SOURCE_URI = process.env.SOURCE_MONGODB_URI || process.env.MONGODB_URI;
const DRY_RUN = process.argv.includes('--dry-run');

function isLocalUri(uri) {
    return !uri || uri.includes('127.0.0.1') || uri.includes('localhost');
}

function sanitizeFilename(name) {
    return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

async function main() {
    if (isLocalUri(SOURCE_URI)) {
        console.log('ℹ️  MONGODB_URI في .env تشير إلى قاعدة محلية — لا يوجد ترحيل مطلوب.');
        return;
    }
    console.log('🔌 مصدر الترحيل:', SOURCE_URI.replace(/\/\/[^@]+@/, '//***@'));
    console.log('🎯 الهدف:', TARGET_URI);

    const src = new MongoClient(SOURCE_URI, { serverSelectionTimeoutMS: 30000 });
    await src.connect();
    const sdb = src.db();
    const cols = await sdb.listCollections().toArray();

    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const backupDir = path.join(BACKUPS_DIR, `atlas-${Date.now()}`);
    fs.mkdirSync(backupDir, { recursive: true });

    let total = 0;
    let mediaCount = 0;

    for (const c of cols) {
        const name = c.name;
        if (name.startsWith('system.')) continue;

        console.log(`\n📦 المجموعة: ${name}`);
        const docs = await sdb.collection(name).find().toArray();

        // تحويل مرفقات الحملات من Base64 إلى ملفات على القرص
        if (name === 'campaigns') {
            for (const doc of docs) {
                if (!Array.isArray(doc.media)) continue;
                for (const m of doc.media) {
                    if (m && m.data) {
                        const base64Data = String(m.data).includes(',') ? String(m.data).split(',')[1] : m.data;
                        const buf = Buffer.from(base64Data, 'base64');
                        const folder = path.join(UPLOADS_DIR, String(doc._id));
                        fs.mkdirSync(folder, { recursive: true });
                        const fname = sanitizeFilename(m.filename || `file-${Date.now()}`);
                        fs.writeFileSync(path.join(folder, fname), buf);
                        m.path = path.join('uploads', String(doc._id), fname);
                        delete m.data;
                        mediaCount++;
                    }
                }
            }
        }

        // نسخة احتياطية بصيغة EJSON (تحافظ على أنواع ObjectId و Date)
        const backupFile = path.join(backupDir, `${name}.json`);
        fs.writeFileSync(backupFile, EJSON.stringify(docs, { relaxed: false }));
        console.log(`   📄 ${docs.length} سجل → نسخة احتياطية: backups/${path.basename(backupDir)}/${name}.json`);

        if (!DRY_RUN) {
            const tgt = new MongoClient(TARGET_URI, { serverSelectionTimeoutMS: 15000 });
            await tgt.connect();
            const tdb = tgt.db();
            await tdb.collection(name).deleteMany({});
            if (docs.length > 0) {
                await tdb.collection(name).insertMany(docs, { ordered: false });
            }
            await tgt.close();
            console.log(`   ✅ نُقل إلى القاعدة المحلية: ${name} (${docs.length})`);
        }

        total += docs.length;
    }

    await src.close();
    console.log(`\n${DRY_RUN ? '🔍 وضع تجريبي (بدون كتابة):' : '🎉'} تمت معالجة ${total} سجل، وتحويل ${mediaCount} مرفق إلى ملفات.`);
    console.log('📁 مجلد المرفقات:', UPLOADS_DIR);
    console.log('🗂️  النسخ الاحتياطية:', backupDir);
}

main().catch(e => {
    console.error('❌ فشل الترحيل:', e.message);
    process.exit(1);
});
