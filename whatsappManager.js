const { default: makeWASocket, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const Pino = require('pino');
const qrcode = require('qrcode');
const { useMongoDBAuthState } = require('./models/Session');

const sessions = new Map();

async function startWhatsAppSession(userId, io) {
    if (sessions.has(userId)) return sessions.get(userId);

    const { state, saveCreds } = await useMongoDBAuthState(userId);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: Pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop')
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            try {
                const qrImage = await qrcode.toDataURL(qr);
                io.to(userId).emit('qr', qrImage);
            } catch (e) {}
        }
        
        if (connection === 'open') {
            io.to(userId).emit('ready', 'WhatsApp is connected');
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            sessions.delete(userId);
            // إخفاء التنبيه المزعج واستبداله بحالة صامتة
            io.to(userId).emit('status-update', 'جاري إعادة الاتصال بالخادم... 🔄');
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => startWhatsAppSession(userId, io), 5000);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sessions.set(userId, sock);
    return sock;
}

function getSession(userId) {
    return sessions.get(userId);
}

module.exports = { startWhatsAppSession, getSession };
