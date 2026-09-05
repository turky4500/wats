#!/usr/bin/env node
/**
 * 🗄️ سكربت ترحيل قاعدة البيانات من MongoDB Atlas (السحابة المجانية)
 *    إلى MongoDB المحلي المثبت على سيرفر هتزنر
 *
 * يمكن استخدامه بطريقتين:
 *   1) تلقائياً: يُستدعى من server.js عند أول إقلاع (بعد تفعيل MongoDB المحلي)
 *   2) يدوياً:  node scripts/migrate-atlas-to-local.js [--dry-run]
 *
 * ماذا يفعل؟
 *   1. يتصل بقاعدة البيانات القديمة (remoteUri)
 *   2. يحوّل مرفقات الحملات المخزنة Base64 إلى ملفات في مجلد uploads/
 *   3. ينسخ جميع المجموعات إلى MongoDB المحلي (localUri)
 *   4. يحفظ نسخة احتياطية EJSON في مجلد backups/
 */
const { MongoClient } = require('mongodb');
const EJSON = (require('mongodb').EJSON) || (require('bson') && require('bson').EJSON);
const fs = require('fs');
const path = require('path');

const APP_ROOT = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(APP_ROOT, 'uploads');
const BACKUPS_DIR = path.join(APP_ROOT, 'backups');

function sanitizeFilename(name) {
    return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

/**
 * ترحيل كامل من remoteUri إلى localUri
 * @param {string} remoteUri  قاعدة البيانات القديمة (أطلس)
 * @param {string} localUri   قاعدة البيانات المحلية على السيرفر
 * @param {object} [opts]     { dryRun, log }
 * @returns {Promise<{total:number, mediaCount:number}>}
 */
async function migrate(remoteUri, localUri, opts = {}) {
    const dryRun = !!opts.dryRun;
    const log = opts.log || ((...a) => console.log(...a));

    if (!remoteUri || remoteUri.includes('127.0.0.1') || remoteUri.includes('localhost')) {
        log('ℹ️  لا يوجد مصدر بعيد للترحيل (المصدر محلي بالفعل).');
        return { total: 0, mediaCount: 0 };
    }

    log('🔌 مصدر الترحيل: ' + remoteUri.replace(/\/\/[^@]+@/, '//***@'));
    log('🎯 الهدف: ' + localUri);

    const src = new MongoClient(remoteUri, { serverSelectionTimeoutMS: 30000 });
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

        log(`📦 المجموعة: ${name}`);
        const docs = await sdb.collection(name).find().toArray();

        // تحويل مرفقات الحملات من Base64 إلى ملفات على القرص
        if (name === 'campaigns') {
            for (const doc of docs) {
                if (!Array.isArray(doc.media)) continue;
                for (const m of doc.media) {
                    if (m && m.data) {
                        try {
                            const base64Data = String(m.data).includes(',') ? String(m.data).split(',')[1] : m.data;
                            const buf = Buffer.from(base64Data, 'base64');
                            const folder = path.join(UPLOADS_DIR, String(doc._id));
                            fs.mkdirSync(folder, { recursive: true });
                            const fname = sanitizeFilename(m.filename || `file-${Date.now()}-${mediaCount}`);
                            fs.writeFileSync(path.join(folder, fname), buf);
                            m.path = path.join('uploads', String(doc._id), fname);
                            delete m.data;
                            mediaCount++;
                        } catch (e) {
                            log(`   ⚠️ فشل تحويل مرفق في حملة ${doc._id}: ${e.message}`);
                        }
                    }
                }
            }
        }

        // نسخة احتياطية EJSON
        const backupFile = path.join(backupDir, `${name}.json`);
        fs.writeFileSync(backupFile, EJSON.stringify(docs, { relaxed: false }));
        log(`   📄 ${docs.length} سجل → نسخة احتياطية: backups/${path.basename(backupDir)}/${name}.json`);

        if (!dryRun) {
            const tgt = new MongoClient(localUri, { serverSelectionTimeoutMS: 15000 });
            await tgt.connect();
            const tdb = tgt.db();
            await tdb.collection(name).deleteMany({});
            if (docs.length > 0) {
                await tdb.collection(name).insertMany(docs, { ordered: false });
            }
            await tgt.close();
            log(`   ✅ نُقل إلى القاعدة المحلية: ${name} (${docs.length})`);
        }

        total += docs.length;
    }

    await src.close();
    log(`\n${dryRun ? '🔍 وضع تجريبي (بدون كتابة):' : '🎉'} تمت معالجة ${total} سجل، وتحويل ${mediaCount} مرفق إلى ملفات.`);
    return { total, mediaCount };
}

module.exports = { migrate };

// تشغيل مباشر: node scripts/migrate-atlas-to-local.js [--dry-run]
if (require.main === module) {
    require('dotenv').config({ path: path.join(APP_ROOT, '.env') });
    const dryRun = process.argv.includes('--dry-run');
    const remoteUri = process.env.SOURCE_MONGODB_URI || process.env.MONGODB_URI || 'mongodb+srv://tur100:Sa123456@cluster0.asfixge.mongodb.net/test?appName=Cluster0';
    const localUri = process.env.TARGET_MONGODB_URI || 'mongodb://127.0.0.1:27017/wats';
    migrate(remoteUri, localUri, { dryRun })
        .then(() => process.exit(0))
        .catch(e => { console.error('❌ فشل الترحيل:', e.message); process.exit(1); });
}
