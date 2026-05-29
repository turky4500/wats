const { makeWASocket, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { useMongoDBAuthState } = require('./models/Session');

const sessions = {};
const pendingSockets = {};
const pairingRequests = {};
const MAX_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 50;

async function disconnectSession(userId) {
    if (sessions[userId]) {
        try { await sessions[userId].logout(); } catch (e) { }
        delete sessions[userId];
    }
    delete pendingSockets[userId];
    delete pairingRequests[userId];
    try {
        const { AuthSession } = require('./models/Session');
        await AuthSession.deleteMany({ userId });
    } catch (e) { console.error('خطأ مسح الجلسة:', e); }
}

async function startWhatsAppSession(userId, io) {
    if (Object.keys(sessions).length >= MAX_SESSIONS) {
        if (io) io.to(userId).emit('error', 'الخادم مشغول.');
        return null;
    }
    try {
        const { state, saveCreds } = await useMongoDBAuthState(userId);
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Chrome"),
        });

        pendingSockets[userId] = sock;
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && io) {
                const QRCode = require('qrcode');
                QRCode.toDataURL(qr, (err, url) => {
                    if (!err) io.to(userId).emit('qr', url);
                });

                // إذا المستخدم طلب ربط بالرمز
                if (pairingRequests[userId] && !sock.authState.creds.registered) {
                    try {
                        var phone = pairingRequests[userId].phone;
                        var customCode = String(Math.floor(10000000 + Math.random() * 90000000));
                        var code = await sock.requestPairingCode(phone, customCode);
                        if (pairingRequests[userId] && pairingRequests[userId].resolve) {
                            pairingRequests[userId].resolve(code);
                        }
                    } catch (e) {
                        if (pairingRequests[userId] && pairingRequests[userId].reject) {
                            pairingRequests[userId].reject(e);
                        }
                    }
                    delete pairingRequests[userId];
                }
            }

            if (connection === 'close') {
                var statusCode = lastDisconnect?.error?.output?.statusCode;
                var shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                delete sessions[userId];
                delete pendingSockets[userId];
                if (shouldReconnect) {
                    if (io) io.to(userId).emit('reconnecting', 'انقطع الاتصال... جاري إعادة المحاولة');
                    var delay = Math.min(5000 + (Math.random() * 5000), 30000);
                    setTimeout(function() { startWhatsAppSession(userId, io); }, delay);
                } else {
                    if (io) io.to(userId).emit('disconnected', 'تم فصل الواتساب. يرجى إعادة الربط.');
                }
            } else if (connection === 'open') {
                sessions[userId] = sock;
                delete pendingSockets[userId];
                delete pairingRequests[userId];
                if (io) io.to(userId).emit('ready', 'WhatsApp is connected');
                console.log('✅ واتساب متصل: ' + userId);
            }
        });
        return sock;
    } catch (e) {
        console.error('❌ خطأ بدء جلسة ' + userId + ':', e.message);
        if (io) io.to(userId).emit('disconnected', 'حدث خطأ في الاتصال');
        return null;
    }
}

async function requestPairingCode(userId, phoneNumber, io) {
    var cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10) throw new Error('رقم غير صالح. أدخل الرقم مع رمز الدولة');
    if (sessions[userId] && sessions[userId].user) throw new Error('الرقم مرتبط بالفعل! افصل أولاً ثم أعد الربط.');

    return new Promise(async function(resolve, reject) {
        pairingRequests[userId] = { phone: cleanNumber, resolve: resolve, reject: reject };

        var existingSock = pendingSockets[userId];
        if (existingSock && existingSock.authState && !existingSock.authState.creds.registered) {
            try {
                var customCode = String(Math.floor(10000000 + Math.random() * 90000000));
                var code = await existingSock.requestPairingCode(cleanNumber, customCode);
                delete pairingRequests[userId];
                resolve(code);
                return;
            } catch (e) {
                await disconnectSession(userId);
                pairingRequests[userId] = { phone: cleanNumber, resolve: resolve, reject: reject };
                startWhatsAppSession(userId, io);
            }
        } else if (!existingSock) {
            await disconnectSession(userId);
            pairingRequests[userId] = { phone: cleanNumber, resolve: resolve, reject: reject };
            startWhatsAppSession(userId, io);
        } else {
            delete pairingRequests[userId];
            reject(new Error('الرقم مرتبط بالفعل! افصل أولاً.'));
            return;
        }

        setTimeout(function() {
            if (pairingRequests[userId]) {
                delete pairingRequests[userId];
                reject(new Error('انتهت مهلة توليد الرمز. حاول مرة أخرى.'));
            }
        }, 60000);
    });
}

function getSession(userId) { return sessions[userId]; }
function isSessionConnected(userId) { var s = sessions[userId]; return !!(s && s.user); }
function getActiveSessionsCount() { return Object.keys(sessions).length; }

module.exports = {
    startWhatsAppSession, getSession, disconnectSession,
    getActiveSessionsCount, isSessionConnected, requestPairingCode
};
