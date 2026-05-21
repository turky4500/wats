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
let pairingCodeRequested = false; // لمنع الطلبات المتكررة

async function connectToWhatsApp() {
    console.log("🚀 جاري تشغيل بوت واتساب...");
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: Pino({ level: 'silent' }),
        browser: ['Chrome (Linux)', 'Chrome', '110.0.5481.100']
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            // إذا تم إنشاء QR كبديل، نحوله لصورة ونرسله
            const qrImage = await qrcode.toDataURL(qr);
            io.emit('qr', qrImage);
            console.log("📱 QR Code generated");
        }
        if (connection === 'open') {
            isClientReady = true;
            pairingCodeRequested = false;
            console.log("🎉 واتساب متصل وجاهز!");
            io.emit('ready', 'WhatsApp is ready!');
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            isClientReady = false;
            console.log("⚠️ تم قطع الاتصال، جاري إعادة المحاولة...");
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(connectToWhatsApp, 5000);
            } else {
                io.emit('error', 'تم تسجيل الخروج. يرجى إعادة تشغيل التطبيق');
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

// Endpoint خاص بطلب pairing code
app.post('/api/request-pairing-code', express.json(), async (req, res) => {
    if (isClientReady) return res.json({ error: 'الجهاز متصل بالفعل' });
    if (pairingCodeRequested) return res.json({ error: 'تم طلب رمز مسبقاً، انتظر قليلاً' });
    const { phoneNumber } = req.body;
    if (!phoneNumber || !/^\d+$/.test(phoneNumber)) {
        return res.status(400).json({ error: 'رقم الهاتف مطلوب (أرقام فقط مع مفتاح الدولة)' });
    }
    try {
        console.log(`محاولة طلب رمز الإقتران للرقم: ${phoneNumber}`);
        pairingCodeRequested = true;
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`✅ تم إنشاء رمز الإقتران: ${code}`);
        res.json({ pairingCode: code });
    } catch (error) {
        console.error('خطأ في طلب رمز الإقتران:', error);
        pairingCodeRequested = false;
        res.status(500).json({ error: 'فشل في طلب رمز الإقتران، حاول مرة أخرى' });
    }
});

io.on('connection', (socket) => {
    console.log("🌐 متصفح متصل");
    if (isClientReady) socket.emit('ready', 'WhatsApp is ready!');
    socket.on('send-message', async ({ to, body }) => {
        if (!isClientReady) return socket.emit('error', 'العميل ليس جاهزاً بعد');
        try {
            const jid = `${to}@s.whatsapp.net`;
            await sock.sendMessage(jid, { text: body });
            socket.emit('message-sent', { to, body, status: 'sent' });
        } catch (err) {
            socket.emit('error', err.message);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
});
