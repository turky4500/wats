const { makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { useMongoDBAuthState } = require('./models/Session');

const sessions = {};
const pendingSockets = {}; // سوكتات في انتظار الربط (لم تتصل بعد)
const MAX_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 50;

// ===== فصل الجلسة ومسح بياناتها =====
async function disconnectSession(userId) {
    if (sessions[userId]) {
        try { await sessions[userId].logout(); } catch (e) { }
        delete sessions[userId];
    }
    delete pendingSockets[userId];
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

        // حفظ السوكت المؤقت للاستخدام في Pairing Code
        pendingSockets[userId] = sock;

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
                
                delete sessions[userId];
                delete pendingSockets[userId];
                
                if (shouldReconnect) {
                    if (io) io.to(userId).emit('reconnecting', 'انقطع الاتصال... جاري إعادة المحاولة');
                    console.log(`🔄 إعادة اتصال: ${userId} (السبب: ${statusCode})`);
                    const delay = Math.min(5000 + (Math.random() * 5000), 30000);
                    setTimeout(() => startWhatsAppSession(userId, io), delay);
                } else {
                    if (io) io.to(userId).emit('disconnected', 'تم فصل الواتساب. يرجى إعادة الربط.');
                    console.log(`🔌 تم فصل الواتساب: ${userId}`);
                }
            
            // ===== الاتصال نجح =====
            } else if (connection === 'open') {
                sessions[userId] = sock;
                delete pendingSockets[userId];
                if (io) io.to(userId).emit('ready', 'WhatsApp is connected');
                console.log(`✅ واتساب متصل: ${userId}`);
            }
        });

        return sock;
    } catch (e) {
        console.error(`❌ خطأ في بدء جلسة ${userId}:`, e.message);
        if (io) io.to(userId).emit('disconnected', 'حدث خطأ في الاتصال');
        return null;
    }
}

// ===== طلب رمز الربط (Pairing Code) =====
async function requestPairingCode(userId, phoneNumber) {
    // جلب السوكت (إما متصل أو في الانتظار)
    let sock = pendingSockets[userId] || sessions[userId];
    
    if (!sock) {
        throw new Error('لا توجد جلسة نشطة. يرجى الانتظار حتى يظهر الباركود أو تحديث الصفحة.');
    }

    // التحقق أن الجلسة لم تُسجّل بعد
    if (sock.authState?.creds?.registered) {
        throw new Error('الرقم مرتبط بالفعل! افصل أولاً ثم أعد الربط.');
    }

    // تنظيف الرقم
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10) {
        throw new Error('رقم غير صالح. أدخل الرقم مع رمز الدولة (مثال: 966500000000)');
    }

    try {
        const code = await sock.requestPairingCode(cleanNumber);
        console.log(`🔑 رمز الربط لـ ${userId}: ${code}`);
        return code;
    } catch (e) {
        console.error(`❌ خطأ في طلب رمز الربط:`, e.message);
        throw new Error('فشل في توليد رمز الربط. تأكد من الرقم وحاول مرة أخرى.');
    }
}

// ===== الحصول على جلسة =====
function getSession(userId) {
    return sessions[userId];
}

// ===== التحقق من الاتصال =====
function isSessionConnected(userId) {
    const sock = sessions[userId];
    return !!(sock && sock.user);
}

function getActiveSessionsCount() {
    return Object.keys(sessions).length;
}

module.exports = { 
    startWhatsAppSession, getSession, disconnectSession, 
    getActiveSessionsCount, isSessionConnected, requestPairingCode 
};
