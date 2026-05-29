const { makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { useMongoDBAuthState } = require('./models/Session');

const sessions = {};
const MAX_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 50;

// ===== فصل الجلسة =====
async function disconnectSession(userId) {
    if (sessions[userId]) {
        try { await sessions[userId].logout(); } catch (e) { }
        delete sessions[userId];
    }
    try {
        const { AuthSession } = require('./models/Session');
        await AuthSession.deleteMany({ userId });
    } catch (e) {
        console.error('خطأ في مسح بيانات الجلسة:', e);
    }
}

// ===== بدء جلسة واتساب =====
async function startWhatsAppSession(userId, io) {
    const activeCount = Object.keys(sessions).length;
    if (activeCount >= MAX_SESSIONS) {
        if (io) io.to(userId).emit('error', 'الخادم مشغول.');
        return null;
    }

    try {
        const { state, saveCreds } = await useMongoDBAuthState(userId);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Chrome (Windows)', 'Desktop', '1.0.0']
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && io) {
                const QRCode = require('qrcode');
                QRCode.toDataURL(qr, (err, url) => {
                    if (!err) io.to(userId).emit('qr', url);
                });
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                delete sessions[userId];

                if (shouldReconnect) {
                    if (io) io.to(userId).emit('reconnecting', 'انقطع الاتصال... جاري إعادة المحاولة');
                    const delay = Math.min(5000 + (Math.random() * 5000), 30000);
                    setTimeout(() => startWhatsAppSession(userId, io), delay);
                } else {
                    if (io) io.to(userId).emit('disconnected', 'تم فصل الواتساب. يرجى إعادة الربط.');
                }
            } else if (connection === 'open') {
                sessions[userId] = sock;
                if (io) io.to(userId).emit('ready', 'WhatsApp is connected');
                console.log('✅ واتساب متصل: ' + userId);
            }
        });

        return sock;
    } catch (e) {
        console.error('❌ خطأ في بدء جلسة ' + userId + ':', e.message);
        if (io) io.to(userId).emit('disconnected', 'حدث خطأ في الاتصال');
        return null;
    }
}

function getSession(userId) { return sessions[userId]; }
function isSessionConnected(userId) { const s = sessions[userId]; return !!(s && s.user); }
function getActiveSessionsCount() { return Object.keys(sessions).length; }

module.exports = {
    startWhatsAppSession, getSession, disconnectSession,
    getActiveSessionsCount, isSessionConnected
};
