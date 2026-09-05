#!/usr/bin/env node
/**
 * 🗄️ يضمن تشغيل MongoDB محلياً على السيرفر (بدون الحاجة لأوامر يدوية)
 *
 * المنطق:
 *   1. إن كان mongod يعمل على 127.0.0.1:27017 → ننتهي (جاهز)
 *   2. إن لم يعمل لكن mongod مثبت → نشغّله بقاعدة بيانات داخل مجلد المشروع
 *      (data/mongodb) — لا يحتاج root ولا systemd
 *   3. إن لم يكن mongod مثبتاً أبداً:
 *      - إن كنا root → نحاول تثبيته تلقائياً عبر apt
 *      - إن لم نكن root → نعيد false ونطبع تعليمات واضحة
 */
const { spawnSync, execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOCAL_URI = 'mongodb://127.0.0.1:27017';
const DATA_DIR = path.join(__dirname, '..', 'data', 'mongodb');
const LOG_FILE = path.join(__dirname, '..', 'data', 'mongod.log');

function log(msg) { console.log(`[MongoDB] ${msg}`); }

function isRunning() {
    try {
        const res = spawnSync('node', ['-e', `
            const { MongoClient } = require('mongodb');
            new MongoClient('${LOCAL_URI}', { serverSelectionTimeoutMS: 1500 })
                .connect().then(c => { c.close(); process.exit(0); }).catch(() => process.exit(1));
        `], { cwd: path.join(__dirname, '..'), timeout: 5000, stdio: 'pipe' });
        return res.status === 0;
    } catch (e) { return false; }
}

function hasBinary(name) {
    const r = spawnSync('which', [name], { stdio: 'pipe' });
    return r.status === 0;
}

function isRoot() {
    try { return process.getuid && process.getuid() === 0; } catch (e) { return false; }
}

async function tryInstall() {
    if (!isRoot()) {
        log('⚠️  mongod غير مثبت ونحن لسنا root — سيكمل التطبيق بقاعدة البيانات القديمة.');
        log('   للتثبيت اليدوي (مرة واحدة): bash scripts/setup-mongodb.sh');
        return false;
    }
    if (!hasBinary('apt-get')) { log('⚠️  لا يوجد apt-get للتثبيت'); return false; }

    log('⬇️  جاري تثبيت MongoDB (قد يستغرق دقائق)...');
    const steps = [
        ['curl', ['-fsSL', 'https://www.mongodb.org/static/pgp/server-7.0.asc', '-o', '/tmp/mongo.asc']],
        ['gpg', ['-o', '/usr/share/keyrings/mongodb-server-7.0.gpg', '--dearmor', '/tmp/mongo.asc']],
    ];
    // تحديد إصدار النظام
    let distro = 'debian', codename = 'bookworm';
    try {
        const osr = fs.readFileSync('/etc/os-release', 'utf8');
        const id = osr.match(/^ID=(.+)$/m);
        const vc = osr.match(/^VERSION_CODENAME=(.+)$/m);
        if (id && (id[1].includes('ubuntu') || id[1].includes('debian'))) distro = id[1].replace(/"/g, '');
        if (vc) codename = vc[1].replace(/"/g, '');
    } catch (e) {}
    log(`   النظام: ${distro}/${codename}`);

    try {
        for (const [cmd, args] of steps) {
            if (!hasBinary(cmd)) continue;
            const r = spawnSync(cmd, args, { timeout: 30000, stdio: 'pipe' });
            if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr}`);
        }
        fs.writeFileSync('/etc/apt/sources.list.d/mongodb-org-7.0.list',
            `deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/${distro} ${codename}/mongodb-org/7.0 main\n`);
        log('   تحديث الحزم...');
        spawnSync('apt-get', ['update', '-y'], { timeout: 180000, stdio: 'pipe' });
        log('   تثبيت mongodb-org...');
        const ins = spawnSync('apt-get', ['install', '-y', '--no-install-recommends', 'mongodb-org'], { timeout: 600000, stdio: 'pipe' });
        if (ins.status !== 0) throw new Error('apt install failed');
        log('✅ تم تثبيت MongoDB');
        return true;
    } catch (e) {
        log('❌ فشل التثبيت التلقائي: ' + e.message);
        log('   يمكنك التثبيت يدوياً: bash scripts/setup-mongodb.sh');
        return false;
    }
}

async function startMongod() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

    // تشغيل mongod كعملية منفصلة (لا يحتاج root)
    const args = [
        '--dbpath', DATA_DIR,
        '--port', '27017',
        '--bind_ip', '127.0.0.1',
        '--logpath', LOG_FILE,
        '--fork'
    ];
    log('🚀 تشغيل mongod محلياً (البيانات في ' + DATA_DIR + ')');
    const r = spawnSync('mongod', args, { timeout: 30000, stdio: 'pipe' });
    if (r.status !== 0) {
        log('⚠️  فشل تشغيل mongod مباشرة، نجرب systemctl...');
        const s = spawnSync('systemctl', ['start', 'mongod'], { timeout: 30000, stdio: 'pipe' });
        return s.status === 0;
    }
    return true;
}

async function waitUntilRunning(tries = 20) {
    for (let i = 0; i < tries; i++) {
        if (isRunning()) return true;
        await new Promise(r => setTimeout(r, 1500));
    }
    return false;
}

/**
 * الوظيفة الرئيسية — يُستدعى من server.js عند الإقلاع
 * @returns {Promise<boolean>} هل MongoDB المحلي جاهز؟
 */
async function ensureLocalMongo() {
    try {
        if (isRunning()) { log('✅ MongoDB المحلي يعمل'); return true; }

        if (hasBinary('mongod')) {
            const started = await startMongod();
            if (started && await waitUntilRunning()) { log('✅ تم تشغيل MongoDB المحلي'); return true; }
            log('⚠️  mongod مثبت لكن فشل تشغيله — تحقق من ' + LOG_FILE);
            return false;
        }

        log('🔎 mongod غير مثبت — نحاول التثبيت التلقائي');
        const installed = await tryInstall();
        if (!installed) return false;
        const started = await startMongod();
        if (started && await waitUntilRunning()) { log('✅ تم تشغيل MongoDB المحلي'); return true; }
        return false;
    } catch (e) {
        log('❌ خطأ غير متوقع: ' + e.message);
        return false;
    }
}

module.exports = { ensureLocalMongo, LOCAL_URI };

// تشغيل مباشر: node scripts/ensure-local-mongodb.js
if (require.main === module) {
    ensureLocalMongo().then(ok => {
        console.log(ok ? '✅ MongoDB المحلي جاهز' : '❌ MongoDB المحلي غير متاح');
        process.exit(ok ? 0 : 1);
    });
}
