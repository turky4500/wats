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

// متغير لتخزين QR الحالي
let currentQR = null;
let isClientReady = false;

// إضافة endpoint للحصول على QR مباشرة (لنستخدمه كاحتياطي)
app.get('/api/qr', (req, res) => {
    if (currentQR) {
        res.json({ qr: currentQR, ready: isClientReady });
    } else {
        res.json({ qr: null, ready: isClientReady, message: 'جاري تجهيز QR...' });
    }
});

async function connectToWhatsApp() {
    console.log("🚀 بدء تشغيل بوت واتساب...");
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: Pino({ level: 'silent' }),
        browser: ['Chrome (Linux)', 'Chrome', '110.0.5481.100']
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            currentQR = qr;
            console.log("✅ QR جاهز، طول النص:", qr.length);
            // توليد صورة QR
            try {
                const qrImage = await qrcode.toDataURL(qr);
                // إرسال عبر socket لجميع المتصفحات المتصلة حالياً
                io.emit('qr', qrImage);
                console.log("📱 تم إرسال QR عبر WebSocket");
            } catch(err) {
                console.error("خطأ بتحويل QR:", err);
            }
        }
        
        if (connection === 'open') {
            isClientReady = true;
            currentQR = null;
            console.log("🎉 واتساب متصل بنجاح!");
            io.emit('ready', 'WhatsApp is ready!');
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            isClientReady = false;
            console.log("⚠️ تم قطع الاتصال، إعادة محاولة...");
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(connectToWhatsApp, 5000);
            } else {
                io.emit('error', 'تم تسجيل الخروج، أعد تشغيل التطبيق');
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

// WebSocket للمتصفحات
io.on('connection', (socket) => {
    console.log("🌐 متصفح متصل");
    if (isClientReady) {
        socket.emit('ready', 'WhatsApp is ready!');
    } else if (currentQR) {
        // إذا كان هناك QR موجود لكن لم يرسل بعد، أرسله الآن
        (async () => {
            const qrImage = await qrcode.toDataURL(currentQR);
            socket.emit('qr', qrImage);
        })();
    }

    socket.on('send-message', async ({ to, body }) => {
        if (!isClientReady) return socket.emit('error', 'ليس جاهزاً بعد');
        try {
            const jid = `${to}@s.whatsapp.net`;
            await sock.sendMessage(jid, { text: body });
            socket.emit('message-sent', { to, body, status: 'sent' });
        } catch (err) {
            socket.emit('error', err.message);
        }
    });
});

server.listen(3000, () => {
    console.log("✅ الخادم يعمل على المنفذ 3000");
});
