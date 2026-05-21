const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const Pino = require('pino');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(express.json());

let sock;
let isClientReady = false;
let currentPairingRequest = null; // لتخزين الوعد (Promise) الحالي

async function connectToWhatsApp() {
    console.log("🚀 جاري تشغيل بوت واتساب...");
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,   // لا نطبع QR في الطرفية
        logger: Pino({ level: 'silent' }),
        browser: ['Chrome (Linux)', 'Chrome', '110.0.5481.100']
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            // إذا حدث QR (كبديل) نرسله للواجهة (احتياطي)
            console.log("QR تم توليده (لن نستخدمه)");
        }
        if (connection === 'open') {
            isClientReady = true;
            console.log("🎉 واتساب متصل وجاهز!");
            io.emit('ready', 'WhatsApp is ready!');
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            isClientReady = false;
            console.log("⚠️ تم قطع الاتصال، إعادة المحاولة...");
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(connectToWhatsApp, 5000);
            } else {
                io.emit('error', 'تم تسجيل الخروج. أعد تشغيل التطبيق');
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

// نقطة نهاية واحدة لطلب رمز الإقتران (محسنة لانتظار جاهزية sock)
app.post('/api/get-pairing-code', express.json(), async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber || !/^\d+$/.test(phoneNumber)) {
        return res.status(400).json({ error: 'رقم هاتف غير صالح (أرقام فقط مع مفتاح الدولة)' });
    }
    if (isClientReady) {
        return res.json({ error: 'الجهاز متصل بالفعل, لا حاجة لرمز' });
    }
    if (!sock) {
        return res.status(503).json({ error: 'الخادم لم يكتمل تشغيله، انتظر ثوان وأعد المحاولة' });
    }

    // إذا كان هناك طلب سابق قيد التنفيذ ننتظره
    if (currentPairingRequest) {
        try {
            const code = await currentPairingRequest;
            return res.json({ pairingCode: code });
        } catch (err) {
            currentPairingRequest = null;
        }
    }

    // طلب جديد
    currentPairingRequest = (async () => {
        try {
            console.log(`📞 طلب رمز اقتران للرقم: ${phoneNumber}`);
            // الانتظار قليلاً لضمان جاهزية socket (في بعض الأحيان يحتاج لثانية)
            await new Promise(resolve => setTimeout(resolve, 1000));
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`✅ رمز الاقتران: ${code}`);
            return code;
        } catch (err) {
            console.error(`❌ فشل طلب الرمز:`, err);
            throw new Error('فشل في إنشاء رمز الاقتران، حاول مرة أخرى');
        } finally {
            currentPairingRequest = null;
        }
    })();

    try {
        const code = await currentPairingRequest;
        res.json({ pairingCode: code });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

io.on('connection', (socket) => {
    console.log("🌐 متصفح متصل");
    if (isClientReady) socket.emit('ready', 'WhatsApp is ready!');
    socket.on('send-message', async ({ to, body }) => {
        if (!isClientReady) return socket.emit('error', 'العميل ليس جاهزاً');
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
server.listen(PORT, () => {
    console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
});
