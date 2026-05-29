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
        }
    });

    return sock;
}

// ===== ربط بالرمز =====
// جلسة مؤقتة بـ macOS لتوليد الرمز فقط
// بعد نجاح الربط تصبح هي الجلسة الدائمة (بدون إعادة اتصال)
async function requestPairingCode(userId, phoneNumber, io) {
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10) throw new Error('رقم غير صالح');
    if (sessions[userId] && sessions[userId].user) throw new Error('الرقم مرتبط بالفعل! افصل أولاً.');

    // مسح الجلسة القديمة
    await disconnectSession(userId);

    return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('انتهت المهلة. حاول مرة أخرى.'));
        }, 60000);

        try {
            const { state, saveCreds } = await useMultiFileAuthState(`./auth_info_baileys/${userId}`);

            const sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }),
                browser: Browsers.macOS("Chrome"),
            });

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    try {
                        const customCode = String(Math.floor(10000000 + Math.random() * 90000000));
                        const code = await sock.requestPairingCode(cleanNumber, customCode);
                        clearTimeout(timeout);
                        resolve(code);
                    } catch (e) {
                        clearTimeout(timeout);
                        reject(new Error('فشل توليد الرمز: ' + e.message));
                    }
                }

                // نجاح الربط - نحفظ الجلسة كجلسة دائمة (بدون إغلاق وإعادة فتح)
                if (connection === 'open') {
                    sessions[userId] = sock;
                    if (io) io.to(userId).emit('ready', 'WhatsApp is connected');
                }

                if (connection === 'close') {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    delete sessions[userId];
                    if (shouldReconnect) {
                        // إعادة اتصال بنفس الـ browser الأصلي المستقر
                        setTimeout(() => startWhatsAppSession(userId, io), 5000);
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

module.exports = { startWhatsAppSession, getSession, disconnectSession, requestPairingCode };
