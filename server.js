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

async function connectToWhatsApp() {
    console.log("🚀 جاري تشغيل بوت واتساب...");
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,  // الباركود سيظهر في سجلات Render
        logger: Pino({ level: 'silent' }),
        browser: ['Chrome (Linux)', 'Chrome', '110.0.5481.100']
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("✅ تم استلام رمز QR، جاري تحويله إلى صورة...");
            try {
                // تحويل QR إلى صورة base64
                const qrImage = await qrcode.toDataURL(qr);
                // إرسال الصورة إلى جميع المتصفحات المتصلة
                io.emit('qr', qrImage);
                console.log("📱 تم إرسال رمز QR إلى الصفحة");
            } catch (err) {
                console.error("❌ خطأ في تحويل QR:", err);
            }
            // أيضاً نطبع نص QR في السجلات كنسخة احتياطية
            console.log("🔹 نسخة نصية من QR (يمكنك استخدامها يدوياً):", qr);
        }
        
        if (connection === 'open') {
            isClientReady = true;
            console.log("🎉 واتساب متصل وجاهز!");
            io.emit('ready', 'WhatsApp is ready!');
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            isClientReady = false;
            console.log("⚠️ تم قطع الاتصال، جاري إعادة المحاولة...");
            if (statusCode !== DisconnectReason.loggedOut) {
                connectToWhatsApp();
            } else {
                io.emit('error', 'تم تسجيل الخروج. يرجى إعادة تشغيل التطبيق ومسح QR مرة أخرى.');
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.key.fromMe && msg.message) {
            const from = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            io.emit('message', {
                from: from,
                body: body,
                timestamp: msg.messageTimestamp
            });
        }
    });
}

// بدء الاتصال
connectToWhatsApp();

io.on('connection', (socket) => {
    console.log("🌐 متصفح جديد متصل بالخادم");
    
    // إذا كان العميل جاهزاً بالفعل، نرسل الحالة الجاهزة
    if (isClientReady) {
        socket.emit('ready', 'WhatsApp is ready!');
    }

    socket.on('send-message', async ({ to, body }) => {
        if (!isClientReady) {
            socket.emit('error', 'العميل ليس جاهزاً بعد');
            return;
        }
        try {
            const jid = `${to}@s.whatsapp.net`;
            await sock.sendMessage(jid, { text: body });
            socket.emit('message-sent', { to, body, status: 'sent' });
            console.log(`📨 تم إرسال رسالة إلى ${to}`);
        } catch (err) {
            console.error("❌ فشل إرسال الرسالة:", err);
            socket.emit('error', err.message);
        }
    });
});

server.listen(3000, () => {
    console.log("✅ الخادم يعمل على http://localhost:3000");
});
