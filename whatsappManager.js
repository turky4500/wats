const { makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { useMongoDBAuthState } = require('./models/Session');

const sessions = {};
const MAX_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 50;

// ===== فصل الجلسة ومسح بياناتها =====
async function disconnectSession(userId) {
    if (sessions[userId]) {
        try { await sessions[userId].logout(); } catch (e) { }
        delete sessions[userId];
    }
    // مسح بيانات الجلسة من MongoDB
    try {
        const { AuthSession } = require('./models/Session');
        await AuthSession.deleteMany({ userId });
    } catch (e) {
        console.error('خطأ في مسح بيانات الجلسة:', e);
    }
}

// ===== بدء جلسة واتساب =====
async function startWhatsAppSession(userId, io) {
    // التحقق من الحد الأقصى للجلسات
    const activeCount = Object.keys(sessions).length;
    if (activeCount >= MAX_SESSIONS) {
        console.warn(`⚠️ تم الوصول للحد الأقصى للجلسات (${MAX_SESSIONS})`);
        if (io) io.to(userId).emit('error', 'الخادم مشغول. يرجى المحاولة لاحقاً.');
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

            // ===== QR Code =====
            if (qr && io) {
                const QRCode = require('qrcode');
                QRCode.toDataURL(qr, (err, url) => {
                    if (!err) io.to(userId).emit('qr', url);
                });
            }

            // ===== الاتصال انقطع =====
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                // ⚡ حذف الجلسة من الذاكرة فوراً عند أي انقطاع
                delete sessions[userId];
                
                if (shouldReconnect) {
                    // إبلاغ الواجهة أن الاتصال انقطع ويحاول إعادة الاتصال
                    if (io) io.to(userId).emit('reconnecting', 'انقطع الاتصال... جاري إعادة المحاولة');
                    console.log(`🔄 إعادة اتصال: ${userId} (السبب: ${statusCode})`);
                    
                    const delay = Math.min(5000 + (Math.random() * 5000), 30000);
                    setTimeout(() => startWhatsAppSession(userId, io), delay);
                } else {
                    // المستخدم سجّل خروج من الواتساب
                    if (io) io.to(userId).emit('disconnected', 'تم فصل الواتساب. يرجى إعادة الربط بمسح الباركود.');
                    console.log(`🔌 تم فصل الواتساب: ${userId} (تسجيل خروج)`);
                }
            
            // ===== الاتصال نجح =====
            } else if (connection === 'open') {
                sessions[userId] = sock;
                if (io) io.to(userId).emit('ready', 'WhatsApp is connected');
                console.log(`✅ واتساب متصل: ${userId}`);
            }
        });

        return sock;
    } catch (e) {
        console.error(`❌ خطأ في بدء جلسة ${userId}:`, e.message);
        // إبلاغ الواجهة بالخطأ
        if (io) io.to(userId).emit('disconnected', 'حدث خطأ في الاتصال');
        return null;
    }
}

// ===== الحصول على جلسة =====
function getSession(userId) {
    return sessions[userId];
}

// ===== التحقق من أن الجلسة متصلة فعلاً =====
function isSessionConnected(userId) {
    const sock = sessions[userId];
    return !!(sock && sock.user);
}

// ===== عدد الجلسات النشطة =====
function getActiveSessionsCount() {
    return Object.keys(sessions).length;
}

module.exports = { startWhatsAppSession, getSession, disconnectSession, getActiveSessionsCount, isSessionConnected };
