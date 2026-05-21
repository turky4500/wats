const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const qrcode = require('qrcode');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const Pino = require('pino');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(express.json());

let sock;
let isClientReady = false;
let currentQR = null;

async function connectToWhatsApp() {
    console.log("🚀 جاري تشغيل Baileys...");
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: Pino({ level: 'silent' }),
        browser: ['Chrome (Linux)', 'Chrome', '110.0.5481.100']
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log("📱 QR Code generated");
            currentQR = qr;
            try {
                const qrImage = await qrcode.toDataURL(qr);
                io.emit('qr', qrImage);
            } catch (err) {
                console.error("QR変換エラー:", err);
            }
        }
        if (connection === 'open') {
            isClientReady = true;
            currentQR = null;
            console.log("🎉 واتساب متصل!");
            io.emit('ready', 'WhatsApp ready');
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            isClientReady = false;
            console.log("⚠️ قطع الاتصال، إعادة محاولة...");
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(connectToWhatsApp, 5000);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.key.fromMe && msg.message) {
            const from = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            io.emit('message', { from, body, timestamp: msg.messageTimestamp });
        }
    });
}

connectToWhatsApp();

io.on('connection', (socket) => {
    console.log("🌐 متصفح متصل");
    if (isClientReady) {
        socket.emit('ready', 'WhatsApp ready');
    } else if (currentQR) {
        (async () => {
            const qrImage = await qrcode.toDataURL(currentQR);
            socket.emit('qr', qrImage);
        })();
    }

    socket.on('send-message', async ({ to, body }) => {
        if (!isClientReady) return socket.emit('error', 'ليس جاهزاً');
        try {
            const jid = `${to}@s.whatsapp.net`;
            await sock.sendMessage(jid, { text: body });
            socket.emit('message-sent', { to, body });
        } catch (err) {
            socket.emit('error', err.message);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ خادم على المنفذ ${PORT}`));
