const { makeWASocket, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { useMongoDBAuthState } = require('./models/Session');

const sessions = {};
const pairingRequests = {};
const MAX_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 50;

async function disconnectSession(userId) {
    if (sessions[userId]) {
        try { await sessions[userId].logout(); } catch (e) { }
        delete sessions[userId];
    }
    delete pairingRequests[userId];
    try {
        const { AuthSession } = require('./models/Session');
        await AuthSession.deleteMany({ userId });
    } catch (e) { }
}

async function startWhatsAppSession(userId, io) {
    if (Object.keys(sessions).length >= MAX_SESSIONS) {
        if (io) io.to(userId).emit('error', 'الخادم مشغول.');
        return null;
    }
    try {
        var { state, saveCreds } = await useMongoDBAuthState(userId);

        // هل يوجد طلب ربط بالرمز؟
        var usePairing = !!pairingRequests[userId];

        var sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            // macOS فقط عند طلب pairing code لأول مرة، وإلا ubuntu المستقر
            browser: usePairing ? Browsers.macOS("Chrome") : Browsers.ubuntu("Chrome"),
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async function(update) {
            var connection = update.connection;
            var lastDisconnect = update.lastDisconnect;
            var qr = update.qr;

            if (qr && io) {
                var QRCode = require('qrcode');
                QRCode.toDataURL(qr, function(err, url) {
                    if (!err) io.to(userId).emit('qr', url);
                });

                // تنفيذ طلب الربط بالرمز
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
                var statusCode = 0;
                try { statusCode = lastDisconnect.error.output.statusCode; } catch(e) {}
                var shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                delete sessions[userId];

                if (shouldReconnect) {
                    if (io) io.to(userId).emit('reconnecting', 'جاري إعادة الاتصال...');
                    var delay = Math.min(3000 + (Math.random() * 3000), 15000);
                    // إعادة الاتصال بدون pairing (browser مستقر دائماً)
                    setTimeout(function() { startWhatsAppSession(userId, io); }, delay);
                } else {
                    if (io) io.to(userId).emit('disconnected', 'تم فصل الواتساب. يرجى إعادة الربط.');
                }
            } else if (connection === 'open') {
                sessions[userId] = sock;
                delete pairingRequests[userId];
                if (io) io.to(userId).emit('ready', 'WhatsApp is connected');
                console.log('✅ واتساب متصل: ' + userId);
            }
        });
        return sock;
    } catch (e) {
        console.error('❌ خطأ:', e.message);
        if (io) io.to(userId).emit('disconnected', 'حدث خطأ');
        return null;
    }
}

async function requestPairingCode(userId, phoneNumber, io) {
    var cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10) throw new Error('رقم غير صالح');
    if (sessions[userId] && sessions[userId].user) throw new Error('الرقم مرتبط بالفعل! افصل أولاً.');

    return new Promise(async function(resolve, reject) {
        // مسح الجلسة القديمة
        await disconnectSession(userId);
        // تسجيل الطلب (قبل startWhatsAppSession)
        pairingRequests[userId] = { phone: cleanNumber, resolve: resolve, reject: reject };
        // بدء جلسة جديدة - ستكتشف pairingRequests وتستخدم macOS
        startWhatsAppSession(userId, io);

        setTimeout(function() {
            if (pairingRequests[userId]) {
                delete pairingRequests[userId];
                reject(new Error('انتهت المهلة. حاول مرة أخرى.'));
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
