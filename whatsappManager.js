const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const { useMongoDBAuthState } = require('./models/Session');

const sessions = {};

async function disconnectSession(userId) {
    if (sessions[userId]) {
        try { await sessions[userId].logout(); } catch (e) { }
        delete sessions[userId];
    }
    // مسح من الملفات
    const authPath = './auth_info_baileys/' + userId;
    if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
    }
    // مسح من MongoDB
    try {
        const { AuthSession } = require('./models/Session');
        await AuthSession.deleteMany({ userId });
    } catch (e) { }
}

async function startWhatsAppSession(userId, io) {
    var state, saveCreds;

    // محاولة MongoDB أولاً، وإذا فشل نستخدم الملفات
    try {
        var mongoAuth = await useMongoDBAuthState(userId);
        state = mongoAuth.state;
        saveCreds = mongoAuth.saveCreds;
    } catch (e) {
        console.log('⚠️ MongoDB auth فشل، استخدام الملفات:', e.message);
        var fileAuth = await useMultiFileAuthState('./auth_info_baileys/' + userId);
        state = fileAuth.state;
        saveCreds = fileAuth.saveCreds;
    }

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

function getSession(userId) {
    return sessions[userId];
}

function isSessionConnected(userId) {
    const sock = sessions[userId];
    return !!(sock && sock.user);
}

module.exports = { startWhatsAppSession, getSession, disconnectSession, isSessionConnected };
