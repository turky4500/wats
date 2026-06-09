const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

const sessions = {};
const connecting = {};
const reconnectAttempts = {};
const lastDisconnectAt = {};

const MAX_RECONNECT_ATTEMPTS = 20;
const BASE_RECONNECT_DELAY = 5000;
const MAX_RECONNECT_DELAY = 120000;
const SESSION_READY_TIMEOUT = 25000;
const PAIRING_TIMEOUT = 120000;

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
    const sock = sessions[userId];
    if (sock) {
        try { await sock.logout(); } catch (e) { }
        try { sock.end?.(undefined); } catch (e) { }
        delete sessions[userId];
    }
    delete connecting[userId];
    delete reconnectAttempts[userId];
    delete lastDisconnectAt[userId];
    const authPath = `./auth_info_baileys/${userId}`;
    if (fs.existsSync(authPath)) {
        try { fs.rmSync(authPath, { recursive: true, force: true }); } catch (_) {}
    }
}

function getReconnectDelay(userId) {
    const attempts = reconnectAttempts[userId] || 0;
    const exp = Math.min(BASE_RECONNECT_DELAY * Math.pow(1.5, attempts), MAX_RECONNECT_DELAY);
    const jitter = Math.random() * 2000;
    return Math.floor(exp + jitter);
}

function getSocketOptions(version, state) {
    return {
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Chrome (Windows)', 'Desktop', '1.0.0'],
        version,
        markOnlineOnConnect: false,
        keepAliveIntervalMs: 25000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: undefined,
        retryRequestDelayMs: 1000,
        maxRetries: 5,
        qrTimeout: 120000,
        syncFullHistory: false,
        emitOwnEvents: false,
        generateHighQualityLinkPreview: false,
        shouldSyncHistoryMessage: () => false,
    };
}

function setupConnectionHandlers(sock, userId, io) {
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
            reconnectAttempts[userId] = 0;
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
                console.log(`🚪 تسجيل خروج/حظر للمستخدم ${userId} - مسح بيانات الجلسة`);
                reconnectAttempts[userId] = 0;
                const authPath = `./auth_info_baileys/${userId}`;
                if (fs.existsSync(authPath)) {
                    try { fs.rmSync(authPath, { recursive: true, force: true }); } catch (_) {}
                }
                if (io) io.to(userId).emit('logged_out', 'تم تسجيل الخروج. أعد ربط الرقم.');
                return;
            }

            reconnectAttempts[userId] = (reconnectAttempts[userId] || 0) + 1;
            if (reconnectAttempts[userId] > MAX_RECONNECT_ATTEMPTS) {
                console.log(`❌ تجاوز حد المحاولات (${MAX_RECONNECT_ATTEMPTS}) للمستخدم ${userId} - إيقاف المحاولة`);
                if (io) io.to(userId).emit('connection_failed', 'تعذر إعادة الاتصال. حاول لاحقاً أو أعد ربط الرقم.');
                reconnectAttempts[userId] = 0;
                return;
            }

            const delay = getReconnectDelay(userId);
            console.log(`🔄 إعادة محاولة الاتصال [${userId}] رقم ${reconnectAttempts[userId]} بعد ${Math.round(delay / 1000)}ث`);
            setTimeout(() => {
                startWhatsAppSession(userId, io).catch(e => {
                    console.error(`❌ فشل إعادة الاتصال [${userId}]:`, e.message);
                });
            }, delay);
        }
    });
}

async function startWhatsAppSession(userId, io) {
    if (connecting[userId]) return connecting[userId];
    if (sessions[userId] && sessions[userId].user) return sessions[userId];

    const promise = (async () => {
        try {
            const version = await getWAVersion();
            const { state, saveCreds } = await useMultiFileAuthState(`./auth_info_baileys/${userId}`);

            const sock = makeWASocket(getSocketOptions(version, state));
            sessions[userId] = sock;

            sock.ev.on('creds.update', saveCreds);
            setupConnectionHandlers(sock, userId, io);

            await new Promise((resolve) => {
                const onUpdate = (u) => {
                    if (u.connection === 'open' || u.connection === 'close') {
                        sock.ev.off('connection.update', onUpdate);
                        resolve();
                    }
                };
                sock.ev.on('connection.update', onUpdate);
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
            setTimeout(() => { delete connecting[userId]; }, 100);
        }
    })();

    connecting[userId] = promise;
    return promise;
}

async function requestPairingCode(userId, phoneNumber, io) {
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10 || !cleanNumber.startsWith('966')) {
        throw new Error('رقم غير صالح - يجب أن يبدأ بـ 966');
    }

    const existing = sessions[userId];
    if (existing && existing.user) {
        throw new Error('الرقم مرتبط بالفعل! افصل أولاً.');
    }

    if (connecting[userId]) {
        try { await connecting[userId]; } catch (_) { }
        if (sessions[userId] && sessions[userId].user) {
            throw new Error('الرقم مرتبط بالفعل! افصل أولاً.');
        }
    }

    await disconnectSession(userId);
    connecting[userId] = true;

    try {
        const version = await getWAVersion();
        const { state, saveCreds } = await useMultiFileAuthState(`./auth_info_baileys/${userId}`);

        const sock = makeWASocket(getSocketOptions(version, state));
        sessions[userId] = sock;

        sock.ev.on('creds.update', saveCreds);

        // ✅ handler بسيط لعملية pairing - ما يحاول يعيد الاتصال
        let pairingDone = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && io && !pairingDone) {
                const QRCode = require('qrcode');
                QRCode.toDataURL(qr, (err, url) => {
                    if (!err) io.to(userId).emit('qr', url);
                });
            }

            if (connection === 'open') {
                console.log('✅ تم ربط واتساب بنجاح (pairing code): ' + userId);
                pairingDone = true;
                reconnectAttempts[userId] = 0;
                delete lastDisconnectAt[userId];
                delete connecting[userId];
                if (io) io.to(userId).emit('ready', 'WhatsApp is connected');
                // ✅ بعد الاتصال الناجح، نربط setupConnectionHandlers لإعادة الاتصال المستقبلية
                setupConnectionHandlers(sock, userId, io);
                return;
            }

            if (connection === 'close' && !pairingDone) {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errMsg = lastDisconnect?.error?.message || 'unknown';
                const loggedOut = statusCode === DisconnectReason.loggedOut;
                const banned = statusCode === DisconnectReason.forbidden || statusCode === 403;

                delete sessions[userId];
                delete connecting[userId];

                if (loggedOut || banned) {
                    console.log(`🚪 تسجيل خروج/حظر: ${userId}`);
                    reconnectAttempts[userId] = 0;
                    const authPath = `./auth_info_baileys/${userId}`;
                    if (fs.existsSync(authPath)) {
                        try { fs.rmSync(authPath, { recursive: true, force: true }); } catch (_) {}
                    }
                    if (io) io.to(userId).emit('logged_out', 'تم تسجيل الخروج. أعد ربط الرقم.');
                    return;
                }

                console.log(`⚠️ انقطاع أثناء pairing لـ ${userId}: ${errMsg} - في انتظار إدخال الرمز`);
                // ✅ ما نحاول نعيد الاتصال هنا - ننتظر المستخدم يدخل الرمز
            }
        });

        // ✅ انتظار حتى يستقر socket قبل طلب الرمز
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // ✅ طلب رمز الربط
        const code = await sock.requestPairingCode(cleanNumber);
        console.log('🔑 رمز الربط تم توليده لـ ' + userId + ': ' + code);

        delete connecting[userId];
        return code;
    } catch (e) {
        console.error('❌ خطأ في requestPairingCode:', e.message);
        delete connecting[userId];
        delete sessions[userId];
        throw e;
    }
}

function getSession(userId) {
    return sessions[userId];
}

async function waitForReadySession(userId, io, timeoutMs = SESSION_READY_TIMEOUT) {
    const existing = sessions[userId];
    if (existing && existing.user) return existing;

    const startPromise = startWhatsAppSession(userId, io).catch(() => null);

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const s = sessions[userId];
        if (s && s.user) return s;
        await new Promise(r => setTimeout(r, 300));
    }

    await startPromise;
    const final = sessions[userId];
    return (final && final.user) ? final : null;
}

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
