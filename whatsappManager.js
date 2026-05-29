const { makeWASocket, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { useMongoDBAuthState } = require('./models/Session');

const sessions = {};
const pendingSockets = {};
const pairingRequests = {}; // أرقام تنتظر رمز الربط
const MAX_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 50;

// ===== فصل الجلسة =====
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
            // مهم جداً: يجب استخدام هذا المتصفح لدعم Pairing Code
            browser: Browsers.macOS("Chrome"),
        });

        pendingSockets[userId] = sock;
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                // إرسال QR للواجهة
                if (io) {
                    const QRCode = require('qrcode');
                    QRCode.toDataURL(qr, (err, url) => {
                        if (!err) io.to(userId).emit('qr', url);
                    });
                }

                // ===== Pairing Code: إذا المستخدم طلب ربط بالرمز =====
                if (pairingRequests[userId] && !sock.authState.creds.registered) {
                    try {
                        const phoneNumber = pairingRequests[userId].phone;
                        // توليد رمز رقمي مخصص من 8 أرقام
                        const customCode = String(Math.floor(10000000 + Math.random() * 90000000));
                        const code = await sock.requestPairingCode(phoneNumber, customCode);
                        console.log('🔑 رمز الربط لـ ' + userId + ': ' + code);
                        
                        // إرسال الرمز للواجهة عبر Socket
                        if (io) io.to(userId).emit('pairing-code', code);
                        
                        // حل الـ Promise
                        if (pairingRequests[userId].resolve) {
                            pairingRequests[userId].resolve(code);
                        }
                    } catch (e) {
                        console.error('❌ خطأ رمز الربط:', e.message);
                        if (pairingRequests[userId] && pairingRequests[userId].reject) {
                            pairingRequests[userId].reject(e);
                        }
                    }
                    delete pairingRequests[userId];
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                delete sessions[userId];
                delete pendingSockets[userId];
                
                if (shouldReconnect) {
                    if (io) io.to(userId).emit('reconnecting', 'انقطع الاتصال... جاري إعادة المحاولة');
                    const delay = Math.min(5000 + (Math.random() * 5000), 30000);
                    setTimeout(() => startWhatsAppSession(userId, io), delay);
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
        console.error('❌ خطأ في بدء جلسة ' + userId + ':', e.message);
        if (io) io.to(userId).emit('disconnected', 'حدث خطأ في الاتصال');
        return null;
    }
}

// ===== طلب رمز الربط =====
async function requestPairingCode(userId, phoneNumber, io) {
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10) {
        throw new Error('رقم غير صالح. أدخل الرقم مع رمز الدولة (مثال: 966500000000)');
    }

    // إذا كان متصل بالفعل
    if (sessions[userId] && sessions[userId].user) {
        throw new Error('الرقم مرتبط بالفعل! افصل أولاً ثم أعد الربط.');
    }

    return new Promise(async (resolve, reject) => {
        // حفظ طلب الربط - سيتم تنفيذه عند ظهور QR
        pairingRequests[userId] = { phone: cleanNumber, resolve, reject };

        // إذا يوجد سوكت معلق وما ظهر QR بعد، نعيد تشغيل الجلسة
        // لأن requestPairingCode يجب أن يُطلب عند QR
        const existingSock = pendingSockets[userId] || sessions[userId];
        
        if (!existingSock) {
            // لا يوجد سوكت - نبدأ جلسة جديدة (ستظهر QR وسيتم طلب الرمز تلقائياً)
            await disconnectSession(userId);
            startWhatsAppSession(userId, io);
        } else if (existingSock.authState && existingSock.authState.creds && !existingSock.authState.creds.registered) {
            // سوكت موجود لكن غير مسجل - نحاول طلب الرمز مباشرة
            try {
                const customCode = String(Math.floor(10000000 + Math.random() * 90000000));
                const code = await existingSock.requestPairingCode(cleanNumber, customCode);
                console.log('🔑 رمز الربط لـ ' + userId + ': ' + code);
                delete pairingRequests[userId];
                resolve(code);
            } catch (e) {
                // فشل - نعيد تشغيل الجلسة
                console.log('🔄 إعادة تشغيل الجلسة لطلب رمز الربط...');
                await disconnectSession(userId);
                pairingRequests[userId] = { phone: cleanNumber, resolve, reject };
                startWhatsAppSession(userId, io);
            }
        } else {
            // مسجل بالفعل
            delete pairingRequests[userId];
            reject(new Error('الرقم مرتبط بالفعل! افصل أولاً.'));
        }

        // timeout بعد 60 ثانية
        setTimeout(() => {
            if (pairingRequests[userId]) {
                delete pairingRequests[userId];
                reject(new Error('انتهت مهلة توليد الرمز. حاول مرة أخرى.'));
            }
        }, 60000);
    });
}

function getSession(userId) { return sessions[userId]; }
function isSessionConnected(userId) { const s = sessions[userId]; return !!(s && s.user); }
function getActiveSessionsCount() { return Object.keys(sessions).length; }

module.exports = { 
    startWhatsAppSession, getSession, disconnectSession, 
    getActiveSessionsCount, isSessionConnected, requestPairingCode 
};
