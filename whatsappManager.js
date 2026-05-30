const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

const sessions = {};

async function disconnectSession(userId) {
    if (sessions[userId]) {
        try { await sessions[userId].logout(); } catch (e) { }
        delete sessions[userId];
    }
    const authPath = `./auth_info_baileys/${userId}`;
    if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
    }
}

// الجلسة الدائمة المستقرة
async function startWhatsAppSession(userId, io) {
    const { state, saveCreds } = await useMultiFileAuthState(`./auth_info_baileys/${userId}`);

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
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                setTimeout(() => startWhatsAppSession(userId, io), 5000);
            } else {
                delete sessions[userId];
            }
        } else if (connection === 'open') {
            sessions[userId] = sock;
            if (io) io.to(userId).emit('ready', 'WhatsApp is connected');
            console.log('✅ واتساب متصل (مستقر): ' + userId);
        }
    });

    return sock;
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
            const { state, saveCreds } = await useMultiFileAuthState(`./auth_info_baileys/${userId}`);

            const tempSock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }),
                browser: Browsers.macOS("Chrome"),
            });

            tempSock.ev.on('creds.update', saveCreds);

            let pairingDone = false;

            tempSock.ev.on('connection.update', async (update) => {
                const { connection, qr } = update;

                if (qr && !pairingDone) {
                    try {
                        const customCode = String(Math.floor(10000000 + Math.random() * 90000000));
                        const code = await tempSock.requestPairingCode(cleanNumber, customCode);
                        clearTimeout(timeout);
                        pairingDone = true;
                        resolve(code);
                        console.log('🔑 رمز الربط تم توليده لـ: ' + userId);
                    } catch (e) {
                        clearTimeout(timeout);
                        reject(new Error('فشل توليد الرمز: ' + e.message));
                    }
                }

                // بعد نجاح الربط
                if (connection === 'open') {
                    console.log('🔗 تم الربط بالرمز لـ: ' + userId + ' - جاري التحويل للجلسة المستقرة...');
                    
                    // إغلاق الاتصال فقط (بدون logout - نحتفظ بالبيانات)
                    try { tempSock.ws.close(); } catch(e) {}
                    
                    // انتظار ثم بدء الجلسة المستقرة بالبيانات المحفوظة
                    setTimeout(() => {
                        startWhatsAppSession(userId, io);
                    }, 3000);
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

module.exports = { startWhatsAppSession, getSession, disconnectSession, requestPairingCode };
