const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

const sessions = {};

// فصل الواتساب ومسح البيانات
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
                if (io) io.to(userId).emit('disconnected', 'تم فصل الواتساب');
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
