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
// متغير لتخزين رمز الإقتران المؤقت
let pairingCode = null;

async function connectToWhatsApp() {
    console.log("🚀 بدء تشغيل بوت واتساب...");
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: Pino({ level: 'silent' }),
        // نسخة المتصفح التي سيتم إرسالها إلى واتساب
        browser: ['Edge (Windows)', 'Edge', '122.0.0.0'],
        // استخدام إصدار ثابت ومستقر من واتساب ويب
        waWebVersion: '2.3000.1018732514'
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("تم استلام QR لكننا لن نستخدمه");
        }
        
        if (connection === 'open') {
            isClientReady = true;
            pairingCode = null;
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
}

// بدء تشغيل البوت عند تشغيل الخادم
connectToWhatsApp();

// نقطة نهاية (Endpoint) جديدة لطلب رمز الإقتران
app.post('/api/request-pairing-code', express.json(), async (req, res) => {
    if (isClientReady) {
        return res.json({ error: 'الجهاز متصل بالفعل' });
    }
    
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ error: 'رقم الهاتف مطلوب' });
    }
    
    try {
        console.log(`محاولة طلب رمز إقتران للرقم: ${phoneNumber}`);
        const code = await sock.requestPairingCode(phoneNumber);
        pairingCode = code;
        console.log(`تم إنشاء رمز الإقتران: ${code}`);
        res.json({ pairingCode: code });
    } catch (error) {
        console.error('خطأ في طلب رمز الإقتران:', error);
        res.status(500).json({ error: 'فشل في طلب رمز الإقتران' });
    }
});

// WebSocket للمتصفحات
io.on('connection', (socket) => {
    console.log("🌐 متصفح متصل");
    if (isClientReady) {
        socket.emit('ready', 'WhatsApp is ready!');
    }
});

server.listen(3000, () => {
    console.log("✅ الخادم يعمل على المنفذ 3000");
});
