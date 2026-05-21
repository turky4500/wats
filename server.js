const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const qrcode = require('qrcode');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const Pino = require('pino');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());

// API Key للربط الخارجي
const API_TOKEN = process.env.API_TOKEN || 'my-secret-token-123';

// واجهة الـ API للإرسال عن بعد (محمية بالتوكن)
app.post('/api/send-message', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${API_TOKEN}`) {
        return res.status(401).json({ error: 'Unauthorized. Invalid API Token.' });
    }

    const { to, body } = req.body;
    if (!to || !body) {
        return res.status(400).json({ error: 'Missing "to" or "body" parameters.' });
    }

    if (!isClientReady) {
        return res.status(503).json({ error: 'WhatsApp client is not ready yet.' });
    }

    try {
        // يدعم إرسال رقم واحد أو مصفوفة أرقام
        const numbers = Array.isArray(to) ? to : [to];
        const results = [];

        for (const num of numbers) {
            const jid = `${num}@s.whatsapp.net`;
            try {
                await sock.sendMessage(jid, { text: body });
                results.push({ number: num, status: 'success' });
                // انتظار 3 ثوانٍ بين كل رسالة والأخرى لتجنب الحظر
                await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (err) {
                results.push({ number: num, status: 'failed', error: err.message });
            }
        }
        return res.status(200).json({ success: true, results });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// مسار Ping لحل مشكلة سكون Render
app.get('/ping', (req, res) => res.send('pong'));

// نظام حماية صفحة الويب بكلمة مرور
function basicAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="WhatsApp Panel"');
        return res.status(401).send('يرجى تسجيل الدخول');
    }
    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];
    
    // اسم المستخدم وكلمة المرور للوحة التحكم
    const USERNAME = process.env.ADMIN_USER || 'admin';
    const PASSWORD = process.env.ADMIN_PASS || '123456';
    
    if (user === USERNAME && pass === PASSWORD) {
        next();
    } else {
        res.setHeader('WWW-Authenticate', 'Basic realm="WhatsApp Panel"');
        return res.status(401).send('بيانات الدخول خاطئة');
    }
}

app.use(basicAuth);
app.use(express.static('public'));

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
        browser: Browsers.macOS('Desktop')
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
            // دعم الأرقام المفصولة بفاصلة
            const numbers = to.split(',').map(n => n.trim()).filter(n => n);
            for (const num of numbers) {
                const jid = `${num}@s.whatsapp.net`;
                try {
                    await sock.sendMessage(jid, { text: body });
                    socket.emit('message-sent', { to: num, body });
                    // تأخير 3 ثوانٍ بين كل رسالة
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } catch (e) {
                    socket.emit('error', `فشل الإرسال إلى ${num}: ${e.message}`);
                }
            }
        } catch (err) {
            socket.emit('error', err.message);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ خادم على المنفذ ${PORT}`));
