const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

const sessions = {};            // userId -> sock (الجلسة المتصلة بالفعل أو في طور الاتصال)
const connecting = {};          // userId -> Promise يحل عند connection==='open'
const reconnectAttempts = {};   // userId -> عدد محاولات إعادة الاتصال المتتالية
const lastDisconnectAt = {};    // userId -> timestamp آخر انقطاع

const MAX_RECONNECT_ATTEMPTS = 10;       // قبل إيقاف المحاولة (يحتاج تدخّل)
const BASE_RECONNECT_DELAY = 3000;       // 3 ثوان أساس
const MAX_RECONNECT_DELAY = 60000;       // 60 ثانية حد أقصى
const SESSION_READY_TIMEOUT = 20000;     // كم ننتظر لتفتح الجلسة عند طلب من API

let cachedVersion = null;

async function getWAVersion() {
    if (cachedVersion) return cachedVersion;
    try {
        const { version } = await fetchLatestBaileysVersion();
        cachedVersion = version;
        console.log('📦 إصدار WhatsApp Web:', version.join('.'));
    } catch (e) {
        console.log('⚠️ تعذر جلب إصدار WA Web، استخدام الافتراضي');
        cachedVersion = undefined;
    }
    return cachedVersion;
}

async function disconnectSession(userId) {
    if (sessions[userId]) {
        try { await sessions[userId].logout(); } catch (e) { }
        try { sessions[userId].end?.(undefined); } catch (e) { }
        delete sessions[userId];
    }
    delete connecting[userId];
    delete reconnectAttempts[userId];
    const authPath = `./auth_info_baileys/${userId}`;
    if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
    }
}

function getReconnectDelay(userId) {
    const attempts = reconnectAttempts[userId] || 0;
    // exponential backoff مع jitter بسيط
    const exp = Math.min(BASE_RECONNECT_DELAY * Math.pow(1.5, attempts), MAX_RECONNECT_DELAY);
    const jitter = Math.random() * 1000;
    return Math.floor(exp + jitter);
}

// الجلسة الدائمة المستقرة - مع keepAlive + reconnect ذكي + جلب الإصدار الأحدث
async function startWhatsAppSession(userId, io) {
    // إذا في طور الاتصال، أعد نفس الـ Promise
    if (connecting[userId]) {
        return connecting[userId];
    }

    // إذا جلسة فعّالة موجودة، أعدها
    if (sessions[userId] && sessions[userId].user) {
        return sessions[userId];
    }

    const promise = (async () => {
        try {
            const version = await getWAVersion();
            const { state, saveCreds } = await useMultiFileAuthState(`./auth_info_baileys/${userId}`);

            const sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }),
                browser: ['Chrome (Windows)', 'Desktop', '1.0.0'],
                version,
                // ✅ إصلاحات استقرار الاتصال (مبنية على Baileys issues #1625, #2008, #1720)
                markOnlineOnConnect: false,        // لا يفصل واتساب الجوال عند الفتح
                keepAliveIntervalMs: 25000,         // ping كل 25ث لإبقاء الجلسة حية على Render
                connectTimeoutMs: 60000,            // 60ث للاتصال الأولي
                defaultQueryTimeoutMs: undefined,   // لا حد أقصى لطلبات pairing/onWhatsApp
                retryRequestDelayMs: 500,           // إعادة المحاولة بعد نصف ثانية لو فشل request
                qrTimeout: 60000,                   // QR صالح لمدة دقيقة
                syncFullHistory: false,             // لا تزامن تاريخ كامل (يبطئ ويرهق)
                emitOwnEvents: false,
                generateHighQualityLinkPreview: false,
            });

            // حفظ مرجع مبكر حتى يستطيع API انتظاره
            sessions[userId] = sock;

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr && io) {
                    const QRCode = require('qrcode');
                    QRCode.toDataURL(qr, (err, url) => {
                        if (!err) io.to(userId).emit('qr', url);
                    });
                }

                if (connection === 'open') {
                    sessions[userId] = sock;
                    reconnectAttempts[userId] = 0;          // ✅ صفر بعد نجاح
                    delete lastDisconnectAt[userId];
                    delete connecting[userId];
                    if (io) io.to(userId).emit('ready', 'WhatsApp is connected');
                    console.log('✅ واتساب متصل (مستقر): ' + userId);
                    return;
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const errMsg = lastDisconnect?.error?.message || 'unknown';
                    const loggedOut = statusCode === DisconnectReason.loggedOut;
                    const banned = statusCode === DisconnectReason.forbidden || statusCode === 403;

                    lastDisconnectAt[userId] = Date.now();
                    delete sessions[userId];
                    delete connecting[userId];

                    console.log(`⚠️ انقطع واتساب [${userId}] code=${statusCode} reason="${errMsg}"`);

                    if (loggedOut || banned) {
                        // تسجيل خروج فعلي - مسح الجلسة
                        console.log(`🚪 تسجيل خروج/حظر للمستخدم ${userId} - مسح بيانات الجلسة`);
                        reconnectAttempts[userId] = 0;
                        const authPath = `./auth_info_baileys/${userId}`;
                        if (fs.existsSync(authPath)) {
                            try { fs.rmSync(authPath, { recursive: true, force: true }); } catch (_) {}
                        }
                        if (io) io.to(userId).emit('logged_out', 'تم تسجيل الخروج. أعد ربط الرقم.');
                        return;
                    }

                    // إعادة الاتصال مع exponential backoff
                    reconnectAttempts[userId] = (reconnectAttempts[userId] || 0) + 1;
                    if (reconnectAttempts[userId] > MAX_RECONNECT_ATTEMPTS) {
                        console.log(`❌ تجاوز حد المحاولات (${MAX_RECONNECT_ATTEMPTS}) للمستخدم ${userId} - إيقاف المحاولة`);
                        if (io) io.to(userId).emit('connection_failed', 'تعذر إعادة الاتصال. حاول لاحقاً أو أعد ربط الرقم.');
                        reconnectAttempts[userId] = 0;
                        return;
                    }

                    const delay = getReconnectDelay(userId);
                    console.log(`🔄 إعادة محاولة الاتصال [${userId}] رقم ${reconnectAttempts[userId]} بعد ${Math.round(delay/1000)}ث`);
                    setTimeout(() => {
                        startWhatsAppSession(userId, io).catch(e => {
                            console.error(`❌ فشل إعادة الاتصال [${userId}]:`, e.message);
                        });
                    }, delay);
                }
            });

            // ننتظر حدث open أو timeout
            await new Promise((resolve) => {
                const onUpdate = (u) => {
                    if (u.connection === 'open' || u.connection === 'close') {
                        sock.ev.off('connection.update', onUpdate);
                        resolve();
                    }
                };
                sock.ev.on('connection.update', onUpdate);
                // safety timeout
                setTimeout(() => {
                    sock.ev.off('connection.update', onUpdate);
                    resolve();
                }, SESSION_READY_TIMEOUT);
            });

            return sock;
        } catch (e) {
            console.error(`❌ خطأ في startWhatsAppSession [${userId}]:`, e.message);
            delete connecting[userId];
            delete sessions[userId];
            throw e;
        } finally {
            // نظافة الـ Promise بعد قليل (في حال نجاح/فشل)
            setTimeout(() => { delete connecting[userId]; }, 100);
        }
    })();

    connecting[userId] = promise;
    return promise;
}

// ربط بالرمز - جلسة مؤقتة لتوليد الرمز فقط
async function requestPairingCode(userId, phoneNumber, io) {
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10) throw new Error('رقم غير صالح');
    if (sessions[userId] && sessions[userId].user) throw new Error('الرقم مرتبط بالفعل! افصل أولاً.');

    // مسح أي جلسة قديمة
    await disconnectSession(userId);

    return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('انتهت المهلة. حاول مرة أخرى.'));
        }, 60000);

        try {
            const version = await getWAVersion();
            const { state, saveCreds } = await useMultiFileAuthState(`./auth_info_baileys/${userId}`);

            const tempSock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }),
                browser: Browsers.ubuntu('Chrome'),
                version,
                markOnlineOnConnect: false,
                keepAliveIntervalMs: 25000,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: undefined,
                retryRequestDelayMs: 500,
                qrTimeout: 60000,
                syncFullHistory: false,
            });

            tempSock.ev.on('creds.update', saveCreds);

            let pairingDone = false;

            tempSock.ev.on('connection.update', async (update) => {
                const { connection, qr, lastDisconnect } = update;

                if (qr && !pairingDone) {
                    try {
                        pairingDone = true;
                        // Baileys requires a slight delay before requesting pairing code
                        setTimeout(async () => {
                            try {
                                const code = await tempSock.requestPairingCode(cleanNumber);
                                clearTimeout(timeout);
                                resolve(code);
                                console.log('🔑 رمز الربط تم توليده لـ: ' + userId);
                            } catch (err) {
                                clearTimeout(timeout);
                                reject(new Error('فشل توليد الرمز: ' + err.message));
                            }
                        }, 2500);
                    } catch (e) {
                        clearTimeout(timeout);
                        reject(new Error('فشل توليد الرمز: ' + e.message));
                    }
                }

                if (connection === 'open') {
                    console.log('✅ تم الربط بالرمز لـ: ' + userId);
                    sessions[userId] = tempSock;
                    reconnectAttempts[userId] = 0;
                    if (io) io.to(userId).emit('ready', 'WhatsApp is connected');
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const loggedOut = statusCode === DisconnectReason.loggedOut;
                    delete sessions[userId];
                    if (!loggedOut) {
                        // إعادة الاتصال بالجلسة المستقرة
                        setTimeout(() => startWhatsAppSession(userId, io).catch(()=>{}), 5000);
                    }
                }
            });
        } catch (e) {
            clearTimeout(timeout);
            reject(new Error('خطأ: ' + e.message));
        }
    });
}

function getSession(userId) {
    return sessions[userId];
}

// ✅ جديد: انتظار جلسة جاهزة (تستخدمها endpoints الإرسال)
// تعيد الجلسة عندما تكون sock.user جاهزاً، أو null إذا انتهت المهلة
async function waitForReadySession(userId, io, timeoutMs = SESSION_READY_TIMEOUT) {
    const existing = sessions[userId];
    if (existing && existing.user) return existing;

    // ابدأ جلسة إن لم تكن موجودة، أو انتظر القائمة
    const startPromise = startWhatsAppSession(userId, io).catch(() => null);

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const s = sessions[userId];
        if (s && s.user) return s;
        await new Promise(r => setTimeout(r, 300));
    }
    // محاولة أخيرة بعد انتهاء الانتظار
    await startPromise;
    const final = sessions[userId];
    return (final && final.user) ? final : null;
}

// ✅ جديد: تحقق سريع من حالة الجلسة بدون انتظار
function isSessionReady(userId) {
    const s = sessions[userId];
    return !!(s && s.user && s.ws && s.ws.readyState === 1);
}

module.exports = {
    startWhatsAppSession,
    getSession,
    disconnectSession,
    requestPairingCode,
    waitForReadySession,
    isSessionReady
};
